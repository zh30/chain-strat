// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {DuelHouse} from "../src/DuelHouse.sol";

contract DeployDuel is Script {
    function run() external {
        address heroes = vm.envAddress("HERO_NFT_ADDRESS");
        address recorder = vm.envAddress("BATTLE_RECORDER_ADDRESS");
        address owner_ = vm.envOr("OWNER_ADDRESS", msg.sender);
        address treasury_ = vm.envOr("TREASURY_ADDRESS", owner_);
        vm.startBroadcast();
        DuelHouse duelHouse = new DuelHouse(heroes, recorder, treasury_, owner_);
        vm.stopBroadcast();
        console2.log("DuelHouse", address(duelHouse));
        console2.log("HeroNFT", heroes);
        console2.log("BattleRecorder", recorder);
        console2.log("treasury", treasury_);
    }
}
