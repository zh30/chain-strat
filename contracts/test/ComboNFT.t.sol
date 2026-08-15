// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ComboNFT} from "../src/ComboNFT.sol";
import {HeroNFT} from "../src/HeroNFT.sol";

contract ComboNFTTest is Test {
    HeroNFT internal heroes;
    ComboNFT internal combos;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        heroes = new HeroNFT(address(this));
        combos = new ComboNFT(address(heroes), address(this));
        vm.prank(alice);
        heroes.claimStarterPack();
    }

    function _mintWarrior(address user) internal returns (uint256 tokenId) {
        uint8[] memory skills = new uint8[](3);
        skills[0] = 0;
        skills[1] = 1;
        skills[2] = 2;
        vm.prank(user);
        return combos.mint(1, skills);
    }

    function test_mint_storesHeroAndSkills() public {
        uint256 id = _mintWarrior(alice);
        (uint8 heroType, uint8[] memory skills) = combos.getCombo(id);
        assertEq(heroType, 1);
        assertEq(skills.length, 3);
        assertEq(skills[0], 0);
        assertEq(skills[2], 2);
        assertEq(combos.ownerOf(id), alice);
        assertEq(combos.balanceOf(alice), 1);
    }

    function test_mint_revertsWithoutHero() public {
        uint8[] memory skills = new uint8[](1);
        skills[0] = 0;
        vm.prank(bob);
        vm.expectRevert(ComboNFT.NeedHero.selector);
        combos.mint(1, skills);
    }

    function test_mint_revertsBadHeroType() public {
        uint8[] memory skills = new uint8[](1);
        skills[0] = 0;
        vm.prank(alice);
        vm.expectRevert(ComboNFT.BadHeroType.selector);
        combos.mint(0, skills);
        vm.prank(alice);
        vm.expectRevert(ComboNFT.BadHeroType.selector);
        combos.mint(8, skills);
    }

    function test_mint_revertsEmptyOrLongOrBadIndex() public {
        uint8[] memory empty;
        vm.prank(alice);
        vm.expectRevert(ComboNFT.BadCombo.selector);
        combos.mint(1, empty);

        uint8[] memory tooLong = new uint8[](65);
        vm.prank(alice);
        vm.expectRevert(ComboNFT.BadCombo.selector);
        combos.mint(1, tooLong);

        uint8[] memory bad = new uint8[](1);
        bad[0] = 3;
        vm.prank(alice);
        vm.expectRevert(ComboNFT.BadSkill.selector);
        combos.mint(1, bad);
    }

    function test_transfer_isAllowed() public {
        uint256 id = _mintWarrior(alice);
        vm.prank(alice);
        combos.transferFrom(alice, bob, id);
        assertEq(combos.ownerOf(id), bob);
    }

    function test_listAndBuy_movesNftAndPaysSeller() public {
        uint256 id = _mintWarrior(alice);
        vm.prank(alice);
        combos.list(id, 0.2 ether);

        (address seller, uint256 price) = combos.listingOf(id);
        assertEq(seller, alice);
        assertEq(price, 0.2 ether);
        assertEq(combos.listingCount(), 1);

        uint256 before = alice.balance;
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        combos.buy{value: 0.2 ether}(id);

        assertEq(combos.ownerOf(id), bob);
        assertEq(alice.balance, before + 0.2 ether);
        assertEq(combos.listingCount(), 0);
        (, uint256 listedPrice) = combos.listingOf(id);
        assertEq(listedPrice, 0);
    }

    function test_buy_revertsWrongPriceOrSelf() public {
        uint256 id = _mintWarrior(alice);
        vm.prank(alice);
        combos.list(id, 1 ether);

        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(ComboNFT.BadPrice.selector);
        combos.buy{value: 0.5 ether}(id);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(ComboNFT.SelfBuy.selector);
        combos.buy{value: 1 ether}(id);
    }

    function test_cancel_unlists() public {
        uint256 id = _mintWarrior(alice);
        vm.prank(alice);
        combos.list(id, 1 ether);
        vm.prank(alice);
        combos.cancel(id);
        assertEq(combos.listingCount(), 0);
    }

    function test_transfer_unlists() public {
        uint256 id = _mintWarrior(alice);
        vm.prank(alice);
        combos.list(id, 1 ether);
        vm.prank(alice);
        combos.transferFrom(alice, bob, id);
        assertEq(combos.listingCount(), 0);
        (, uint256 price) = combos.listingOf(id);
        assertEq(price, 0);
    }

    function test_listingAt_returnsCombo() public {
        uint256 id = _mintWarrior(alice);
        vm.prank(alice);
        combos.list(id, 3 ether);
        (uint256 tokenId, address seller, uint256 price, uint8 heroType, uint8[] memory skills) = combos.listingAt(0);
        assertEq(tokenId, id);
        assertEq(seller, alice);
        assertEq(price, 3 ether);
        assertEq(heroType, 1);
        assertEq(skills.length, 3);
    }

    function test_tokenURI_includesTokenId() public {
        uint256 id = _mintWarrior(alice);
        string memory uri = combos.tokenURI(id);
        assertEq(uri, "https://chainstrat.zhanghe.dev/metadata/combo/1");
    }
}
