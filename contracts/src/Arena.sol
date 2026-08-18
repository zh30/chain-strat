// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {BattleRecorder} from "./BattleRecorder.sol";

interface IHeroGate {
    function hasHero(address user, uint8 heroType) external view returns (bool);
}

/// @notice Async PvP stands. Combos are committed as keccak hashes; authority still signs resolve (P1).
contract Arena is Ownable, ReentrancyGuard {
    uint16 public constant WINNER_BPS = 9500;
    uint16 public constant TREASURY_BPS = 500;
    uint16 public constant BPS_DENOM = 10_000;

    bytes32 public constant MATCH_TYPEHASH = keccak256(
        "Match(bytes32 matchId,address playerA,address playerB,uint8 heroA,uint8 heroB,uint8 winner,uint16 hpA,uint16 hpB,uint64 seed,bool vsBot,bytes32 resultHash)"
    );

    enum Status {
        None,
        Open,
        Pending,
        Closed
    }

    struct Stand {
        address defender;
        uint8 heroType;
        bytes32 comboHash;
        uint256 stake;
        uint32 defendCount;
        Status status;
        address challenger;
        uint8 challengerHero;
        bytes32 challengerComboHash;
        uint256 nonce;
        uint256 entropy;
    }

    error NeedHero();
    error BadHeroType();
    error BadStake();
    error BadHash();
    error NotOpen();
    error NotPending();
    error NotDefender();
    error SelfChallenge();
    error AlreadyResolved();
    error ComboHashMismatch();
    error SeedMismatch();
    error BadMatch();
    error BadSigner();
    error PayFailed();
    error ZeroAddress();
    error ChallengePending();

    IHeroGate public immutable heroes;
    BattleRecorder public immutable recorder;
    address public treasury;
    uint256 public minStake;

    uint256 private _nextId;
    mapping(uint256 standId => Stand) private _stands;
    mapping(address user => uint256[]) private _owned;

    event StandCreated(uint256 indexed standId, address indexed defender, uint8 heroType, uint256 stake);
    event Challenged(uint256 indexed standId, address indexed challenger, uint8 heroType, uint256 nonce, uint256 entropy);
    event Resolved(
        uint256 indexed standId, uint8 winner, uint256 winnerPayout, uint256 treasuryPayout, uint32 defendCount
    );
    event Withdrawn(uint256 indexed standId, address indexed defender, uint256 stake);
    event TreasuryUpdated(address indexed treasury);
    event MinStakeUpdated(uint256 minStake);

    constructor(address heroes_, address recorder_, address treasury_, uint256 minStake_, address owner_)
        Ownable(owner_)
    {
        if (heroes_ == address(0) || recorder_ == address(0) || treasury_ == address(0) || owner_ == address(0)) {
            revert ZeroAddress();
        }
        if (minStake_ == 0) revert BadStake();
        heroes = IHeroGate(heroes_);
        recorder = BattleRecorder(recorder_);
        treasury = treasury_;
        minStake = minStake_;
    }

    function setTreasury(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        treasury = next;
        emit TreasuryUpdated(next);
    }

    function setMinStake(uint256 next) external onlyOwner {
        if (next == 0) revert BadStake();
        minStake = next;
        emit MinStakeUpdated(next);
    }

    function standCount() external view returns (uint256) {
        return _nextId;
    }

    function standAt(uint256 standId) external view returns (Stand memory) {
        return _stands[standId];
    }

    function standsOf(address user) external view returns (uint256[] memory) {
        return _owned[user];
    }

    /// @notice Low 32 bits of keccak256(prevrandao, defender, challenger, nonce). Matches `deriveArenaSeed` in TS.
    function deriveSeed(uint256 prevrandao, address defender, address challenger, uint256 nonce)
        public
        pure
        returns (uint64)
    {
        bytes32 digest = keccak256(abi.encodePacked(prevrandao, defender, challenger, nonce));
        return uint64(uint32(uint256(digest)));
    }

    function hashCombo(string calldata combo) public pure returns (bytes32) {
        return keccak256(bytes(combo));
    }

    function createStand(uint8 heroType, bytes32 comboHash) external payable returns (uint256 standId) {
        if (heroType == 0 || heroType > 7) revert BadHeroType();
        if (comboHash == bytes32(0)) revert BadHash();
        if (msg.value < minStake) revert BadStake();
        if (!heroes.hasHero(msg.sender, heroType)) revert NeedHero();

        standId = ++_nextId;
        Stand storage stand = _stands[standId];
        stand.defender = msg.sender;
        stand.heroType = heroType;
        stand.comboHash = comboHash;
        stand.stake = msg.value;
        stand.status = Status.Open;
        _owned[msg.sender].push(standId);
        emit StandCreated(standId, msg.sender, heroType, msg.value);
    }

    function challenge(uint256 standId, uint8 heroType, bytes32 comboHash) external payable {
        Stand storage stand = _stands[standId];
        if (stand.status != Status.Open) revert NotOpen();
        if (msg.sender == stand.defender) revert SelfChallenge();
        if (heroType == 0 || heroType > 7) revert BadHeroType();
        if (comboHash == bytes32(0)) revert BadHash();
        if (msg.value != stand.stake) revert BadStake();
        if (!heroes.hasHero(msg.sender, heroType)) revert NeedHero();

        uint256 nonce = stand.nonce + 1;
        uint256 entropy = uint256(block.prevrandao);
        stand.challenger = msg.sender;
        stand.challengerHero = heroType;
        stand.challengerComboHash = comboHash;
        stand.nonce = nonce;
        stand.entropy = entropy;
        stand.status = Status.Pending;
        emit Challenged(standId, msg.sender, heroType, nonce, entropy);
    }

    function resolve(
        uint256 standId,
        BattleRecorder.MatchInput calldata m,
        bytes calldata signature,
        string calldata defenderCombo,
        string calldata challengerCombo
    ) external nonReentrant {
        Stand storage stand = _stands[standId];
        if (stand.status != Status.Pending) revert AlreadyResolved();
        if (keccak256(bytes(defenderCombo)) != stand.comboHash) revert ComboHashMismatch();
        if (keccak256(bytes(challengerCombo)) != stand.challengerComboHash) revert ComboHashMismatch();
        if (!_matchFitsStand(stand, m)) revert BadMatch();
        uint64 seed = deriveSeed(stand.entropy, stand.defender, stand.challenger, stand.nonce);
        if (m.seed != seed) revert SeedMismatch();
        _verifyAuthority(m, signature);

        uint8 winner = m.winner;
        uint256 stake = stand.stake;
        uint256 pot = stake * 2;
        uint256 treasuryPayout = (pot * TREASURY_BPS) / BPS_DENOM;
        uint256 winnerPayout = pot - treasuryPayout;

        if (winner == 2) {
            stand.status = Status.Closed;
            stand.stake = 0;
            _pay(stand.defender, stake);
            _pay(stand.challenger, stake);
            emit Resolved(standId, winner, 0, 0, stand.defendCount);
            return;
        }

        if (winner == 0) {
            stand.defendCount += 1;
            stand.status = Status.Open;
            delete stand.challenger;
            delete stand.challengerHero;
            delete stand.challengerComboHash;
            _pay(stand.defender, winnerPayout - stake);
            _pay(treasury, treasuryPayout);
            emit Resolved(standId, winner, winnerPayout, treasuryPayout, stand.defendCount);
            return;
        }

        stand.status = Status.Closed;
        stand.stake = 0;
        _pay(stand.challenger, winnerPayout);
        _pay(treasury, treasuryPayout);
        emit Resolved(standId, winner, winnerPayout, treasuryPayout, stand.defendCount);
    }

    function withdraw(uint256 standId) external nonReentrant {
        Stand storage stand = _stands[standId];
        if (stand.defender != msg.sender) revert NotDefender();
        if (stand.status == Status.Pending) revert ChallengePending();
        if (stand.status != Status.Open) revert NotOpen();
        uint256 stake = stand.stake;
        stand.status = Status.Closed;
        stand.stake = 0;
        _pay(msg.sender, stake);
        emit Withdrawn(standId, msg.sender, stake);
    }

    function _matchFitsStand(Stand storage stand, BattleRecorder.MatchInput calldata m) private view returns (bool) {
        if (m.playerA != stand.defender || m.playerB != stand.challenger) return false;
        if (m.heroA != stand.heroType || m.heroB != stand.challengerHero) return false;
        if (m.vsBot) return false;
        if (m.winner > 2) return false;
        return true;
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
