// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MembershipNFT} from "./MembershipNFT.sol";

/// @title Paymaster — Enigma shared ERC-4337 verifying paymaster.
/// @notice Sponsors gas for `castVote`, `castVoteBySig`, and recovery operations only.
///
/// Policy (locked 2026-05-18):
/// - Shared paymaster across all orgs in v1.
/// - Funding wallet: 0xFbfA21E9931F647Bd6cC5be9E1a0dd9a41DA535e (CPP treasury, Base).
/// - 10 sponsored ops per address per UTC day.
/// - Auto-pause when balance < AUTOPAUSE_FLOOR.
/// - Address must hold its MembershipNFT for ≥ MEMBERSHIP_AGE before votes are sponsored
///   for that org. Recovery ops are exempt from the age gate.
///
/// @dev This is the policy/accounting layer. The ERC-4337 EntryPoint integration
/// (`validatePaymasterUserOp` / `postOp`) is intentionally not wired here — see
/// `docs/paymaster.md` for the v0.7 EntryPoint plan. Hooking it on is mechanical
/// once the policy lands.
contract Paymaster is Ownable {
    uint256 public constant DAILY_OP_LIMIT = 10;
    uint256 public constant AUTOPAUSE_FLOOR = 0.05 ether;
    uint64 public constant MEMBERSHIP_AGE = 1 hours;

    /// @notice The funding wallet that may top up this paymaster.
    address public constant FUNDING_WALLET = 0xFbfA21E9931F647Bd6cC5be9E1a0dd9a41DA535e;

    enum OpKind { CastVote, CastVoteBySig, Recovery }

    bool public paused;

    /// @notice Selector → kind mapping for sponsored entrypoints. Owner-managed so we
    /// can add Governor.castVote / castVoteBySig / castVoteWithReason variants and
    /// RecoveryRegistry method selectors without redeploying.
    mapping(bytes4 => OpKind) public selectorKind;
    mapping(bytes4 => bool) public selectorAllowed;

    /// @notice usage[address][utcDay] — count of sponsored ops in that UTC day.
    mapping(address => mapping(uint32 => uint16)) public usage;

    event Funded(address indexed from, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed to, uint256 amount);
    event PausedSet(bool paused);
    event SelectorSet(bytes4 indexed selector, OpKind kind, bool allowed);
    event Sponsored(address indexed user, address indexed target, bytes4 selector, OpKind kind);

    error NotFundingWallet();
    error AutoPaused();
    error ManuallyPaused();
    error DailyLimit();
    error SelectorNotAllowed();
    error MembershipTooNew();

    constructor(address owner_) Ownable(owner_) {}

    receive() external payable {
        if (msg.sender != FUNDING_WALLET && msg.sender != owner()) revert NotFundingWallet();
        emit Funded(msg.sender, msg.value, address(this).balance);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
        emit Withdrawn(to, amount);
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedSet(p);
    }

    function setSelector(bytes4 selector, OpKind kind, bool allowed) external onlyOwner {
        selectorKind[selector] = kind;
        selectorAllowed[selector] = allowed;
        emit SelectorSet(selector, kind, allowed);
    }

    /// @notice Off-chain validator (or EntryPoint adapter) calls this view to decide
    /// whether to sponsor a userOp. Returns the kind so the caller can also enforce
    /// per-kind gas caps if desired.
    /// @param user     Smart-account owner / sender that benefits from sponsorship.
    /// @param target   Contract being called (Governor or RecoveryRegistry).
    /// @param selector First 4 bytes of calldata.
    /// @param membership Per-org MembershipNFT (zero address for recovery ops).
    function checkSponsorship(address user, address target, bytes4 selector, address membership)
        public
        view
        returns (bool ok, OpKind kind, string memory reason)
    {
        if (paused) return (false, OpKind.CastVote, "paused");
        if (address(this).balance < AUTOPAUSE_FLOOR) return (false, OpKind.CastVote, "autopause: low balance");
        if (!selectorAllowed[selector]) return (false, OpKind.CastVote, "selector not allowed");

        kind = selectorKind[selector];

        if (kind == OpKind.CastVote || kind == OpKind.CastVoteBySig) {
            if (membership == address(0)) return (false, kind, "membership required for vote sponsorship");
            uint64 since = MembershipNFT(membership).memberSince(user);
            if (since == 0 || block.timestamp < since + MEMBERSHIP_AGE) {
                return (false, kind, "membership age below 1 hour");
            }
        }

        uint16 used = usage[user][_utcDay()];
        if (used >= DAILY_OP_LIMIT) return (false, kind, "daily limit reached");

        target; // unused in v1; reserved for per-target allowlists in v2.
        return (true, kind, "");
    }

    /// @notice Called by the EntryPoint adapter on successful sponsorship to increment
    /// the per-day counter. Owner-only so a misbehaving adapter cannot drain counters
    /// from outside the protocol.
    function recordSponsorship(address user, address target, bytes4 selector) external onlyOwner {
        OpKind kind = selectorKind[selector];
        usage[user][_utcDay()] += 1;
        emit Sponsored(user, target, selector, kind);
    }

    function dailyUsage(address user) external view returns (uint16) {
        return usage[user][_utcDay()];
    }

    function _utcDay() internal view returns (uint32) {
        return uint32(block.timestamp / 1 days);
    }
}
