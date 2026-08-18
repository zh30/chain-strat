// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Arena} from "../src/Arena.sol";
import {BattleRecorder} from "../src/BattleRecorder.sol";
import {HeroNFT} from "../src/HeroNFT.sol";

contract ArenaAttacker {
    Arena public arena;
    uint256 public standId;
    BattleRecorder.MatchInput public matchInput;
    bytes public signature;
    string public defenderCombo;
    string public challengerCombo;
    bool public reentered;
    bool public innerReverted;
    bool public armed;

    constructor(Arena arena_) {
        arena = arena_;
    }

    function arm(
        uint256 standId_,
        BattleRecorder.MatchInput memory m,
        bytes memory signature_,
        string memory defenderCombo_,
        string memory challengerCombo_
    ) external {
        standId = standId_;
        matchInput = m;
        signature = signature_;
        defenderCombo = defenderCombo_;
        challengerCombo = challengerCombo_;
        armed = true;
    }

    receive() external payable {
        if (!armed || reentered) return;
        reentered = true;
        try arena.resolve(standId, matchInput, signature, defenderCombo, challengerCombo) {
        } catch {
            innerReverted = true;
        }
    }

    function doChallenge(uint256 id, uint8 heroType, bytes32 comboHash) external payable {
        arena.challenge{value: msg.value}(id, heroType, comboHash);
    }
}

