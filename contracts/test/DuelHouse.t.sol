// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {BattleRecorder} from "../src/BattleRecorder.sol";
import {DuelHouse} from "../src/DuelHouse.sol";
import {HeroNFT} from "../src/HeroNFT.sol";

contract DuelAttacker {
    DuelHouse public house;
    uint256 public duelId;
    BattleRecorder.MatchInput public matchInput;
    bytes public signature;
    bool public reentered;
    bool public innerReverted;
    bool public armed;

    constructor(DuelHouse house_) {
        house = house_;
    }

    function arm(uint256 duelId_, BattleRecorder.MatchInput memory m, bytes memory signature_) external {
        duelId = duelId_;
        matchInput = m;
        signature = signature_;
        armed = true;
    }

    receive() external payable {
        if (!armed || reentered) return;
        reentered = true;
        try house.settle(duelId, matchInput, signature) {} catch {
            innerReverted = true;
        }
    }

    function doAccept(uint256 id, uint8 heroType, bytes32 commit) external payable {
        house.acceptDuel{value: msg.value}(id, heroType, commit);
    }
}

contract DuelHouseTest is Test {
    DuelHouse internal house;
    BattleRecorder internal recorder;
    HeroNFT internal heroes;
    DuelAttacker internal attacker;

    uint256 internal authorityPk = 0xA11CE;
    address internal authority;
    address internal treasury = address(0xFEE);
    address internal alice = address(0xA11CE1);
    address internal bob = address(0xB0B);

    uint256 internal constant STAKE = 0.01 ether;
    string internal constant COMBO_A = "[\"warrior.heavy_slash\"]";
    string internal constant COMBO_B = "[\"mage.fireball\"]";
    bytes32 internal constant SALT_A = bytes32(uint256(0xAAAA));
    bytes32 internal constant SALT_B = bytes32(uint256(0xBBBB));

    function setUp() public {
        authority = vm.addr(authorityPk);
        heroes = new HeroNFT(address(this));
        recorder = new BattleRecorder(authority, address(this));
        house = new DuelHouse(address(heroes), address(recorder), treasury, address(this));
        attacker = new DuelAttacker(house);

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

    function _commit(string memory combo, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(keccak256(bytes(combo)), salt));
    }

    function _create() internal returns (uint256 duelId) {
        vm.prank(alice);
        duelId = house.createDuel{value: STAKE}(1, _commit(COMBO_A, SALT_A));
    }

    function _accept(uint256 duelId) internal {
        vm.prank(bob);
        house.acceptDuel{value: STAKE}(duelId, 2, _commit(COMBO_B, SALT_B));
    }

    function _revealBoth(uint256 duelId) internal {
        vm.prank(alice);
        house.reveal(duelId, COMBO_A, SALT_A);
        vm.prevrandao(bytes32(uint256(0xBEEF)));
        vm.prank(bob);
        house.reveal(duelId, COMBO_B, SALT_B);
    }

    function _input(uint256 duelId, uint8 winner) internal view returns (BattleRecorder.MatchInput memory m) {
        DuelHouse.Duel memory duel = house.duelAt(duelId);
        m.matchId = keccak256(abi.encodePacked("duel", duelId));
        m.playerA = duel.playerA;
        m.playerB = duel.playerB;
        m.heroA = duel.heroA;
        m.heroB = duel.heroB;
        m.winner = winner;
        m.hpA = winner == 1 ? 0 : 400;
        m.hpB = winner == 0 ? 0 : 300;
        m.seed = house.deriveSeed(duel.saltA, duel.saltB, duel.entropy);
        m.vsBot = false;
        m.resultHash = keccak256("duel-result");
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

    function test_createDuel_locksStakeAndCommit() public {
        uint256 duelId = _create();
        DuelHouse.Duel memory duel = house.duelAt(duelId);
        assertEq(duel.playerA, alice);
        assertEq(duel.heroA, 1);
        assertEq(duel.commitA, _commit(COMBO_A, SALT_A));
        assertEq(duel.stake, STAKE);
        assertEq(uint8(duel.status), uint8(DuelHouse.Status.Open));
        assertEq(house.duelCount(), 1);
        uint256[] memory mine = house.duelsOf(alice);
        assertEq(mine.length, 1);
        assertEq(mine[0], duelId);
        assertEq(address(house).balance, STAKE);
    }

    function test_createDuel_zeroStakeAllowed() public {
        vm.prank(alice);
        uint256 duelId = house.createDuel{value: 0}(1, _commit(COMBO_A, SALT_A));
        assertEq(house.duelAt(duelId).stake, 0);
    }

    function test_createDuel_revertsBadCommitOrNoHero() public {
        vm.prank(alice);
        vm.expectRevert(DuelHouse.BadCommit.selector);
        house.createDuel{value: STAKE}(1, bytes32(0));

        address stranger = address(0xBAD);
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        vm.expectRevert(DuelHouse.NeedHero.selector);
        house.createDuel{value: STAKE}(1, _commit(COMBO_A, SALT_A));
    }

    function test_acceptDuel_locksEqualStakeAndStartsWindow() public {
        uint256 duelId = _create();
        uint64 before_ = uint64(block.timestamp);
        _accept(duelId);
        DuelHouse.Duel memory duel = house.duelAt(duelId);
        assertEq(duel.playerB, bob);
        assertEq(duel.heroB, 2);
        assertEq(duel.commitB, _commit(COMBO_B, SALT_B));
        assertEq(duel.revealDeadline, before_ + house.REVEAL_WINDOW());
        assertEq(uint8(duel.status), uint8(DuelHouse.Status.Committed));
        assertEq(address(house).balance, STAKE * 2);
        assertEq(house.duelsOf(bob).length, 1);
    }

    function test_acceptDuel_revertsSelfOrWrongStake() public {
        uint256 duelId = _create();
        vm.prank(alice);
        vm.expectRevert(DuelHouse.SelfDuel.selector);
        house.acceptDuel{value: STAKE}(duelId, 1, _commit(COMBO_B, SALT_B));
        vm.prank(bob);
        vm.expectRevert(DuelHouse.BadStake.selector);
        house.acceptDuel{value: STAKE - 1}(duelId, 2, _commit(COMBO_B, SALT_B));
    }

    function test_reveal_checksCommitAndCapturesEntropyOnSecond() public {
        uint256 duelId = _create();
        _accept(duelId);
        vm.prank(alice);
        house.reveal(duelId, COMBO_A, SALT_A);
        DuelHouse.Duel memory duel = house.duelAt(duelId);
        assertTrue(duel.revealedA);
        assertEq(duel.comboA, COMBO_A);
        assertEq(duel.saltA, SALT_A);
        assertEq(duel.entropy, 0);

        vm.prevrandao(bytes32(uint256(0xBEEF)));
        vm.prank(bob);
        house.reveal(duelId, COMBO_B, SALT_B);
        duel = house.duelAt(duelId);
        assertTrue(duel.revealedB);
        assertEq(duel.entropy, 0xBEEF);
    }

    function test_reveal_eitherOrderWorks() public {
        uint256 duelId = _create();
        _accept(duelId);
        vm.prank(bob);
        house.reveal(duelId, COMBO_B, SALT_B);
        vm.prevrandao(bytes32(uint256(0xBEEF)));
        vm.prank(alice);
        house.reveal(duelId, COMBO_A, SALT_A);
        assertEq(house.duelAt(duelId).entropy, 0xBEEF);
    }

    function test_reveal_revertsWrongComboSaltOrRepeat() public {
        uint256 duelId = _create();
        _accept(duelId);
        vm.prank(alice);
        vm.expectRevert(DuelHouse.BadReveal.selector);
        house.reveal(duelId, "[\"tampered\"]", SALT_A);
        vm.prank(alice);
        vm.expectRevert(DuelHouse.BadReveal.selector);
        house.reveal(duelId, COMBO_A, SALT_B);
        vm.prank(alice);
        house.reveal(duelId, COMBO_A, SALT_A);
        vm.prank(alice);
        vm.expectRevert(DuelHouse.AlreadyRevealed.selector);
        house.reveal(duelId, COMBO_A, SALT_A);
        address stranger = address(0xE7A);
        vm.prank(stranger);
        vm.expectRevert(DuelHouse.NotPlayer.selector);
        house.reveal(duelId, COMBO_B, SALT_B);
    }

    function test_reveal_revertsAfterDeadline() public {
        uint256 duelId = _create();
        _accept(duelId);
        vm.warp(block.timestamp + house.REVEAL_WINDOW() + 1);
        vm.prank(alice);
        vm.expectRevert(DuelHouse.TooLate.selector);
        house.reveal(duelId, COMBO_A, SALT_A);
    }

    function test_settle_playerAWin_pays95ofPot() public {
        uint256 duelId = _create();
        _accept(duelId);
        _revealBoth(duelId);
        BattleRecorder.MatchInput memory m = _input(duelId, 0);
        bytes memory sig = _sign(m);

        uint256 aliceBefore = alice.balance;
        uint256 treasuryBefore = treasury.balance;
        house.settle(duelId, m, sig);

        uint256 pot = STAKE * 2;
        uint256 cut = pot * 5 / 100;
        assertEq(alice.balance, aliceBefore + pot - cut);
        assertEq(treasury.balance, treasuryBefore + cut);
        assertEq(uint8(house.duelAt(duelId).status), uint8(DuelHouse.Status.Closed));
        assertEq(address(house).balance, 0);
    }

    function test_settle_playerBWin_pays95ofPot() public {
        uint256 duelId = _create();
        _accept(duelId);
        _revealBoth(duelId);
        BattleRecorder.MatchInput memory m = _input(duelId, 1);
        uint256 bobBefore = bob.balance;
        house.settle(duelId, m, _sign(m));
        uint256 pot = STAKE * 2;
        assertEq(bob.balance, bobBefore + pot - pot * 5 / 100);
    }

    function test_settle_draw_refundsBoth() public {
        uint256 duelId = _create();
        _accept(duelId);
        _revealBoth(duelId);
        BattleRecorder.MatchInput memory m = _input(duelId, 2);
        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;
        house.settle(duelId, m, _sign(m));
        assertEq(alice.balance, aliceBefore + STAKE);
        assertEq(bob.balance, bobBefore + STAKE);
        assertEq(treasury.balance, 0);
        assertEq(address(house).balance, 0);
    }

    function test_settle_revertsBeforeBothRevealed() public {
        uint256 duelId = _create();
        _accept(duelId);
        vm.prank(alice);
        house.reveal(duelId, COMBO_A, SALT_A);
        BattleRecorder.MatchInput memory m = _input(duelId, 0);
        bytes memory sig = _sign(m);
        vm.expectRevert(DuelHouse.NotRevealed.selector);
        house.settle(duelId, m, sig);
    }

    function test_settle_revertsWrongSeedMatchOrSignature() public {
        uint256 duelId = _create();
        _accept(duelId);
        _revealBoth(duelId);
        BattleRecorder.MatchInput memory m = _input(duelId, 0);

        BattleRecorder.MatchInput memory badSeed = _input(duelId, 0);
        badSeed.seed = 999;
        bytes memory sigSeed = _sign(badSeed);
        vm.expectRevert(DuelHouse.SeedMismatch.selector);
        house.settle(duelId, badSeed, sigSeed);

        BattleRecorder.MatchInput memory badHero = _input(duelId, 0);
        badHero.heroB = 3;
        bytes memory sigHero = _sign(badHero);
        vm.expectRevert(DuelHouse.BadMatch.selector);
        house.settle(duelId, badHero, sigHero);

        BattleRecorder.MatchInput memory badId = _input(duelId, 0);
        badId.matchId = keccak256("other");
        bytes memory sigId = _sign(badId);
        vm.expectRevert(DuelHouse.BadMatch.selector);
        house.settle(duelId, badId, sigId);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xDEAD, keccak256("x"));
        bytes memory badSig = abi.encodePacked(r, s, v);
        vm.expectRevert(DuelHouse.BadSigner.selector);
        house.settle(duelId, m, badSig);
    }

    function test_settle_doubleSettle_reverts() public {
        uint256 duelId = _create();
        _accept(duelId);
        _revealBoth(duelId);
        BattleRecorder.MatchInput memory m = _input(duelId, 1);
        bytes memory sig = _sign(m);
        house.settle(duelId, m, sig);
        vm.expectRevert(DuelHouse.NotCommitted.selector);
        house.settle(duelId, m, sig);
    }

    function test_settle_reentrancy_reverts() public {
        uint256 duelId = _create();
        vm.prank(address(attacker));
        attacker.doAccept{value: STAKE}(duelId, 2, _commit(COMBO_B, SALT_B));
        vm.prank(alice);
        house.reveal(duelId, COMBO_A, SALT_A);
        vm.prevrandao(bytes32(uint256(0xBEEF)));
        vm.prank(address(attacker));
        house.reveal(duelId, COMBO_B, SALT_B);

        BattleRecorder.MatchInput memory m = _input(duelId, 1);
        bytes memory sig = _sign(m);
        attacker.arm(duelId, m, sig);

        uint256 before_ = address(attacker).balance;
        house.settle(duelId, m, sig);
        assertTrue(attacker.reentered());
        assertTrue(attacker.innerReverted());
        uint256 pot = STAKE * 2;
        assertEq(address(attacker).balance, before_ + pot - pot * 5 / 100);
        assertEq(address(house).balance, 0);
    }

    function test_claimTimeout_revealerWins() public {
        uint256 duelId = _create();
        _accept(duelId);
        vm.prank(alice);
        house.reveal(duelId, COMBO_A, SALT_A);
        vm.warp(block.timestamp + house.REVEAL_WINDOW() + 1);

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        house.claimTimeout(duelId);
        uint256 pot = STAKE * 2;
        assertEq(alice.balance, aliceBefore + pot - pot * 5 / 100);
        assertEq(uint8(house.duelAt(duelId).status), uint8(DuelHouse.Status.Closed));
    }

    function test_claimTimeout_revertsEarlyOrUnrevealedCaller() public {
        uint256 duelId = _create();
        _accept(duelId);
        vm.prank(alice);
        house.reveal(duelId, COMBO_A, SALT_A);
        vm.prank(alice);
        vm.expectRevert(DuelHouse.TooEarly.selector);
        house.claimTimeout(duelId);

        vm.warp(block.timestamp + house.REVEAL_WINDOW() + 1);
        vm.prank(bob);
        vm.expectRevert(DuelHouse.NotPlayer.selector);
        house.claimTimeout(duelId);
        vm.prank(alice);
        house.claimTimeout(duelId);
    }

    function test_claimRefund_noneRevealed_refundsBoth() public {
        uint256 duelId = _create();
        _accept(duelId);
        vm.warp(block.timestamp + house.REVEAL_WINDOW() + 1);
        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;
        house.claimRefund(duelId);
        assertEq(alice.balance, aliceBefore + STAKE);
        assertEq(bob.balance, bobBefore + STAKE);
        assertEq(address(house).balance, 0);
    }

    function test_claimRefund_bothRevealedUnsettled_refundsBoth() public {
        uint256 duelId = _create();
        _accept(duelId);
        _revealBoth(duelId);
        vm.warp(block.timestamp + house.REVEAL_WINDOW() + 1);
        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;
        house.claimRefund(duelId);
        assertEq(alice.balance, aliceBefore + STAKE);
        assertEq(bob.balance, bobBefore + STAKE);
    }

    function test_claimRefund_revertsWhenOnlyOneRevealed() public {
        uint256 duelId = _create();
        _accept(duelId);
        vm.prank(alice);
        house.reveal(duelId, COMBO_A, SALT_A);
        vm.warp(block.timestamp + house.REVEAL_WINDOW() + 1);
        vm.expectRevert(DuelHouse.NotRevealed.selector);
        house.claimRefund(duelId);
    }

    function test_cancelDuel_refundsCreator() public {
        uint256 duelId = _create();
        uint256 before_ = alice.balance;
        vm.prank(alice);
        house.cancelDuel(duelId);
        assertEq(alice.balance, before_ + STAKE);
        assertEq(uint8(house.duelAt(duelId).status), uint8(DuelHouse.Status.Closed));
    }

    function test_cancelDuel_revertsAfterAccept() public {
        uint256 duelId = _create();
        _accept(duelId);
        vm.prank(alice);
        vm.expectRevert(DuelHouse.NotOpen.selector);
        house.cancelDuel(duelId);
    }

    function test_deriveSeed_matchesPackedKeccakLow32() public view {
        uint256 entropy = 0xBEEF;
        uint64 seed = house.deriveSeed(SALT_A, SALT_B, entropy);
        bytes32 digest = keccak256(abi.encodePacked(SALT_A, SALT_B, entropy));
        assertEq(uint256(seed), uint256(uint32(uint256(digest))));
        assertTrue(house.deriveSeed(SALT_B, SALT_A, entropy) != seed);
        assertTrue(house.deriveSeed(SALT_A, SALT_B, entropy + 1) != seed);
    }

    function test_commitOf_matchesPackedKeccak() public view {
        assertEq(house.commitOf(COMBO_A, SALT_A), keccak256(abi.encodePacked(keccak256(bytes(COMBO_A)), SALT_A)));
    }
}
