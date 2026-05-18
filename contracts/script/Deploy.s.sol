// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {OrgFactory} from "../src/OrgFactory.sol";
import {RecoveryRegistry} from "../src/RecoveryRegistry.sol";
import {Paymaster} from "../src/Paymaster.sol";

/// @notice Deploys the Enigma core: OrgFactory, RecoveryRegistry, Paymaster.
contract Deploy is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        vm.startBroadcast(deployerPk);

        OrgFactory factory = new OrgFactory();
        RecoveryRegistry recovery = new RecoveryRegistry();
        Paymaster paymaster = new Paymaster(deployer);

        // TODO after Governor & RecoveryRegistry ABIs are stable:
        // paymaster.setSelector(bytes4(keccak256("castVote(uint256,uint8)")), Paymaster.OpKind.CastVote, true);
        // paymaster.setSelector(bytes4(keccak256("castVoteBySig(uint256,uint8,uint8,bytes32,bytes32)")), Paymaster.OpKind.CastVoteBySig, true);
        // paymaster.setSelector(RecoveryRegistry.proposeRecovery.selector, Paymaster.OpKind.Recovery, true);
        // paymaster.setSelector(RecoveryRegistry.approveRecovery.selector, Paymaster.OpKind.Recovery, true);
        // paymaster.setSelector(RecoveryRegistry.executeRecovery.selector, Paymaster.OpKind.Recovery, true);

        vm.stopBroadcast();

        console2.log("OrgFactory:       ", address(factory));
        console2.log("RecoveryRegistry: ", address(recovery));
        console2.log("Paymaster:        ", address(paymaster));
        console2.log("Funding wallet:   ", paymaster.FUNDING_WALLET());
    }
}
