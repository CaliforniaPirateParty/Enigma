// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Paymaster} from "../src/Paymaster.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {MockEntryPoint} from "./mocks/MockEntryPoint.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {IPaymaster} from "account-abstraction/interfaces/IPaymaster.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract PaymasterTest is Test {
    using MessageHashUtils for bytes32;

    Paymaster paymaster;
    MockEntryPoint ep;
    MembershipNFT membership;

    address owner = address(0xA11CE);
    address user = address(0xBEEF);
    address governor = address(0xC0DE);
    uint256 signerPk = 0xA110C;
    address signer;

    bytes4 castVoteSelector = bytes4(keccak256("castVote(uint256,uint8)"));

    function setUp() public {
        signer = vm.addr(signerPk);
        ep = new MockEntryPoint();
        vm.prank(owner);
        paymaster = new Paymaster(IEntryPoint(address(ep)), signer, owner);
        membership = new MembershipNFT("Test", "TST", "ipfs://m", MembershipNFT.JoinPolicy.Open, owner);

        vm.prank(owner);
        paymaster.setSelector(castVoteSelector, Paymaster.OpKind.CastVote, true);

        // Fund the paymaster's EntryPoint deposit via the funding wallet.
        vm.deal(paymaster.FUNDING_WALLET(), 1 ether);
        vm.prank(paymaster.FUNDING_WALLET());
        (bool ok,) = address(paymaster).call{value: 0.5 ether}("");
        assertTrue(ok, "funding failed");
        assertEq(paymaster.depositBalance(), 0.5 ether);
    }

    // ---- Funding ----------------------------------------------------------

    function test_OnlyFundingWalletOrOwnerCanFund() public {
        vm.deal(address(0xDEAD), 1 ether);
        vm.prank(address(0xDEAD));
        (bool ok,) = address(paymaster).call{value: 0.1 ether}("");
        assertFalse(ok);
    }

    function test_OwnerCanWithdraw() public {
        address payable to = payable(address(0xCAFE));
        vm.prank(owner);
        paymaster.withdrawTo(to, 0.1 ether);
        assertEq(to.balance, 0.1 ether);
        assertEq(paymaster.depositBalance(), 0.4 ether);
    }

    // ---- Admin ------------------------------------------------------------

    function test_OwnerCanRotatePolicySigner() public {
        address newSigner = address(0x9999);
        vm.prank(owner);
        paymaster.setPolicySigner(newSigner);
        assertEq(paymaster.policySigner(), newSigner);
    }

    function test_OwnerCanPause() public {
        vm.prank(owner);
        paymaster.setPaused(true);
        assertTrue(paymaster.paused());
    }

    // ---- validatePaymasterUserOp ------------------------------------------

    function _buildOp(uint48 validUntil, uint48 validAfter, address target, bytes4 selector, address m, uint256 pk)
        internal
        view
        returns (PackedUserOperation memory op)
    {
        bytes32 digest = paymaster.policyDigest(user, validUntil, validAfter, target, selector, m);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest.toEthSignedMessageHash());
        bytes memory sig = abi.encodePacked(r, s, v);
        bytes memory pmd = abi.encodePacked(
            address(paymaster), // 20
            uint128(200_000), // verification gas
            uint128(100_000), // postOp gas
            validUntil, // 6
            validAfter, // 6
            target, // 20
            selector, // 4
            m, // 20
            sig // 65
        );
        op = PackedUserOperation({
            sender: user,
            nonce: 0,
            initCode: hex"",
            callData: hex"",
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: pmd,
            signature: hex""
        });
    }

    function test_ValidPolicySignaturePasses() public {
        PackedUserOperation memory op = _buildOp(uint48(block.timestamp + 1 hours), 0, governor, castVoteSelector, address(membership), signerPk);
        (bytes memory ctx, uint256 vd) = ep.callValidate(address(paymaster), op, bytes32(0), 0);
        // bit 0 must be clear (sigFailed == 0)
        assertEq(vd & 1, 0, "signature should be valid");
        assertGt(ctx.length, 0);
    }

    function test_RejectsForeignSignature() public {
        PackedUserOperation memory op =
            _buildOp(uint48(block.timestamp + 1 hours), 0, governor, castVoteSelector, address(membership), uint256(0xDEAD));
        vm.expectRevert(Paymaster.InvalidSignature.selector);
        ep.callValidate(address(paymaster), op, bytes32(0), 0);
    }

    function test_RejectsWhenPaused() public {
        vm.prank(owner);
        paymaster.setPaused(true);
        PackedUserOperation memory op = _buildOp(uint48(block.timestamp + 1 hours), 0, governor, castVoteSelector, address(membership), signerPk);
        vm.expectRevert(Paymaster.ManuallyPaused.selector);
        ep.callValidate(address(paymaster), op, bytes32(0), 0);
    }

    function test_RejectsWhenBelowAutopauseFloor() public {
        vm.prank(owner);
        paymaster.withdrawTo(payable(owner), 0.46 ether); // leaves 0.04 < 0.05 floor
        PackedUserOperation memory op = _buildOp(uint48(block.timestamp + 1 hours), 0, governor, castVoteSelector, address(membership), signerPk);
        vm.expectRevert(Paymaster.AutoPaused.selector);
        ep.callValidate(address(paymaster), op, bytes32(0), 0);
    }

    function test_RejectsWhenSelectorNotAllowed() public {
        bytes4 forbidden = bytes4(keccak256("ohNo()"));
        PackedUserOperation memory op = _buildOp(uint48(block.timestamp + 1 hours), 0, governor, forbidden, address(membership), signerPk);
        vm.expectRevert(Paymaster.SelectorNotAllowed.selector);
        ep.callValidate(address(paymaster), op, bytes32(0), 0);
    }

    function test_RejectsWhenDailyLimitHit() public {
        // postOp 10× to fill the counter.
        for (uint256 i; i < 10; ++i) {
            ep.callPostOp(
                address(paymaster),
                IPaymaster.PostOpMode.opSucceeded,
                abi.encode(user, governor, castVoteSelector, Paymaster.OpKind.CastVote),
                1
            );
        }
        PackedUserOperation memory op = _buildOp(uint48(block.timestamp + 1 hours), 0, governor, castVoteSelector, address(membership), signerPk);
        vm.expectRevert(Paymaster.DailyLimit.selector);
        ep.callValidate(address(paymaster), op, bytes32(0), 0);
    }

    function test_PostOpIncrementsCounter() public {
        assertEq(paymaster.dailyUsage(user), 0);
        ep.callPostOp(
            address(paymaster),
            IPaymaster.PostOpMode.opSucceeded,
            abi.encode(user, governor, castVoteSelector, Paymaster.OpKind.CastVote),
            1
        );
        assertEq(paymaster.dailyUsage(user), 1);
    }

    function test_OnlyEntryPointMayValidate() public {
        PackedUserOperation memory op = _buildOp(uint48(block.timestamp + 1 hours), 0, governor, castVoteSelector, address(membership), signerPk);
        vm.expectRevert(Paymaster.OnlyEntryPoint.selector);
        paymaster.validatePaymasterUserOp(op, bytes32(0), 0);
    }
}
