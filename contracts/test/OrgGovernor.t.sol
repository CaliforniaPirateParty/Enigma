// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {OrgGovernor} from "../src/OrgGovernor.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

contract OrgGovernorTest is Test {
    OrgGovernor governor;
    MembershipNFT membership;

    address admin = address(0xAD);
    address alice = address(0xA1);
    address bob   = address(0xB0);
    address carol = address(0xC0);

    uint48 VOTING_DELAY  = 1;   // blocks
    uint32 VOTING_PERIOD = 50;  // blocks
    uint256 PROPOSAL_THRESHOLD = 1;
    uint256 QUORUM_PERCENT = 10; // 10% of supply

    function setUp() public {
        membership = new MembershipNFT("Dao", "DAO", "ipfs://m", MembershipNFT.JoinPolicy.Open, admin);
        governor = new OrgGovernor(
            "Dao",
            IVotes(address(membership)),
            VOTING_DELAY,
            VOTING_PERIOD,
            PROPOSAL_THRESHOLD,
            QUORUM_PERCENT
        );

        // Mint tokens and self-delegate so votes are counted
        vm.prank(alice);
        membership.joinOpen();
        vm.prank(alice);
        membership.delegate(alice);

        vm.prank(bob);
        membership.joinOpen();
        vm.prank(bob);
        membership.delegate(bob);

        vm.prank(carol);
        membership.joinOpen();
        vm.prank(carol);
        membership.delegate(carol);

        // Roll forward one block so delegation checkpoints are visible to Governor
        vm.roll(block.number + 1);
    }

    // --- Configuration ---

    function test_VotingDelay() public view {
        assertEq(governor.votingDelay(), VOTING_DELAY);
    }

    function test_VotingPeriod() public view {
        assertEq(governor.votingPeriod(), VOTING_PERIOD);
    }

    function test_ProposalThreshold() public view {
        assertEq(governor.proposalThreshold(), PROPOSAL_THRESHOLD);
    }

    function test_QuorumAtBlock() public {
        // Roll forward so the membership checkpoints are in the past for quorum query
        vm.roll(block.number + 1);
        // Supply = 3, quorumPercent = 10: 3 * 10 / 100 = 0 (integer division in OZ)
        // Quorum is computed as floor(supply * numerator / denominator).
        // With 3 members and 10% the result is 0, which is what OZ returns.
        uint256 q = governor.quorum(block.number - 1);
        // Verify quorum is computed correctly from the supply snapshot
        uint256 expectedSupply = membership.getPastTotalSupply(block.number - 1);
        assertEq(expectedSupply, 3);
        assertEq(q, (expectedSupply * QUORUM_PERCENT) / 100);
    }

    // --- Proposal lifecycle ---

    function _makeProposal() internal returns (uint256 proposalId) {
        address[] memory targets = new address[](1);
        targets[0] = address(0);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = hex"";
        string memory description = "Test proposal";
        vm.prank(alice);
        proposalId = governor.propose(targets, values, calldatas, description);
    }

    function test_ProposeCreatesProposal() public {
        uint256 id = _makeProposal();
        assertEq(uint8(governor.state(id)), uint8(IGovernor.ProposalState.Pending));
    }

    function test_VotingOpensAfterDelay() public {
        uint256 id = _makeProposal();
        vm.roll(block.number + VOTING_DELAY + 1);
        assertEq(uint8(governor.state(id)), uint8(IGovernor.ProposalState.Active));
    }

    function test_CastVoteInActiveProposal() public {
        uint256 id = _makeProposal();
        vm.roll(block.number + VOTING_DELAY + 1);
        vm.prank(alice);
        governor.castVote(id, 1); // 1 = For
        (uint256 against, uint256 forVotes, uint256 abstain) = governor.proposalVotes(id);
        assertEq(forVotes, 1);
        assertEq(against, 0);
        assertEq(abstain, 0);
    }

    function test_ProposalSucceedsWhenQuorumAndMajority() public {
        uint256 id = _makeProposal();
        vm.roll(block.number + VOTING_DELAY + 1);
        vm.prank(alice);
        governor.castVote(id, 1);
        vm.prank(bob);
        governor.castVote(id, 1);
        vm.roll(block.number + VOTING_PERIOD + 1);
        assertEq(uint8(governor.state(id)), uint8(IGovernor.ProposalState.Succeeded));
    }

    function test_ProposalDefeatedWhenNoQuorum() public {
        // New governor with very high quorum — 100% required
        OrgGovernor strictGov = new OrgGovernor(
            "Strict",
            IVotes(address(membership)),
            VOTING_DELAY,
            VOTING_PERIOD,
            PROPOSAL_THRESHOLD,
            100
        );
        address[] memory targets = new address[](1);
        targets[0] = address(0);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = hex"";
        vm.prank(alice);
        uint256 id = strictGov.propose(targets, values, calldatas, "Fail");
        vm.roll(block.number + VOTING_DELAY + 1);
        vm.prank(alice);
        strictGov.castVote(id, 1); // Only 1 of 3 votes
        vm.roll(block.number + VOTING_PERIOD + 1);
        assertEq(uint8(strictGov.state(id)), uint8(IGovernor.ProposalState.Defeated));
    }

    function test_BelowThresholdCannotPropose() public {
        // Governor with threshold = 2 but alice has only 1 vote
        OrgGovernor highThresholdGov = new OrgGovernor(
            "HT",
            IVotes(address(membership)),
            VOTING_DELAY,
            VOTING_PERIOD,
            2,
            QUORUM_PERCENT
        );
        address[] memory targets = new address[](1);
        targets[0] = address(0);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = hex"";
        vm.prank(alice);
        vm.roll(block.number + 1);
        vm.expectRevert();
        highThresholdGov.propose(targets, values, calldatas, "Blocked");
    }

    function test_CannotVoteTwice() public {
        uint256 id = _makeProposal();
        vm.roll(block.number + VOTING_DELAY + 1);
        vm.prank(alice);
        governor.castVote(id, 1);
        vm.prank(alice);
        vm.expectRevert();
        governor.castVote(id, 1);
    }
}
