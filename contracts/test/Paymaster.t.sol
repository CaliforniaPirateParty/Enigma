// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Paymaster} from "../src/Paymaster.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";

contract PaymasterTest is Test {
    Paymaster paymaster;
    MembershipNFT membership;
    address owner = address(0xA11CE);
    address user = address(0xBEEF);
    bytes4 castVoteSelector = bytes4(keccak256("castVote(uint256,uint8)"));

    function setUp() public {
        vm.prank(owner);
        paymaster = new Paymaster(owner);
        membership = new MembershipNFT("Test", "TST", "ipfs://meta", MembershipNFT.JoinPolicy.Open, owner);

        vm.deal(paymaster.FUNDING_WALLET(), 1 ether);
        vm.prank(paymaster.FUNDING_WALLET());
        (bool ok, ) = address(paymaster).call{value: 0.5 ether}("");
        assertTrue(ok, "funding failed");

        vm.prank(owner);
        paymaster.setSelector(castVoteSelector, Paymaster.OpKind.CastVote, true);
    }

    function test_RejectsWhenMembershipTooNew() public {
        vm.prank(user);
        membership.joinOpen();
        (bool ok, , string memory reason) =
            paymaster.checkSponsorship(user, address(0xC0DE), castVoteSelector, address(membership));
        assertFalse(ok);
        assertEq(reason, "membership age below 1 hour");
    }

    function test_AcceptsAfterAgeGate() public {
        vm.prank(user);
        membership.joinOpen();
        vm.warp(block.timestamp + 1 hours + 1);
        (bool ok, , ) =
            paymaster.checkSponsorship(user, address(0xC0DE), castVoteSelector, address(membership));
        assertTrue(ok);
    }

    function test_AutoPausesBelowFloor() public {
        // Drain to just below floor.
        vm.prank(owner);
        paymaster.withdraw(payable(owner), address(paymaster).balance - 0.04 ether);
        (bool ok, , string memory reason) =
            paymaster.checkSponsorship(user, address(0xC0DE), castVoteSelector, address(membership));
        assertFalse(ok);
        assertEq(reason, "autopause: low balance");
    }

    function test_EnforcesDailyLimit() public {
        vm.prank(user);
        membership.joinOpen();
        vm.warp(block.timestamp + 2 hours);
        for (uint256 i; i < 10; ++i) {
            vm.prank(owner);
            paymaster.recordSponsorship(user, address(0xC0DE), castVoteSelector);
        }
        (bool ok, , string memory reason) =
            paymaster.checkSponsorship(user, address(0xC0DE), castVoteSelector, address(membership));
        assertFalse(ok);
        assertEq(reason, "daily limit reached");
    }

    function test_OnlyFundingWalletOrOwnerCanFund() public {
        vm.deal(address(0xDEAD), 1 ether);
        vm.prank(address(0xDEAD));
        (bool ok, ) = address(paymaster).call{value: 0.1 ether}("");
        assertFalse(ok);
    }
}