contract ArenaTest is Test {
    Arena internal arena;
    BattleRecorder internal recorder;
    HeroNFT internal heroes;
    ArenaAttacker internal attacker;

    uint256 internal authorityPk = 0xA11CE;
    address internal authority;
    address internal treasury = address(0xFEE);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint256 internal constant STAKE = 0.01 ether;
    string internal constant DEF_COMBO = "[\"warrior.heavy_slash\"]";
    string internal constant ATK_COMBO = "[\"mage.fireball\"]";

    function setUp() public {
        authority = vm.addr(authorityPk);
        heroes = new HeroNFT(address(this));
        recorder = new BattleRecorder(authority, address(this));
        arena = new Arena(address(heroes), address(recorder), treasury, STAKE, address(this));
        attacker = new ArenaAttacker(arena);

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(address(attacker), 10 ether);

        vm.prank(alice);
        heroes.claimStarterPack();
        vm.prank(bob);
        heroes.claimStarterPack();
        vm.prank(address(attacker));
        heroes.claimStarterPack();
    }

    function _hash(string memory combo) internal pure returns (bytes32) {
        return keccak256(bytes(combo));
    }

    function _create() internal returns (uint256 standId) {
        vm.prank(alice);
        standId = arena.createStand{value: STAKE}(1, _hash(DEF_COMBO));
    }

    function _challenge(uint256 standId) internal {
        vm.prank(bob);
        arena.challenge{value: STAKE}(standId, 2, _hash(ATK_COMBO));
    }

    function _input(uint256 standId, uint8 winner) internal view returns (BattleRecorder.MatchInput memory m) {
        Arena.Stand memory stand = arena.standAt(standId);
        m.matchId = keccak256(abi.encodePacked("arena", standId, stand.nonce));
        m.playerA = stand.defender;
        m.playerB = stand.challenger;
        m.heroA = stand.heroType;
        m.heroB = stand.challengerHero;
        m.winner = winner;
        m.hpA = winner == 1 ? 0 : 400;
        m.hpB = winner == 0 ? 0 : 300;
        m.seed = arena.deriveSeed(stand.entropy, stand.defender, stand.challenger, stand.nonce);
        m.vsBot = false;
        m.resultHash = keccak256("arena-result");
    }

    function _sign(BattleRecorder.MatchInput memory m) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                recorder.MATCH_TYPEHASH(),
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(authorityPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_createStand_locksStakeAndRecordsHash() public {
        uint256 standId = _create();
        Arena.Stand memory stand = arena.standAt(standId);
        assertEq(stand.defender, alice);
        assertEq(stand.heroType, 1);
        assertEq(stand.comboHash, _hash(DEF_COMBO));
        assertEq(stand.stake, STAKE);
        assertEq(uint8(stand.status), uint8(Arena.Status.Open));
        assertEq(arena.standCount(), 1);
        uint256[] memory mine = arena.standsOf(alice);
        assertEq(mine.length, 1);
        assertEq(mine[0], standId);
        assertEq(address(arena).balance, STAKE);
    }

    function test_createStand_revertsBelowMinOrWithoutHero() public {
        vm.prank(alice);
        vm.expectRevert(Arena.BadStake.selector);
        arena.createStand{value: STAKE - 1}(1, _hash(DEF_COMBO));

        address stranger = address(0xBAD);
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        vm.expectRevert(Arena.NeedHero.selector);
        arena.createStand{value: STAKE}(1, _hash(DEF_COMBO));
    }

    function test_challenge_capturesEntropyAndLocksEqualStake() public {
        uint256 standId = _create();
        vm.prevrandao(bytes32(uint256(0xBEEF)));
        _challenge(standId);
        Arena.Stand memory stand = arena.standAt(standId);
        assertEq(stand.challenger, bob);
        assertEq(stand.challengerHero, 2);
        assertEq(stand.challengerComboHash, _hash(ATK_COMBO));
        assertEq(uint8(stand.status), uint8(Arena.Status.Pending));
        assertEq(stand.nonce, 1);
        assertEq(stand.entropy, 0xBEEF);
        assertEq(address(arena).balance, STAKE * 2);
    }

    function test_resolve_defenderWin_pays95ofPot_keepsStandOpen() public {
        uint256 standId = _create();
        _challenge(standId);
        BattleRecorder.MatchInput memory m = _input(standId, 0);
        bytes memory sig = _sign(m);

        uint256 aliceBefore = alice.balance;
        uint256 treasuryBefore = treasury.balance;
        arena.resolve(standId, m, sig, DEF_COMBO, ATK_COMBO);

        uint256 pot = STAKE * 2;
        uint256 cut = pot * 5 / 100;
        uint256 prize = pot - cut;
        assertEq(alice.balance, aliceBefore + (prize - STAKE));
        assertEq(treasury.balance, treasuryBefore + cut);
        Arena.Stand memory stand = arena.standAt(standId);
        assertEq(uint8(stand.status), uint8(Arena.Status.Open));
        assertEq(stand.defendCount, 1);
        assertEq(stand.challenger, address(0));
        assertEq(stand.stake, STAKE);
        assertEq(address(arena).balance, STAKE);
    }

    function test_resolve_challengerWin_pays95andCloses() public {
        uint256 standId = _create();
        _challenge(standId);
        BattleRecorder.MatchInput memory m = _input(standId, 1);
        uint256 bobBefore = bob.balance;
        uint256 treasuryBefore = treasury.balance;
        arena.resolve(standId, m, _sign(m), DEF_COMBO, ATK_COMBO);

        uint256 pot = STAKE * 2;
        uint256 cut = pot * 5 / 100;
        assertEq(bob.balance, bobBefore + pot - cut);
        assertEq(treasury.balance, treasuryBefore + cut);
        Arena.Stand memory stand = arena.standAt(standId);
        assertEq(uint8(stand.status), uint8(Arena.Status.Closed));
        assertEq(stand.stake, 0);
        assertEq(address(arena).balance, 0);
    }

    function test_resolve_draw_refundsBothAndCloses() public {
        uint256 standId = _create();
        _challenge(standId);
        BattleRecorder.MatchInput memory m = _input(standId, 2);
        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;
        arena.resolve(standId, m, _sign(m), DEF_COMBO, ATK_COMBO);

        assertEq(alice.balance, aliceBefore + STAKE);
        assertEq(bob.balance, bobBefore + STAKE);
        assertEq(treasury.balance, 0);
        assertEq(uint8(arena.standAt(standId).status), uint8(Arena.Status.Closed));
        assertEq(address(arena).balance, 0);
    }

    function test_resolve_comboHashMismatch_reverts() public {
        uint256 standId = _create();
        _challenge(standId);
        BattleRecorder.MatchInput memory m = _input(standId, 0);
        bytes memory sig = _sign(m);
        vm.expectRevert(Arena.ComboHashMismatch.selector);
        arena.resolve(standId, m, sig, "[\"tampered\"]", ATK_COMBO);
        vm.expectRevert(Arena.ComboHashMismatch.selector);
        arena.resolve(standId, m, sig, DEF_COMBO, "[\"tampered\"]");
    }

    function test_resolve_doubleResolve_reverts() public {
        uint256 standId = _create();
        _challenge(standId);
        BattleRecorder.MatchInput memory m = _input(standId, 1);
        bytes memory sig = _sign(m);
        arena.resolve(standId, m, sig, DEF_COMBO, ATK_COMBO);
        vm.expectRevert(Arena.AlreadyResolved.selector);
        arena.resolve(standId, m, sig, DEF_COMBO, ATK_COMBO);
    }

    function test_resolve_wrongSeed_reverts() public {
        uint256 standId = _create();
        _challenge(standId);
        BattleRecorder.MatchInput memory m = _input(standId, 0);
        m.seed = 999;
        bytes memory sig = _sign(m);
        vm.expectRevert(Arena.SeedMismatch.selector);
        arena.resolve(standId, m, sig, DEF_COMBO, ATK_COMBO);
    }

    function test_resolve_reentrancy_reverts() public {
        uint256 standId = _create();
        vm.prank(address(attacker));
        attacker.doChallenge{value: STAKE}(standId, 2, _hash(ATK_COMBO));

        BattleRecorder.MatchInput memory m = _input(standId, 1);
        bytes memory sig = _sign(m);
        attacker.arm(standId, m, sig, DEF_COMBO, ATK_COMBO);

        uint256 before = address(attacker).balance;
        arena.resolve(standId, m, sig, DEF_COMBO, ATK_COMBO);
        assertTrue(attacker.reentered());
        assertTrue(attacker.innerReverted());
        uint256 pot = STAKE * 2;
        uint256 prize = pot - pot * 5 / 100;
        assertEq(address(attacker).balance, before + prize);
        assertEq(uint8(arena.standAt(standId).status), uint8(Arena.Status.Closed));
        assertEq(address(arena).balance, 0);
    }

    function test_withdraw_returnsStakeWhenOpen() public {
        uint256 standId = _create();
        uint256 before = alice.balance;
        vm.prank(alice);
        arena.withdraw(standId);
        assertEq(alice.balance, before + STAKE);
        assertEq(uint8(arena.standAt(standId).status), uint8(Arena.Status.Closed));
    }

    function test_withdraw_revertsWhenPending() public {
        uint256 standId = _create();
        _challenge(standId);
        vm.prank(alice);
        vm.expectRevert(Arena.ChallengePending.selector);
        arena.withdraw(standId);
    }

    function test_deriveSeed_matchesPackedKeccakLow32() public view {
        uint256 prev = 0xabcde;
        uint256 nonce = 7;
        uint64 seed = arena.deriveSeed(prev, alice, bob, nonce);
        bytes32 digest = keccak256(abi.encodePacked(prev, alice, bob, nonce));
        assertEq(uint256(seed), uint256(uint32(uint256(digest))));
        assertTrue(arena.deriveSeed(prev, alice, bob, nonce + 1) != seed);
        assertTrue(arena.deriveSeed(prev, bob, alice, nonce) != seed);
    }

    function test_hashCombo_matchesKeccakBytes() public view {
        assertEq(arena.hashCombo(DEF_COMBO), keccak256(bytes(DEF_COMBO)));
    }
}
