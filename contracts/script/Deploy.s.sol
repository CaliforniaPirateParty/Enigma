// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {OrgFactory} from "../src/OrgFactory.sol";
import {RecoveryRegistry} from "../src/RecoveryRegistry.sol";
import {Paymaster} from "../src/Paymaster.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";

/// @notice Deploys the Enigma core: OrgFactory, RecoveryRegistry, Paymaster.
///
/// Required env vars:
///   DEPLOYER_PRIVATE_KEY  — broadcaster
///   ENTRYPOINT_ADDRESS    — ERC-4337 v0.7 EntryPoint (Base mainnet/Sepolia)
///   POLICY_SIGNER_ADDRESS — backend signer for paymaster sponsorship sigs
contract Deploy is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        address entryPoint = vm.envAddress("ENTRYPOINT_ADDRESS");
        address policySigner = vm.envAddress("POLICY_SIGNER_ADDRESS");

        vm.startBroadcast(deployerPk);

        OrgFactory factory = new OrgFactory();
        RecoveryRegistry recovery = new RecoveryRegistry();
        Paymaster paymaster = new Paymaster(IEntryPoint(entryPoint), policySigner, deployer);

        // OZ v5 Governor selectors.
        paymaster.setSelector(bytes4(keccak256("castVote(uint256,uint8)")), Paymaster.OpKind.CastVote, true);
        paymaster.setSelector(
            bytes4(keccak256("castVoteBySig(uint256,uint8,address,bytes)")), Paymaster.OpKind.CastVoteBySig, true
        );

        // RecoveryRegistry selectors.
        paymaster.setSelector(RecoveryRegistry.proposeRecovery.selector, Paymaster.OpKind.Recovery, true);
        paymaster.setSelector(RecoveryRegistry.approveRecovery.selector, Paymaster.OpKind.Recovery, true);
        paymaster.setSelector(RecoveryRegistry.executeRecovery.selector, Paymaster.OpKind.Recovery, true);

        vm.stopBroadcast();

        console2.log("OrgFactory:       ", address(factory));
        console2.log("RecoveryRegistry: ", address(recovery));
        console2.log("Paymaster:        ", address(paymaster));
        console2.log("EntryPoint:       ", entryPoint);
        console2.log("PolicySigner:     ", policySigner);
        console2.log("FundingWallet:    ", paymaster.FUNDING_WALLET());
    }
}
