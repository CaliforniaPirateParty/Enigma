// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Paymaster} from "../src/Paymaster.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {IPaymaster} from "account-abstraction/interfaces/IPaymaster.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @notice Fork test against the canonical ERC-4337 v0.7 EntryPoint deployed at
/// 0x0000000071727De22E5E9d8BAf0edAc6f37da032 on Base mainnet AND Base Sepolia.
///
/// Verifies that our Paymaster:
/// 1. Successfully deposits into the real EntryPoint via receive() → depositTo.
/// 2. Reports the correct balance via balanceOf(paymaster).
/// 3. Accepts validatePaymasterUserOp when called by the real EntryPoint address.
/// 4. Reverts validatePaymasterUserOp when called by anyone else.
/// 5. Lets the real EntryPoint pull funds out via withdrawTo.
///
/// Run with:
///   forge test --match-contract PaymasterForkTest \
///     --fork-url $BASE_SEPOLIA_RPC_URL -vv
///
/// Skipped automatically when no fork is configured (no BASE_SEPOLIA_RPC_URL set).
contract PaymasterForkTest is Test {
    using MessageHashUtils for bytes32;

    address constant ENTRYPOINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    Paymaster paymaster;
    MembershipNFT membership;

    address owner = address(0xA11CE);
    address user = address(0xBEEF);
    address governor = address(0xC0DE);
    uint256 signerPk = 0xA110C;
    address signer;

    bytes4 castVoteSelector = bytes4(keccak256("castVote(uint256,uint8)"));

    modifier onlyOnFork() {
        try vm.activeFork() returns (uint256) {
            _;
        } catch {
            vm.skip(true);
        }
    }

    function setUp() public {
        // If no fork is active, leave setUp a no-op; individual tests will skip.
        try vm.activeFork() returns (uint256) {
            signer = vm.addr(signerPk);

            // Sanity-check: the EntryPoint must exist on the fork.
            require(ENTRYPOINT_V07.code.length > 0, "EntryPoint v0.7 not deployed on this fork");

            vm.prank(owner);
            paymaster = new Paymaster(IEntryPoint(ENTRYPOINT_V07), signer, owner);
            membership =
                new MembershipNFT("ForkTest", "FT", "ipfs://m", MembershipNFT.JoinPolicy.Open, owner);

            vm.prank(owner);
            paymaster.setSelector(castVoteSelector, Paymaster.OpKind.CastVote, true);
        } catch {
            // No fork — tests will vm.skip.
        }
    }

    function test_DepositForwardsToRealEntryPoint() public onlyOnFork {
        uint256 amount = 0.5 ether;
        vm.deal(paymaster.FUNDING_WALLET(), amount);
        uint256 epBefore = IEntryPoint(ENTRYPOINT_V07).balanceOf(address(paymaster));
        vm.prank(paymaster.FUNDING_WALLET());
        (bool ok,) = address(paymaster).call{value: amount}("");
        assertTrue(ok, "funding call failed");
        uint256 epAfter = IEntryPoint(ENTRYPOINT_V07).balanceOf(address(paymaster));
        assertEq(epAfter - epBefore, amount, "deposit did not land in EntryPoint");
        assertEq(paymaster.depositBalance(), epAfter, "depositBalance() out of sync");
        assertEq(address(paymaster).balance, 0, "paymaster should hold no idle ETH");
    }

    function test_RealEntryPointCanCallValidate() public onlyOnFork {
        // Fund first so we're above the autopause floor.
        vm.deal(paymaster.FUNDING_WALLET(), 1 ether);
        vm.prank(paymaster.FUNDING_WALLET());
        (bool ok,) = address(paymaster).call{value: 0.5 ether}("");
        assertTrue(ok);

        PackedUserOperation memory op = _buildOp(
            uint48(block.timestamp + 5 minutes), 0, governor, castVoteSelector, address(membership), signerPk
        );

        // Prank as the real EntryPoint; validate must succeed.
        vm.prank(ENTRYPOINT_V07);
        (bytes memory ctx, uint256 vd) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);
        assertEq(vd & 1, 0, "signature should be valid");
        assertGt(ctx.length, 0);
    }

    function test_NonEntryPointCannotCallValidate() public onlyOnFork {
        PackedUserOperation memory op = _buildOp(
            uint48(block.timestamp + 5 minutes), 0, governor, castVoteSelector, address(membership), signerPk
        );
        vm.expectRevert(Paymaster.OnlyEntryPoint.selector);
        paymaster.validatePaymasterUserOp(op, bytes32(0), 0);
    }

    function test_RealEntryPointCanWithdraw() public onlyOnFork {
        vm.deal(paymaster.FUNDING_WALLET(), 1 ether);
        vm.prank(paymaster.FUNDING_WALLET());
        (bool ok,) = address(paymaster).call{value: 0.3 ether}("");
        assertTrue(ok);

        address payable to = payable(address(uint160(uint256(keccak256("enigma-fork-withdraw-recipient")))));
        uint256 toBefore = to.balance;
        vm.prank(owner);
        paymaster.withdrawTo(to, 0.2 ether);
        assertEq(to.balance - toBefore, 0.2 ether, "withdrawTo did not transfer");
        assertEq(paymaster.depositBalance(), 0.1 ether);
    }

    // ---- helpers --------------------------------------------------------------

    function _buildOp(uint48 validUntil, uint48 validAfter, address target, bytes4 selector, address m, uint256 pk)
        internal
        view
        returns (PackedUserOperation memory op)
    {
        bytes32 digest = paymaster.policyDigest(user, validUntil, validAfter, target, selector, m);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest.toEthSignedMessageHash());
        bytes memory sig = abi.encodePacked(r, s, v);
        bytes memory pmd = abi.encodePacked(
            address(paymaster), uint128(200_000), uint128(100_000), validUntil, validAfter, target, selector, m, sig
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
}
