// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {RecoveryRegistry} from "../src/RecoveryRegistry.sol";

contract RecoveryRegistryTest is Test {
    RecoveryRegistry registry;

    address user     = address(0xA001);
    address d1       = address(0xD001);
    address d2       = address(0xD002);
    address d3       = address(0xD003);
    address d4       = address(0xD004);
    address d5       = address(0xD005);
    address newOwner = address(0xBEEF);

    address[] threeDelegates;
    address[] fiveDelegates;

    function setUp() public {
        registry = new RecoveryRegistry();
        threeDelegates = [d1, d2, d3];
        fiveDelegates  = [d1, d2, d3, d4, d5];
    }

    // --- setDelegates validation ---

    function test_SetDelegates_3Works() public {
        vm.prank(user);
        registry.setDelegates(threeDelegates, 2);
        address[] memory stored = registry.delegatesOf(user);
        assertEq(stored.length, 3);
    }

    function test_SetDelegates_5Works() public {
        vm.prank(user);
        registry.setDelegates(fiveDelegates, 3);
        assertEq(registry.delegatesOf(user).length, 5);
    }

    function test_SetDelegates_2Reverts() public {
        address[] memory two = new address[](2);
        two[0] = d1; two[1] = d2;
        vm.prank(user);
        vm.expectRevert(RecoveryRegistry.BadDelegateCount.selector);
        registry.setDelegates(two, 2);
    }

    function test_SetDelegates_6Reverts() public {
        address[] memory six = new address[](6);
        for (uint256 i; i < 6; ++i) six[i] = address(uint160(i + 1));
        vm.prank(user);
        vm.expectRevert(RecoveryRegistry.BadDelegateCount.selector);
        registry.setDelegates(six, 4);
    }

    function test_SetDelegates_MinorityThresholdReverts() public {
        // 3 delegates, threshold 1 (not majority: 1*2 <= 3)
        vm.prank(user);
        vm.expectRevert(RecoveryRegistry.BadThreshold.selector);
        registry.setDelegates(threeDelegates, 1);
    }

    function test_SetDelegates_ZeroThresholdReverts() public {
        vm.prank(user);
        vm.expectRevert(RecoveryRegistry.BadThreshold.selector);
        registry.setDelegates(threeDelegates, 0);
    }

    function test_SetDelegates_ExceedsCountReverts() public {
        vm.prank(user);
        vm.expectRevert(RecoveryRegistry.BadThreshold.selector);
        registry.setDelegates(threeDelegates, 4);
    }

    // --- proposeRecovery ---

    function _setup() internal {
        vm.prank(user);
        registry.setDelegates(threeDelegates, 2);
    }

    function test_ProposeRecovery_ByDelegate() public {
        _setup();
        address[] memory orgs;
        vm.prank(d1);
        registry.proposeRecovery(user, newOwner, orgs);
        (address no, uint64 readyAt, uint8 approvals,) = registry.pendingRecovery(user);
        assertEq(no, newOwner);
        assertEq(readyAt, block.timestamp + 7 days);
        assertEq(approvals, 1);
    }

    function test_ProposeRecovery_NonDelegateReverts() public {
        _setup();
        address[] memory orgs;
        vm.prank(address(0xBAD));
        vm.expectRevert(RecoveryRegistry.NotDelegate.selector);
        registry.proposeRecovery(user, newOwner, orgs);
    }

    function test_ProposeRecovery_UninitializedReverts() public {
        address[] memory orgs;
        address newUser = address(0xCA11);
        vm.prank(d1);
        vm.expectRevert(RecoveryRegistry.NotInitialized.selector);
        registry.proposeRecovery(newUser, newOwner, orgs);
    }

    // --- approveRecovery ---

    function test_ApproveRecovery_AddsApproval() public {
        _setup();
        address[] memory orgs;
        vm.prank(d1);
        registry.proposeRecovery(user, newOwner, orgs);
        vm.prank(d2);
        registry.approveRecovery(user);
        (,, uint8 approvals,) = registry.pendingRecovery(user);
        assertEq(approvals, 2);
    }

    function test_ApproveRecovery_DoubleApproveReverts() public {
        _setup();
        address[] memory orgs;
        vm.prank(d1);
        registry.proposeRecovery(user, newOwner, orgs);
        vm.prank(d1);
        vm.expectRevert(RecoveryRegistry.AlreadyApproved.selector);
        registry.approveRecovery(user);
    }

    function test_ApproveRecovery_NoPendingReverts() public {
        _setup();
        vm.prank(d1);
        vm.expectRevert(RecoveryRegistry.NoPending.selector);
        registry.approveRecovery(user);
    }

    // --- executeRecovery ---

    function test_ExecuteRecovery_BeforeTimelockReverts() public {
        _setup();
        address[] memory orgs;
        vm.prank(d1);
        registry.proposeRecovery(user, newOwner, orgs);
        vm.prank(d2);
        registry.approveRecovery(user);
        vm.expectRevert(RecoveryRegistry.TimelockActive.selector);
        registry.executeRecovery(user);
    }

    function test_ExecuteRecovery_BelowThresholdReverts() public {
        _setup();
        address[] memory orgs;
        vm.prank(d1);
        registry.proposeRecovery(user, newOwner, orgs);
        // Only 1 approval (d1 from propose); threshold is 2
        vm.warp(block.timestamp + 7 days + 1);
        vm.expectRevert("below threshold");
        registry.executeRecovery(user);
    }

    function test_ExecuteRecovery_AfterTimelockAndThreshold_Succeeds() public {
        _setup();
        address[] memory orgs;
        vm.prank(d1);
        registry.proposeRecovery(user, newOwner, orgs);
        vm.prank(d2);
        registry.approveRecovery(user);
        vm.warp(block.timestamp + 7 days + 1);
        vm.expectEmit(true, true, false, false);
        emit RecoveryRegistry.RecoveryExecuted(user, newOwner);
        registry.executeRecovery(user);
        // pendingRecovery should be cleared
        (address no,,, ) = registry.pendingRecovery(user);
        assertEq(no, address(0));
    }

    // --- cancelRecovery ---

    function test_CancelRecovery() public {
        _setup();
        address[] memory orgs;
        vm.prank(d1);
        registry.proposeRecovery(user, newOwner, orgs);
        vm.prank(user);
        registry.cancelRecovery();
        (address no, uint64 readyAt,,) = registry.pendingRecovery(user);
        assertEq(no, address(0));
        assertEq(readyAt, 0);
    }

    // --- Re-propose resets approvals ---

    function test_RePropose_ResetsApprovals() public {
        _setup();
        address[] memory orgs;
        vm.prank(d1);
        registry.proposeRecovery(user, newOwner, orgs);
        vm.prank(d2);
        registry.approveRecovery(user);
        // Re-propose resets
        address otherOwner = address(0xF001);
        vm.prank(d3);
        registry.proposeRecovery(user, otherOwner, orgs);
        (,, uint8 approvals,) = registry.pendingRecovery(user);
        assertEq(approvals, 1); // only d3's implicit approval from propose
    }
}
