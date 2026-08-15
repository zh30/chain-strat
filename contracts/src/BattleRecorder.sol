// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @notice Worker-signed match results. Elo is computed on-chain so clients cannot self-report rating.
contract BattleRecorder is EIP712, Ownable {
    bytes32 public constant MATCH_TYPEHASH = keccak256(
        "Match(bytes32 matchId,address playerA,address playerB,uint8 heroA,uint8 heroB,uint8 winner,uint16 hpA,uint16 hpB,uint64 seed,bool vsBot,bytes32 resultHash)"
    );

    struct MatchInput {
        bytes32 matchId;
        address playerA;
        address playerB;
        uint8 heroA;
        uint8 heroB;
        uint8 winner;
        uint16 hpA;
        uint16 hpB;
        uint64 seed;
        bool vsBot;
        bytes32 resultHash;
    }

    struct PlayerStats {
        uint32 wins;
        uint32 losses;
        uint32 draws;
        uint32 rating;
    }

    error BadSigner();
    error AlreadyRecorded();
    error BadWinner();
    error ZeroPlayer();
    error ZeroAuthority();
    error SamePlayer();
    error BotFlagMismatch();
    error BadHeroType();

    address public authority;
    mapping(bytes32 matchId => bool) public recorded;
    mapping(address player => PlayerStats) private _stats;
    mapping(address player => bool) public seen;
    address[] private _players;

    event BattleRecorded(bytes32 indexed matchId, address indexed playerA, address indexed playerB, uint8 winner);
    event AuthorityUpdated(address indexed authority);

    constructor(address authority_, address owner_) EIP712("ChainStrat", "1") Ownable(owner_) {
        if (authority_ == address(0)) revert ZeroAuthority();
        if (owner_ == address(0)) revert ZeroAuthority();
        authority = authority_;
        emit AuthorityUpdated(authority_);
    }

    function setAuthority(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAuthority();
        authority = next;
        emit AuthorityUpdated(next);
    }

    function getStats(address player) external view returns (PlayerStats memory stats) {
        stats = _stats[player];
        if (!seen[player]) stats.rating = 1000;
    }

    function playerCount() external view returns (uint256) {
        return _players.length;
    }

    function playerAt(uint256 index) external view returns (address) {
        return _players[index];
    }

    function recordBattle(MatchInput calldata m, bytes calldata signature) external {
        if (recorded[m.matchId]) revert AlreadyRecorded();
        if (m.winner > 2) revert BadWinner();
        if (m.playerA == address(0)) revert ZeroPlayer();
        if (m.playerA == m.playerB) revert SamePlayer();
        if (m.vsBot != (m.playerB == address(0))) revert BotFlagMismatch();
        if (!_validHero(m.heroA) || !_validHero(m.heroB)) revert BadHeroType();

        bytes32 digest = _hashTypedDataV4(
            keccak256(
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
            )
        );
        if (ECDSA.recover(digest, signature) != authority) revert BadSigner();

        recorded[m.matchId] = true;
        _touch(m.playerA);
        if (m.playerB != address(0)) _touch(m.playerB);
        _apply(m.playerA, m.playerB, m.winner, m.vsBot);
        emit BattleRecorded(m.matchId, m.playerA, m.playerB, m.winner);
    }

    function _touch(address player) internal {
        if (seen[player]) return;
        seen[player] = true;
        _stats[player].rating = 1000;
        _players.push(player);
    }

    function _apply(address playerA, address playerB, uint8 winner, bool vsBot) internal {
        uint32 ratingA = _stats[playerA].rating;
        uint32 ratingB = playerB == address(0) ? 1000 : _stats[playerB].rating;
        uint32 k = vsBot ? 16 : 32;

        uint32 scoreA = winner == 0 ? 1000 : winner == 1 ? 0 : 500;
        _stats[playerA].rating = _elo(ratingA, ratingB, scoreA, k);
        if (winner == 0) _stats[playerA].wins += 1;
        else if (winner == 1) _stats[playerA].losses += 1;
        else _stats[playerA].draws += 1;

        if (playerB == address(0)) return;

        uint32 scoreB = winner == 1 ? 1000 : winner == 0 ? 0 : 500;
        _stats[playerB].rating = _elo(ratingB, ratingA, scoreB, k);
        if (winner == 1) _stats[playerB].wins += 1;
        else if (winner == 0) _stats[playerB].losses += 1;
        else _stats[playerB].draws += 1;
    }

    function _validHero(uint8 heroType) internal pure returns (bool) {
        return heroType >= 1 && heroType <= 7;
    }

    function _elo(uint32 ra, uint32 rb, uint32 score, uint32 k) internal pure returns (uint32) {
        int256 d = int256(uint256(ra)) - int256(uint256(rb));
        int256 expected = 500 + (d * 5) / 4;
        if (expected < 50) expected = 50;
        if (expected > 950) expected = 950;
        int256 next = int256(uint256(ra)) + (int256(uint256(k)) * (int256(uint256(score)) - expected)) / 1000;
        if (next < 100) next = 100;
        return uint32(uint256(next));
    }
}
