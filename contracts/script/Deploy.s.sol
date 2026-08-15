// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {HeroNFT} from "../src/HeroNFT.sol";
import {BattleRecorder} from "../src/BattleRecorder.sol";
import {ComboNFT} from "../src/ComboNFT.sol";

contract Deploy is Script {
    function run() external {
        address authority = vm.envAddress("AUTHORITY_ADDRESS");
        address owner_ = vm.envOr("OWNER_ADDRESS", msg.sender);
        vm.startBroadcast();
        HeroNFT heroes = new HeroNFT(owner_);
        BattleRecorder recorder = new BattleRecorder(authority, owner_);
        ComboNFT combos = new ComboNFT(address(heroes), owner_);
        vm.stopBroadcast();
        console2.log("HeroNFT", address(heroes));
        console2.log("BattleRecorder", address(recorder));
        console2.log("ComboNFT", address(combos));
        console2.log("authority", authority);
    }
}
