// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {IPaymaster} from "account-abstraction/interfaces/IPaymaster.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";

/// @title Paymaster — Enigma shared ERC-4337 v0.7 verifying paymaster (hybrid policy).
///
/// Policy (locked 2026-05-18):
/// - Shared paymaster across all orgs in v1.
/// - Funding wallet: 0xFbfA21E9931F647Bd6cC5be9E1a0dd9a41DA535e (CPP treasury, Base).
/// - 10 sponsored ops per address per UTC day.
/// - Auto-pause when paymaster's EntryPoint deposit < AUTOPAUSE_FLOOR.
/// - Sponsored ops only: `castVote`, `castVoteBySig`, recovery selectors.
/// - Address must hold its MembershipNFT for ≥ 1 hour before votes are sponsored.
///
/// Hybrid split:
/// - Off-chain `policySigner` checks selector allowlist, target allowlist,
///   membership age, and per-org context, then signs `(sender, paymaster, validUntil,
///   validAfter, target, selector, membership)`.
/// - On-chain `validatePaymasterUserOp` checks the signature, autopause floor,
///   and per-day cap; `postOp` increments the counter so abuse is bounded even
///   if the signer misbehaves.
contract Paymaster is IPaymaster, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ---- Policy constants ------------------------------------------------------

    uint256 public constant DAILY_OP_LIMIT = 10;
    uint256 public constant AUTOPAUSE_FLOOR = 0.05 ether;
    uint64 public constant MEMBERSHIP_AGE = 1 hours; // informational; enforced by signer
    address public constant FUNDING_WALLET = 0xFbfA21E9931F647Bd6cC5be9E1a0dd9a41DA535e;

    enum OpKind {
        CastVote,
        CastVoteBySig,
        Recovery
    }

    // ---- ERC-4337 wiring -------------------------------------------------------

    IEntryPoint public immutable entryPoint;

    // ---- Mutable state ---------------------------------------------------------

    address public policySigner;
    bool public paused;

    /// @notice Selector → kind mapping for sponsored entrypoints. Owner-managed so we
    /// can add Governor.castVote / castVoteBySig variants and RecoveryRegistry
    /// selectors without redeploying.
    mapping(bytes4 => OpKind) public selectorKind;
    mapping(bytes4 => bool) public selectorAllowed;

    /// @notice usage[address][utcDay] → sponsored ops in that UTC day.
    mapping(address => mapping(uint32 => uint16)) public usage;

    // ---- Events ----------------------------------------------------------------

    event Funded(address indexed from, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed to, uint256 amount);
    event PausedSet(bool paused);
    event PolicySignerSet(address indexed signer);
    event SelectorSet(bytes4 indexed selector, OpKind kind, bool allowed);
    event Sponsored(
        address indexed user, address indexed target, bytes4 selector, OpKind kind, uint256 actualGasCost
    );

    // ---- Errors ----------------------------------------------------------------

    error NotFundingWallet();
    error OnlyEntryPoint();
    error InvalidSignature();
    error AutoPaused();
    error ManuallyPaused();
    error DailyLimit();
    error SelectorNotAllowed();

    // ---- Constructor -----------------------------------------------------------

    constructor(IEntryPoint entryPoint_, address policySigner_, address owner_) Ownable(owner_) {
        entryPoint = entryPoint_;
        policySigner = policySigner_;
        emit PolicySignerSet(policySigner_);
    }

    // ---- Funding ---------------------------------------------------------------

    /// @notice Accept ETH only from the funding wallet or owner, then forward into
    /// the EntryPoint deposit so it can be drawn for sponsored UserOps.
    receive() external payable {
        if (msg.sender != FUNDING_WALLET && msg.sender != owner()) revert NotFundingWallet();
        entryPoint.depositTo{value: msg.value}(address(this));
        emit Funded(msg.sender, msg.value, _depositBalance());
    }

    /// @notice Owner-only withdraw from the EntryPoint deposit.
    function withdrawTo(address payable to, uint256 amount) external onlyOwner {
        entryPoint.withdrawTo(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice ERC-4337 storage rule escape: stake this paymaster so it can read
    /// external contract storage during validation if we ever go fully on-chain.
    /// Not required for the hybrid path but kept for forward compatibility.
    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }

    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
    }

    function withdrawStake(address payable to) external onlyOwner {
        entryPoint.withdrawStake(to);
    }

    // ---- Admin -----------------------------------------------------------------

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedSet(p);
    }

    function setPolicySigner(address signer_) external onlyOwner {
        policySigner = signer_;
        emit PolicySignerSet(signer_);
    }

    function setSelector(bytes4 selector, OpKind kind, bool allowed) external onlyOwner {
        selectorKind[selector] = kind;
        selectorAllowed[selector] = allowed;
        emit SelectorSet(selector, kind, allowed);
    }

    // ---- IPaymaster ------------------------------------------------------------

    /// @inheritdoc IPaymaster
    function validatePaymasterUserOp(PackedUserOperation calldata userOp, bytes32, uint256)
        external
        override
        returns (bytes memory context, uint256 validationData)
    {
        if (msg.sender != address(entryPoint)) revert OnlyEntryPoint();
        if (paused) revert ManuallyPaused();
        if (_depositBalance() < AUTOPAUSE_FLOOR) revert AutoPaused();

        // paymasterAndData layout (v0.7):
        // [0:20]    paymaster address
        // [20:36]   verificationGasLimit (16 bytes)
        // [36:52]   postOpGasLimit       (16 bytes)
        // [52:58]   validUntil           (uint48)
        // [58:64]   validAfter           (uint48)
        // [64:84]   target               (address)
        // [84:88]   selector             (bytes4)
        // [88:108]  membership           (address; zero for recovery ops)
        // [108:173] signature            (65 bytes)
        bytes calldata pmd = userOp.paymasterAndData;
        require(pmd.length == 173, "paymasterAndData: bad length");

        uint48 validUntil = uint48(bytes6(pmd[52:58]));
        uint48 validAfter = uint48(bytes6(pmd[58:64]));
        address target = address(bytes20(pmd[64:84]));
        bytes4 selector = bytes4(pmd[84:88]);
        address membership = address(bytes20(pmd[88:108]));
        bytes calldata signature = pmd[108:173];

        if (!selectorAllowed[selector]) revert SelectorNotAllowed();
        if (usage[userOp.sender][_utcDay()] >= DAILY_OP_LIMIT) revert DailyLimit();

        bytes32 digest = _policyDigest(userOp.sender, validUntil, validAfter, target, selector, membership)
            .toEthSignedMessageHash();
        if (digest.recover(signature) != policySigner) revert InvalidSignature();

        OpKind kind = selectorKind[selector];
        context = abi.encode(userOp.sender, target, selector, kind);
        validationData = _packValidationData(false, validUntil, validAfter);
    }

    /// @inheritdoc IPaymaster
    function postOp(PostOpMode, bytes calldata context, uint256 actualGasCost, uint256) external override {
        if (msg.sender != address(entryPoint)) revert OnlyEntryPoint();
        (address user, address target, bytes4 selector, OpKind kind) =
            abi.decode(context, (address, address, bytes4, OpKind));
        usage[user][_utcDay()] += 1;
        emit Sponsored(user, target, selector, kind, actualGasCost);
    }

    // ---- Views & helpers -------------------------------------------------------

    function dailyUsage(address user) external view returns (uint16) {
        return usage[user][_utcDay()];
    }

    function depositBalance() external view returns (uint256) {
        return _depositBalance();
    }

    /// @notice The exact digest the off-chain signer must sign (before
    /// `toEthSignedMessageHash`). Exposed so the signing service can match it
    /// byte-for-byte.
    function policyDigest(
        address sender,
        uint48 validUntil,
        uint48 validAfter,
        address target,
        bytes4 selector,
        address membership
    ) external view returns (bytes32) {
        return _policyDigest(sender, validUntil, validAfter, target, selector, membership);
    }

    function _policyDigest(
        address sender,
        uint48 validUntil,
        uint48 validAfter,
        address target,
        bytes4 selector,
        address membership
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                block.chainid,
                address(this),
                sender,
                validUntil,
                validAfter,
                target,
                selector,
                membership
            )
        );
    }

    function _depositBalance() internal view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    function _utcDay() internal view returns (uint32) {
        return uint32(block.timestamp / 1 days);
    }

    /// @notice Pack (sigFailed, validUntil, validAfter) into the v0.7 validationData
    /// 256-bit return form used by the EntryPoint.
    function _packValidationData(bool sigFailed, uint48 validUntil, uint48 validAfter)
        internal
        pure
        returns (uint256)
    {
        return (sigFailed ? 1 : 0) | (uint256(validUntil) << 160) | (uint256(validAfter) << (160 + 48));
    }
}
