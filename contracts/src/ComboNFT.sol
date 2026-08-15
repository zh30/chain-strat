// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IHeroGate {
    function hasHero(address user, uint8 heroType) external view returns (bool);
}

/// @notice Transferable SkillCombo NFT. Bound to a hero type, sold with native MON.
contract ComboNFT is ERC721Enumerable, Ownable {
    uint8 public constant MAX_HERO_TYPE = 7;
    uint8 public constant SKILL_SLOTS = 3;
    uint256 public constant MAX_SKILLS = 64;

    error NeedHero();
    error BadHeroType();
    error BadCombo();
    error BadSkill();
    error NotOwner();
    error NotListed();
    error BadPrice();
    error SelfBuy();
    error PayFailed();
    error ZeroHeroNft();

    struct Combo {
        uint8 heroType;
        uint8[] skillIndexes;
    }

    struct Listing {
        address seller;
        uint256 price;
    }

    IHeroGate public heroes;
    uint256 private _nextId;
    mapping(uint256 tokenId => Combo) private _combos;
    mapping(uint256 tokenId => Listing) private _listings;
    uint256[] private _listedIds;
    mapping(uint256 tokenId => uint256) private _listedIndex;

    event ComboMinted(uint256 indexed tokenId, address indexed minter, uint8 heroType);
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Unlisted(uint256 indexed tokenId);
    event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);

    constructor(address heroNft_, address owner_) ERC721("ChainStrat Combos", "CSCOMBO") Ownable(owner_) {
        if (heroNft_ == address(0)) revert ZeroHeroNft();
        heroes = IHeroGate(heroNft_);
    }

    function mint(uint8 heroType, uint8[] calldata skillIndexes) external returns (uint256 tokenId) {
        if (heroType == 0 || heroType > MAX_HERO_TYPE) revert BadHeroType();
        if (skillIndexes.length == 0 || skillIndexes.length > MAX_SKILLS) revert BadCombo();
        for (uint256 i = 0; i < skillIndexes.length; i++) {
            if (skillIndexes[i] >= SKILL_SLOTS) revert BadSkill();
        }
        if (!heroes.hasHero(msg.sender, heroType)) revert NeedHero();

        tokenId = ++_nextId;
        Combo storage combo = _combos[tokenId];
        combo.heroType = heroType;
        combo.skillIndexes = skillIndexes;
        _safeMint(msg.sender, tokenId);
        emit ComboMinted(tokenId, msg.sender, heroType);
    }

    function getCombo(uint256 tokenId) external view returns (uint8 heroType, uint8[] memory skillIndexes) {
        _requireOwned(tokenId);
        Combo storage combo = _combos[tokenId];
        return (combo.heroType, combo.skillIndexes);
    }

    function listingOf(uint256 tokenId) external view returns (address seller, uint256 price) {
        Listing storage listing = _listings[tokenId];
        return (listing.seller, listing.price);
    }

    function listingCount() external view returns (uint256) {
        return _listedIds.length;
    }

    function listingAt(uint256 index)
        external
        view
        returns (uint256 tokenId, address seller, uint256 price, uint8 heroType, uint8[] memory skillIndexes)
    {
        tokenId = _listedIds[index];
        Listing storage listing = _listings[tokenId];
        Combo storage combo = _combos[tokenId];
        return (tokenId, listing.seller, listing.price, combo.heroType, combo.skillIndexes);
    }

    function list(uint256 tokenId, uint256 price) external {
        if (msg.sender != ownerOf(tokenId)) revert NotOwner();
        if (price == 0) revert BadPrice();
        if (_listings[tokenId].price == 0) {
            _listedIndex[tokenId] = _listedIds.length;
            _listedIds.push(tokenId);
        }
        _listings[tokenId] = Listing({seller: msg.sender, price: price});
        emit Listed(tokenId, msg.sender, price);
    }

    function cancel(uint256 tokenId) external {
        if (msg.sender != ownerOf(tokenId)) revert NotOwner();
        if (_listings[tokenId].price == 0) revert NotListed();
        _unlist(tokenId);
    }

    function buy(uint256 tokenId) external payable {
        Listing memory listing = _listings[tokenId];
        if (listing.price == 0) revert NotListed();
        if (msg.value != listing.price) revert BadPrice();
        if (msg.sender == listing.seller) revert SelfBuy();
        _unlist(tokenId);
        _safeTransfer(listing.seller, msg.sender, tokenId, "");
        (bool ok,) = listing.seller.call{value: msg.value}("");
        if (!ok) revert PayFailed();
        emit Sold(tokenId, listing.seller, msg.sender, listing.price);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat("https://chainstrat.zhanghe.dev/metadata/combo/", Strings.toString(tokenId));
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && _listings[tokenId].price != 0) {
            _unlist(tokenId);
        }
        return super._update(to, tokenId, auth);
    }

    function _unlist(uint256 tokenId) private {
        if (_listings[tokenId].price == 0) return;
        uint256 index = _listedIndex[tokenId];
        uint256 last = _listedIds.length - 1;
        if (index != last) {
            uint256 moved = _listedIds[last];
            _listedIds[index] = moved;
            _listedIndex[moved] = index;
        }
        _listedIds.pop();
        delete _listedIndex[tokenId];
        delete _listings[tokenId];
        emit Unlisted(tokenId);
    }
}
