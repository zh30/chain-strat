// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {BattleRecorder} from "../src/BattleRecorder.sol";

contract BattleRecorderTest is Test {
    BattleRecorder internal recorder;
    uint256 internal authorityPk = 0xA11CE;
    address internal authority;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        authority = vm.addr(authorityPk);
        recorder = new BattleRecorder(authority, address(this));
    }

    function _base(bytes32 matchId) internal view returns (BattleRecorder.MatchInput memory m) {
        m.matchId = matchId;
        m.playerA = alice;
        m.playerB = bob;
        m.heroA = 1;
        m.heroB = 2;
        m.winner = 0;
        m.hpA = 400;
        m.hpB = 0;
        m.seed = 123;
        m.vsBot = false;
        m.resultHash = keccak256("result");
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

    function _elo(uint32 ra, uint32 rb, uint32 score, uint32 k) internal pure returns (uint32) {
        int256 d = int256(uint256(ra)) - int256(uint256(rb));
        int256 expected = 500 + (d * 5) / 4;
        if (expected < 50) expected = 50;
        if (expected > 950) expected = 950;
        int256 next = int256(uint256(ra)) + (int256(uint256(k)) * (int256(uint256(score)) - expected)) / 1000;
        if (next < 100) next = 100;
        return uint32(uint256(next));
    }

    function test_constructor_rejectsZeroAuthority() public {
        vm.expectRevert(BattleRecorder.ZeroAuthority.selector);
        new BattleRecorder(address(0), address(this));
        vm.expectRevert();
        new BattleRecorder(authority, address(0));
    }

    function test_getStats_unseenPlayerStartsAt1000() public view {
        BattleRecorder.PlayerStats memory s = recorder.getStats(alice);
        assertEq(s.rating, 1000);
        assertEq(s.wins, 0);
        assertEq(s.losses, 0);
        assertEq(s.draws, 0);
        assertEq(recorder.playerCount(), 0);
    }

    function test_pvpWin_updatesEloAndCounts() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("pvp-win"));
        recorder.recordBattle(m, _sign(m));

        BattleRecorder.PlayerStats memory a = recorder.getStats(alice);
        BattleRecorder.PlayerStats memory b = recorder.getStats(bob);
        assertEq(a.wins, 1);
        assertEq(a.losses, 0);
        assertEq(b.wins, 0);
        assertEq(b.losses, 1);
        assertEq(a.rating, _elo(1000, 1000, 1000, 32));
        assertEq(b.rating, _elo(1000, 1000, 0, 32));
        assertEq(a.rating, 1016);
        assertEq(b.rating, 984);
        assertEq(recorder.playerCount(), 2);
        assertTrue(recorder.recorded(m.matchId));
    }

    function test_pvpDraw_keepsRatingAddsDraw() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("pvp-draw"));
        m.winner = 2;
        m.hpA = 200;
        m.hpB = 200;
        recorder.recordBattle(m, _sign(m));

        BattleRecorder.PlayerStats memory a = recorder.getStats(alice);
        BattleRecorder.PlayerStats memory b = recorder.getStats(bob);
        assertEq(a.draws, 1);
        assertEq(b.draws, 1);
        assertEq(a.rating, 1000);
        assertEq(b.rating, 1000);
    }

    function test_botWin_usesK16_andDoesNotListBot() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("bot-win"));
        m.playerB = address(0);
        m.vsBot = true;
        m.heroB = 3;
        recorder.recordBattle(m, _sign(m));

        BattleRecorder.PlayerStats memory a = recorder.getStats(alice);
        assertEq(a.wins, 1);
        assertEq(a.rating, _elo(1000, 1000, 1000, 16));
        assertEq(a.rating, 1008);
        assertEq(recorder.playerCount(), 1);
        assertEq(recorder.playerAt(0), alice);
    }

    function test_botLoss_usesK16() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("bot-loss"));
        m.playerB = address(0);
        m.vsBot = true;
        m.winner = 1;
        recorder.recordBattle(m, _sign(m));

        BattleRecorder.PlayerStats memory a = recorder.getStats(alice);
        assertEq(a.losses, 1);
        assertEq(a.rating, 992);
    }

    function test_secondPvpMatch_usesUpdatedRatings() public {
        BattleRecorder.MatchInput memory first = _base(keccak256("m1"));
        recorder.recordBattle(first, _sign(first));

        BattleRecorder.MatchInput memory second = _base(keccak256("m2"));
        second.winner = 0;
        recorder.recordBattle(second, _sign(second));

        BattleRecorder.PlayerStats memory a = recorder.getStats(alice);
        BattleRecorder.PlayerStats memory b = recorder.getStats(bob);
        assertEq(a.rating, _elo(1016, 984, 1000, 32));
        assertEq(b.rating, _elo(984, 1016, 0, 32));
        assertEq(a.wins, 2);
        assertEq(b.losses, 2);
    }

    function test_replaySameMatchId_reverts() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("replay"));
        bytes memory sig = _sign(m);
        recorder.recordBattle(m, sig);
        vm.expectRevert(BattleRecorder.AlreadyRecorded.selector);
        recorder.recordBattle(m, sig);
    }

    function test_badSigner_reverts() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("bad-sig"));
        uint256 stranger = 0xBEEF;
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(stranger, digest);
        vm.expectRevert(BattleRecorder.BadSigner.selector);
        recorder.recordBattle(m, abi.encodePacked(r, s, v));
    }

    function test_tamperedWinner_failsSignature() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("tamper"));
        bytes memory sig = _sign(m);
        m.winner = 1;
        vm.expectRevert(BattleRecorder.BadSigner.selector);
        recorder.recordBattle(m, sig);
    }

    function test_winnerOutOfRange_reverts() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("bad-winner"));
        m.winner = 3;
        bytes memory sig = _sign(m);
        vm.expectRevert(BattleRecorder.BadWinner.selector);
        recorder.recordBattle(m, sig);
    }

    function test_zeroPlayerA_reverts() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("zero-a"));
        m.playerA = address(0);
        m.vsBot = false;
        bytes memory sig = _sign(m);
        vm.expectRevert(BattleRecorder.ZeroPlayer.selector);
        recorder.recordBattle(m, sig);
    }

    function test_samePlayer_reverts() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("same"));
        m.playerB = alice;
        bytes memory sig = _sign(m);
        vm.expectRevert(BattleRecorder.SamePlayer.selector);
        recorder.recordBattle(m, sig);
    }

    function test_botFlagMismatch_revertsWhenVsBotButHumanB() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("flag-1"));
        m.vsBot = true;
        m.playerB = bob;
        bytes memory sig = _sign(m);
        vm.expectRevert(BattleRecorder.BotFlagMismatch.selector);
        recorder.recordBattle(m, sig);
    }

    function test_botFlagMismatch_revertsWhenHumanFlagButZeroB() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("flag-2"));
        m.vsBot = false;
        m.playerB = address(0);
        bytes memory sig = _sign(m);
        vm.expectRevert(BattleRecorder.BotFlagMismatch.selector);
        recorder.recordBattle(m, sig);
    }

    function test_badHeroType_reverts() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("hero-0"));
        m.heroA = 0;
        bytes memory sig = _sign(m);
        vm.expectRevert(BattleRecorder.BadHeroType.selector);
        recorder.recordBattle(m, sig);

        m = _base(keccak256("hero-8"));
        m.heroB = 8;
        sig = _sign(m);
        vm.expectRevert(BattleRecorder.BadHeroType.selector);
        recorder.recordBattle(m, sig);
    }

    function test_paidHeroTypes_allowed() public {
        BattleRecorder.MatchInput memory m = _base(keccak256("paid"));
        m.heroA = 5;
        m.heroB = 7;
        recorder.recordBattle(m, _sign(m));
        assertTrue(recorder.recorded(m.matchId));
    }

    function test_setAuthority_onlyOwnerAndRejectsZero() public {
        vm.prank(alice);
        vm.expectRevert();
        recorder.setAuthority(alice);

        vm.expectRevert(BattleRecorder.ZeroAuthority.selector);
        recorder.setAuthority(address(0));

        address next = vm.addr(0xD00D);
        recorder.setAuthority(next);
        assertEq(recorder.authority(), next);
    }

    function test_rotatedAuthority_canSign() public {
        uint256 nextPk = 0xD00D;
        address next = vm.addr(nextPk);
        recorder.setAuthority(next);

        BattleRecorder.MatchInput memory m = _base(keccak256("rotated"));
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(nextPk, digest);
        recorder.recordBattle(m, abi.encodePacked(r, s, v));
        assertEq(recorder.getStats(alice).wins, 1);
    }

    function test_ratingFloor_is100() public {
        // Drive Alice down with many bot losses until the floor binds.
        for (uint256 i = 0; i < 80; i++) {
            BattleRecorder.MatchInput memory m = _base(keccak256(abi.encodePacked("floor", i)));
            m.playerB = address(0);
            m.vsBot = true;
            m.winner = 1;
            recorder.recordBattle(m, _sign(m));
        }
        BattleRecorder.PlayerStats memory a = recorder.getStats(alice);
        assertGe(a.rating, 100);
        assertEq(a.losses, 80);
    }
}
