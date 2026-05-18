// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IPaymaster} from "account-abstraction/interfaces/IPaymaster.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";

/// @notice Bare-bones EntryPoint stand-in for unit tests: just enough surface for
/// Paymaster's deposit accounting and validate/postOp dispatch.
contract MockEntryPoint {
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public stakes;

    function depositTo(address account) external payable {
        balanceOf[account] += msg.value;
    }

    function withdrawTo(address payable to, uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "xfer failed");
    }

    function addStake(uint32) external payable {
        stakes[msg.sender] += msg.value;
    }

    function unlockStake() external {}

    function withdrawStake(address payable to) external {
        uint256 s = stakes[msg.sender];
        stakes[msg.sender] = 0;
        (bool ok,) = to.call{value: s}("");
        require(ok, "xfer failed");
    }

    /// @notice Call the paymaster's `validatePaymasterUserOp` as if we are the
    /// EntryPoint. Returns the context the paymaster produces.
    function callValidate(address paymaster, PackedUserOperation calldata op, bytes32 hash_, uint256 maxCost)
        external
        returns (bytes memory context, uint256 validationData)
    {
        return IPaymaster(paymaster).validatePaymasterUserOp(op, hash_, maxCost);
    }

    /// @notice Call the paymaster's `postOp` as if we are the EntryPoint.
    function callPostOp(address paymaster, IPaymaster.PostOpMode mode, bytes calldata context, uint256 actualGasCost)
        external
    {
        IPaymaster(paymaster).postOp(mode, context, actualGasCost, 0);
    }

    receive() external payable {}
}
