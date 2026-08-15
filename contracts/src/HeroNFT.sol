// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice Soulbound starter heroes. Transfers are disabled after mint.
contract HeroNFT is ERC721, Ownable {
    error Soulbound();
    error AlreadyClaimed();

    mapping(address user => bool) public claimedStarter;

    constructor(address owner_) ERC721("ChainStrat Heroes", "CSHERO") Ownable(owner_) {}

    function claimStarterPack() external {
        if (claimedStarter[msg.sender]) revert AlreadyClaimed();
        claimedStarter[msg.sender] = true;
        _mint(msg.sender, tokenIdOf(msg.sender, 1));
        _mint(msg.sender, tokenIdOf(msg.sender, 2));
        _mint(msg.sender, tokenIdOf(msg.sender, 3));
        _mint(msg.sender, tokenIdOf(msg.sender, 4));
    }

    function hasHero(address user, uint8 heroType) external view returns (bool) {
        return _ownerOf(tokenIdOf(user, heroType)) == user;
    }

    function tokenIdOf(address user, uint8 heroType) public pure returns (uint256) {
        return (uint256(uint160(user)) << 8) | uint256(heroType);
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        uint256 heroType = tokenId & 0xff;
        return string.concat("https://chainstrat.zhanghe.dev/metadata/hero/", Strings.toString(heroType), ".json");
    }
}
