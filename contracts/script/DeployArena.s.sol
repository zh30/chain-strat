// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {Arena} from "../src/Arena.sol";

contract DeployArena is Script {
    function run() external {
        address heroes = vm.envAddress("HERO_NFT_ADDRESS");
        address recorder = vm.envAddress("BATTLE_RECORDER_ADDRESS");
        address owner_ = vm.envOr("OWNER_ADDRESS", msg.sender);
        address treasury_ = vm.envOr("TREASURY_ADDRESS", owner_);
        uint256 minStake = vm.envOr("ARENA_MIN_STAKE_WEI", uint256(0.01 ether));
        vm.startBroadcast();
        Arena arena = new Arena(heroes, recorder, treasury_, minStake, owner_);
        vm.stopBroadcast();
        console2.log("Arena", address(arena));
        console2.log("HeroNFT", heroes);
        console2.log("BattleRecorder", recorder);
        console2.log("treasury", treasury_);
        console2.log("minStake", minStake);
    }
}
