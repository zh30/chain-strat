// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {BattleRecorder} from "./BattleRecorder.sol";

interface IHeroGate {
    function hasHero(address user, uint8 heroType) external view returns (bool);
}

/// @notice Commit-reveal 1v1 duels. All battle inputs (combos, salts, seed entropy) live on-chain;
///         authority still signs the simulated result (P3); signature-free settlement lands in P8.
contract DuelHouse is Ownable, ReentrancyGuard {
    uint16 public constant WINNER_BPS = 9500;
    uint16 public constant TREASURY_BPS = 500;
    uint16 public constant BPS_DENOM = 10_000;
    uint64 public constant REVEAL_WINDOW = 24 hours;

    bytes32 public constant MATCH_TYPEHASH = keccak256(
        "Match(bytes32 matchId,address playerA,address playerB,uint8 heroA,uint8 heroB,uint8 winner,uint16 hpA,uint16 hpB,uint64 seed,bool vsBot,bytes32 resultHash)"
    );

    enum Status {
        None,
        Open,
        Committed,
        Closed
    }

    struct Duel {
        address playerA;
        uint8 heroA;
        bytes32 commitA;
        address playerB;
        uint8 heroB;
        bytes32 commitB;
        uint256 stake;
        string comboA;
        bytes32 saltA;
        bool revealedA;
        string comboB;
        bytes32 saltB;
        bool revealedB;
        uint256 entropy;
        uint64 revealDeadline;
        Status status;
    }

    error NeedHero();
    error BadHeroType();
    error BadCommit();
    error BadStake();
    error NotOpen();
    error NotCommitted();
    error NotPlayer();
    error SelfDuel();
    error AlreadyRevealed();
    error BadReveal();
    error NotRevealed();
    error TooEarly();
    error TooLate();
    error BadMatch();
    error SeedMismatch();
    error BadSigner();
    error PayFailed();
    error ZeroAddress();

    IHeroGate public immutable heroes;
    BattleRecorder public immutable recorder;
    address public treasury;

    uint256 private _nextId;
    mapping(uint256 duelId => Duel) private _duels;
    mapping(address user => uint256[]) private _owned;

    event DuelCreated(uint256 indexed duelId, address indexed playerA, uint8 heroA, uint256 stake);
    event DuelAccepted(uint256 indexed duelId, address indexed playerB, uint8 heroB, uint64 revealDeadline);
    event Revealed(uint256 indexed duelId, address indexed player, bool bothRevealed);
    event Settled(uint256 indexed duelId, uint8 winner, uint256 winnerPayout, uint256 treasuryPayout);
    event TimeoutClaimed(uint256 indexed duelId, address indexed winner, uint256 winnerPayout);
    event Refunded(uint256 indexed duelId);
    event Cancelled(uint256 indexed duelId, address indexed playerA);
    event TreasuryUpdated(address indexed treasury);

    constructor(address heroes_, address recorder_, address treasury_, address owner_) Ownable(owner_) {
        if (heroes_ == address(0) || recorder_ == address(0) || treasury_ == address(0) || owner_ == address(0)) {
            revert ZeroAddress();
        }
        heroes = IHeroGate(heroes_);
        recorder = BattleRecorder(recorder_);
        treasury = treasury_;
    }

    function setTreasury(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        treasury = next;
        emit TreasuryUpdated(next);
    }

    function duelCount() external view returns (uint256) {
        return _nextId;
    }

    function duelAt(uint256 duelId) external view returns (Duel memory) {
        return _duels[duelId];
    }

    function duelsOf(address user) external view returns (uint256[] memory) {
        return _owned[user];
    }

    /// @notice keccak256(abi.encodePacked(keccak256(bytes(combo)), salt)) — matches `duelCommit` in TS.
    function commitOf(string calldata combo, bytes32 salt) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(keccak256(bytes(combo)), salt));
    }

    /// @notice Low 32 bits of keccak256(abi.encodePacked(saltA, saltB, entropy)). Matches `deriveDuelSeed` in TS.
    function deriveSeed(bytes32 saltA, bytes32 saltB, uint256 entropy) public pure returns (uint64) {
        bytes32 digest = keccak256(abi.encodePacked(saltA, saltB, entropy));
        return uint64(uint32(uint256(digest)));
    }

    function createDuel(uint8 heroType, bytes32 commit) external payable returns (uint256 duelId) {
        if (heroType == 0 || heroType > 7) revert BadHeroType();
        if (commit == bytes32(0)) revert BadCommit();
        if (!heroes.hasHero(msg.sender, heroType)) revert NeedHero();

        duelId = ++_nextId;
        Duel storage duel = _duels[duelId];
        duel.playerA = msg.sender;
        duel.heroA = heroType;
        duel.commitA = commit;
        duel.stake = msg.value;
        duel.status = Status.Open;
        _owned[msg.sender].push(duelId);
        emit DuelCreated(duelId, msg.sender, heroType, msg.value);
    }

    function cancelDuel(uint256 duelId) external nonReentrant {
        Duel storage duel = _duels[duelId];
        if (duel.playerA != msg.sender) revert NotPlayer();
        if (duel.status != Status.Open) revert NotOpen();
        uint256 stake = duel.stake;
        duel.status = Status.Closed;
        duel.stake = 0;
        _pay(msg.sender, stake);
        emit Cancelled(duelId, msg.sender);
    }

    function acceptDuel(uint256 duelId, uint8 heroType, bytes32 commit) external payable {
        Duel storage duel = _duels[duelId];
        if (duel.status != Status.Open) revert NotOpen();
        if (msg.sender == duel.playerA) revert SelfDuel();
        if (heroType == 0 || heroType > 7) revert BadHeroType();
        if (commit == bytes32(0)) revert BadCommit();
        if (msg.value != duel.stake) revert BadStake();
        if (!heroes.hasHero(msg.sender, heroType)) revert NeedHero();

        duel.playerB = msg.sender;
        duel.heroB = heroType;
        duel.commitB = commit;
        duel.revealDeadline = uint64(block.timestamp) + REVEAL_WINDOW;
        duel.status = Status.Committed;
        _owned[msg.sender].push(duelId);
        emit DuelAccepted(duelId, msg.sender, heroType, duel.revealDeadline);
    }

    function reveal(uint256 duelId, string calldata combo, bytes32 salt) external {
        Duel storage duel = _duels[duelId];
        if (duel.status != Status.Committed) revert NotCommitted();
        if (block.timestamp > duel.revealDeadline) revert TooLate();
        bytes32 commit = commitOf(combo, salt);
        if (msg.sender == duel.playerA) {
            if (duel.revealedA) revert AlreadyRevealed();
            if (commit != duel.commitA) revert BadReveal();
            duel.comboA = combo;
            duel.saltA = salt;
            duel.revealedA = true;
        } else if (msg.sender == duel.playerB) {
            if (duel.revealedB) revert AlreadyRevealed();
            if (commit != duel.commitB) revert BadReveal();
            duel.comboB = combo;
            duel.saltB = salt;
            duel.revealedB = true;
        } else {
            revert NotPlayer();
        }
        bool both = duel.revealedA && duel.revealedB;
        if (both) {
            duel.entropy = uint256(block.prevrandao);
        }
        emit Revealed(duelId, msg.sender, both);
    }

    function settle(uint256 duelId, BattleRecorder.MatchInput calldata m, bytes calldata signature)
        external
        nonReentrant
    {
        Duel storage duel = _duels[duelId];
        if (duel.status != Status.Committed) revert NotCommitted();
        if (!duel.revealedA || !duel.revealedB) revert NotRevealed();
        if (!_matchFitsDuel(duelId, duel, m)) revert BadMatch();
        uint64 seed = deriveSeed(duel.saltA, duel.saltB, duel.entropy);
        if (m.seed != seed) revert SeedMismatch();
        _verifyAuthority(m, signature);

        uint256 stake = duel.stake;
        duel.status = Status.Closed;
        duel.stake = 0;
        _payout(duelId, m.winner, stake, duel.playerA, duel.playerB);
    }

    /// @notice Opponent missed the reveal window: the revealed player wins by forfeit.
    function claimTimeout(uint256 duelId) external nonReentrant {
        Duel storage duel = _duels[duelId];
        if (duel.status != Status.Committed) revert NotCommitted();
        if (block.timestamp <= duel.revealDeadline) revert TooEarly();

        address winner;
        if (duel.revealedA && !duel.revealedB && msg.sender == duel.playerA) {
            winner = duel.playerA;
        } else if (duel.revealedB && !duel.revealedA && msg.sender == duel.playerB) {
            winner = duel.playerB;
        } else {
            revert NotPlayer();
        }
        duel.status = Status.Closed;
        uint256 stake = duel.stake;
        duel.stake = 0;
        uint256 pot = stake * 2;
        uint256 treasuryPayout = (pot * TREASURY_BPS) / BPS_DENOM;
        uint256 winnerPayout = pot - treasuryPayout;
        _pay(winner, winnerPayout);
        _pay(treasury, treasuryPayout);
        emit TimeoutClaimed(duelId, winner, winnerPayout);
    }

    /// @notice Nobody revealed, or both revealed but nobody settled, past the window: refund both.
    ///         Escape hatch for a dead authority; a winning player would settle instead.
    function claimRefund(uint256 duelId) external nonReentrant {
        Duel storage duel = _duels[duelId];
        if (duel.status != Status.Committed) revert NotCommitted();
        if (block.timestamp <= duel.revealDeadline) revert TooEarly();
        if (duel.revealedA != duel.revealedB) revert NotRevealed();

        duel.status = Status.Closed;
        uint256 stake = duel.stake;
        duel.stake = 0;
        _pay(duel.playerA, stake);
        _pay(duel.playerB, stake);
        emit Refunded(duelId);
    }

    function _matchFitsDuel(uint256 duelId, Duel storage duel, BattleRecorder.MatchInput calldata m)
        private
        view
        returns (bool)
    {
        if (m.matchId != keccak256(abi.encodePacked("duel", duelId))) return false;
        if (m.playerA != duel.playerA || m.playerB != duel.playerB) return false;
        if (m.heroA != duel.heroA || m.heroB != duel.heroB) return false;
        if (m.vsBot) return false;
        if (m.winner > 2) return false;
        return true;
    }

    function _payout(uint256 duelId, uint8 winner, uint256 stake, address playerA, address playerB) private {
        if (winner == 2) {
            _pay(playerA, stake);
            _pay(playerB, stake);
            emit Settled(duelId, winner, 0, 0);
            return;
        }
        uint256 pot = stake * 2;
        uint256 treasuryPayout = (pot * TREASURY_BPS) / BPS_DENOM;
        uint256 winnerPayout = pot - treasuryPayout;
        _pay(winner == 0 ? playerA : playerB, winnerPayout);
        _pay(treasury, treasuryPayout);
        emit Settled(duelId, winner, winnerPayout, treasuryPayout);
    }

    function _verifyAuthority(BattleRecorder.MatchInput calldata m, bytes calldata signature) private view {
        bytes32 structHash = keccak256(
            abi.encode(
                MATCH_TYPEHASH,
                m.matchId,
                m.playerA,
                m.playerB,
                m.heroA,
                m.heroB,
                m.winner,
                m.hpA,
                m.hpB,
                m.seed,
                m.vsBot,
                m.resultHash
            )
        );
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("ChainStrat")),
                keccak256(bytes("1")),
                block.chainid,
                address(recorder)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain, structHash));
        if (ECDSA.recover(digest, signature) != recorder.authority()) revert BadSigner();
    }

    function _pay(address to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert PayFailed();
    }
}
