// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {ComboNFT} from "../src/ComboNFT.sol";

contract DeployCombo is Script {
    function run() external {
        address heroes = vm.envAddress("HERO_NFT_ADDRESS");
        address owner_ = vm.envOr("OWNER_ADDRESS", msg.sender);
        vm.startBroadcast();
        ComboNFT combos = new ComboNFT(heroes, owner_);
        vm.stopBroadcast();
        console2.log("ComboNFT", address(combos));
        console2.log("HeroNFT", heroes);
    }
}
