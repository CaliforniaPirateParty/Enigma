// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {OrgFactory} from "../src/OrgFactory.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {OrgGovernor} from "../src/OrgGovernor.sol";

contract OrgFactoryTest is Test {
    OrgFactory factory;
    address creator = address(0xC4EA70);

    function setUp() public {
        factory = new OrgFactory();
    }

    function _baseParams(MembershipNFT.JoinPolicy policy) internal pure returns (OrgFactory.OrgParams memory) {
        return OrgFactory.OrgParams({
            name: "TestOrg",
            symbol: "TO",
            metadataURI: "ipfs://test",
            votingDelay: 1,
            votingPeriod: 50,
            proposalThreshold: 1,
            quorumPercent: 4,
            joinPolicy: policy
        });
    }

    // --- createOrg: Open policy ---

    function test_CreateOrg_Open_DeploysPair() public {
        vm.prank(creator);
        (address membership, address governor) = factory.createOrg(_baseParams(MembershipNFT.JoinPolicy.Open));
        assertTrue(membership != address(0));
        assertTrue(governor != address(0));
        assertTrue(membership != governor);
    }

    function test_CreateOrg_Open_MintsGenesisToCreator() public {
        vm.prank(creator);
        (address membership,) = factory.createOrg(_baseParams(MembershipNFT.JoinPolicy.Open));
        assertEq(MembershipNFT(membership).balanceOf(creator), 1);
    }

    function test_CreateOrg_Open_OwnershipTransferredToCreator() public {
        vm.prank(creator);
        (address membership,) = factory.createOrg(_baseParams(MembershipNFT.JoinPolicy.Open));
        assertEq(MembershipNFT(membership).owner(), creator);
    }

    function test_CreateOrg_Open_EmitsOrgCreated() public {
        vm.prank(creator);
        vm.expectEmit(true, false, false, false);
        emit OrgFactory.OrgCreated(creator, address(0), address(0), "TestOrg");
        factory.createOrg(_baseParams(MembershipNFT.JoinPolicy.Open));
    }

    // --- createOrg: Allowlist policy ---

    function test_CreateOrg_Allowlist_OwnershipTransferredToGovernor() public {
        vm.prank(creator);
        (address membership, address governor) = factory.createOrg(_baseParams(MembershipNFT.JoinPolicy.Allowlist));
        assertEq(MembershipNFT(membership).owner(), governor);
    }

    function test_CreateOrg_Allowlist_JoinOpenReverts() public {
        vm.prank(creator);
        (address membership,) = factory.createOrg(_baseParams(MembershipNFT.JoinPolicy.Allowlist));
        address stranger = address(0xBEEF);
        vm.prank(stranger);
        vm.expectRevert(MembershipNFT.NotOpen.selector);
        MembershipNFT(membership).joinOpen();
    }

    // --- createOrg: Application policy ---

    function test_CreateOrg_Application_OwnershipTransferredToGovernor() public {
        vm.prank(creator);
        (address membership, address governor) = factory.createOrg(_baseParams(MembershipNFT.JoinPolicy.Application));
        assertEq(MembershipNFT(membership).owner(), governor);
    }

    // --- Governor wired correctly ---

    function test_CreateOrg_GovernorVotingSettings() public {
        vm.prank(creator);
        (, address governor) = factory.createOrg(_baseParams(MembershipNFT.JoinPolicy.Open));
        OrgGovernor gov = OrgGovernor(payable(governor));
        assertEq(gov.votingDelay(), 1);
        assertEq(gov.votingPeriod(), 50);
        assertEq(gov.proposalThreshold(), 1);
    }

    // --- Fuzz ---

    function testFuzz_CreateOrg_AlwaysDeploysPair(
        uint48 votingDelay,
        uint32 votingPeriod,
        uint8 policyIdx
    ) public {
        vm.assume(votingPeriod > 0);
        vm.assume(policyIdx < 3);
        MembershipNFT.JoinPolicy policy = MembershipNFT.JoinPolicy(policyIdx);
        OrgFactory.OrgParams memory p = _baseParams(policy);
        p.votingDelay = votingDelay;
        p.votingPeriod = votingPeriod;
        vm.prank(creator);
        (address m, address g) = factory.createOrg(p);
        assertTrue(m != address(0));
        assertTrue(g != address(0));
    }
}
