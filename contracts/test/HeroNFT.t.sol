// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {HeroNFT} from "../src/HeroNFT.sol";

contract HeroNFTTest is Test {
    HeroNFT internal nft;
    address internal alice = address(0xA11CE);

    function setUp() public {
        nft = new HeroNFT(address(this));
    }

    function test_claimStarterPack_mintsFourSoulbound() public {
        vm.prank(alice);
        nft.claimStarterPack();
        assertTrue(nft.hasHero(alice, 1));
        assertTrue(nft.hasHero(alice, 2));
        assertTrue(nft.hasHero(alice, 3));
        assertTrue(nft.hasHero(alice, 4));
        assertEq(nft.balanceOf(alice), 4);
    }

    function test_claimStarterPack_revertIfTwice() public {
        vm.startPrank(alice);
        nft.claimStarterPack();
        vm.expectRevert(HeroNFT.AlreadyClaimed.selector);
        nft.claimStarterPack();
        vm.stopPrank();
    }

    function test_transfer_revertsSoulbound() public {
        vm.prank(alice);
        nft.claimStarterPack();
        uint256 id = nft.tokenIdOf(alice, 1);
        vm.prank(alice);
        vm.expectRevert(HeroNFT.Soulbound.selector);
        nft.transferFrom(alice, address(0xB0B), id);
    }

    function test_safeTransferFrom_revertsSoulbound() public {
        vm.prank(alice);
        nft.claimStarterPack();
        uint256 id = nft.tokenIdOf(alice, 2);
        vm.prank(alice);
        vm.expectRevert(HeroNFT.Soulbound.selector);
        nft.safeTransferFrom(alice, address(0xB0B), id);
    }

    function test_approve_revertsSoulbound() public {
        vm.prank(alice);
        nft.claimStarterPack();
        uint256 id = nft.tokenIdOf(alice, 1);
        vm.prank(alice);
        vm.expectRevert(HeroNFT.Soulbound.selector);
        nft.approve(address(0xB0B), id);
    }

    function test_setApprovalForAll_revertsSoulbound() public {
        vm.prank(alice);
        nft.claimStarterPack();
        vm.prank(alice);
        vm.expectRevert(HeroNFT.Soulbound.selector);
        nft.setApprovalForAll(address(0xB0B), true);
    }

    function test_tokenIdEncoding_matchesRules() public view {
        uint256 id = nft.tokenIdOf(alice, 3);
        assertEq(id, (uint256(uint160(alice)) << 8) | 3);
        assertEq(id & 0xff, 3);
    }

    function test_twoUsersGetDistinctTokenIds() public {
        address bob = address(0xB0B);
        vm.prank(alice);
        nft.claimStarterPack();
        vm.prank(bob);
        nft.claimStarterPack();
        assertTrue(nft.hasHero(alice, 1));
        assertTrue(nft.hasHero(bob, 1));
        assertTrue(nft.tokenIdOf(alice, 1) != nft.tokenIdOf(bob, 1));
        assertEq(nft.ownerOf(nft.tokenIdOf(alice, 1)), alice);
        assertEq(nft.ownerOf(nft.tokenIdOf(bob, 1)), bob);
    }

    function test_hasHero_falseBeforeClaim() public view {
        assertFalse(nft.hasHero(alice, 1));
        assertFalse(nft.claimedStarter(alice));
    }

    function test_hasHero_falseForUnmintedPaidType() public {
        vm.prank(alice);
        nft.claimStarterPack();
        assertFalse(nft.hasHero(alice, 5));
    }

    function test_tokenURI_revertsIfUnminted() public {
        uint256 id = nft.tokenIdOf(alice, 1);
        vm.expectRevert();
        nft.tokenURI(id);
    }

    function test_tokenURI_usesHeroType() public {
        vm.prank(alice);
        nft.claimStarterPack();
        assertEq(nft.tokenURI(nft.tokenIdOf(alice, 4)), "https://chainstrat.zhanghe.dev/metadata/hero/4.json");
    }
}
