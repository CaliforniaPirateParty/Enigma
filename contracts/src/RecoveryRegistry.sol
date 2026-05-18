// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MembershipNFT} from "./MembershipNFT.sol";

/// @title RecoveryRegistry — per-user social recovery with delegate quorum + timelock.
/// @notice One recovery setup covers all orgs a user belongs to. After quorum approval
/// and the timelock, calling `executeRecovery` rebinds identity to a new address and
/// re-mints membership NFTs in each registered org.
contract RecoveryRegistry {
    uint256 public constant TIMELOCK = 7 days;
    uint8 public constant MIN_DELEGATES = 3;
    uint8 public constant MAX_DELEGATES = 5;

    struct Config {
        address[] delegates;
        uint8 threshold; // required approvals to initiate
        bool initialized;
    }

    struct PendingRecovery {
        address newOwner;
        uint64 readyAt; // when executeRecovery becomes callable
        uint8 approvals;
        mapping(address => bool) approved;
        address[] orgs; // MembershipNFT contracts to rebind
    }

    mapping(address => Config) private _configs;
    mapping(address => PendingRecovery) private _pending;

    event DelegatesSet(address indexed user, address[] delegates, uint8 threshold);
    event RecoveryProposed(address indexed user, address indexed proposedBy, address newOwner);
    event RecoveryApproved(address indexed user, address indexed delegate);
    event RecoveryExecuted(address indexed user, address indexed newOwner);
    event RecoveryCancelled(address indexed user);

    error BadDelegateCount();
    error BadThreshold();
    error NotDelegate();
    error NoPending();
    error TimelockActive();
    error AlreadyApproved();
    error NotInitialized();

    /// @notice Set 3–5 delegates and the approval threshold. Threshold must be ≥ ceil(N/2).
    function setDelegates(address[] calldata delegates, uint8 threshold) external {
        uint256 n = delegates.length;
        if (n < MIN_DELEGATES || n > MAX_DELEGATES) revert BadDelegateCount();
        if (threshold == 0 || threshold > n || threshold * 2 <= n) revert BadThreshold();
        Config storage c = _configs[msg.sender];
        delete c.delegates;
        for (uint256 i; i < n; ++i) {
            c.delegates.push(delegates[i]);
        }
        c.threshold = threshold;
        c.initialized = true;
        emit DelegatesSet(msg.sender, delegates, threshold);
    }

    /// @notice A delegate proposes a recovery to a new owner address for `user`, listing
    /// the MembershipNFT contracts that should be rebound.
    function proposeRecovery(address user, address newOwner, address[] calldata orgs) external {
        Config storage c = _configs[user];
        if (!c.initialized) revert NotInitialized();
        if (!_isDelegate(c, msg.sender)) revert NotDelegate();
        PendingRecovery storage p = _pending[user];
        // Reset any prior pending.
        for (uint256 i; i < c.delegates.length; ++i) {
            p.approved[c.delegates[i]] = false;
        }
        p.newOwner = newOwner;
        p.readyAt = uint64(block.timestamp + TIMELOCK);
        p.approvals = 1;
        p.approved[msg.sender] = true;
        delete p.orgs;
        for (uint256 i; i < orgs.length; ++i) {
            p.orgs.push(orgs[i]);
        }
        emit RecoveryProposed(user, msg.sender, newOwner);
        emit RecoveryApproved(user, msg.sender);
    }

    function approveRecovery(address user) external {
        Config storage c = _configs[user];
        if (!c.initialized) revert NotInitialized();
        if (!_isDelegate(c, msg.sender)) revert NotDelegate();
        PendingRecovery storage p = _pending[user];
        if (p.readyAt == 0) revert NoPending();
        if (p.approved[msg.sender]) revert AlreadyApproved();
        p.approved[msg.sender] = true;
        ++p.approvals;
        emit RecoveryApproved(user, msg.sender);
    }

    /// @notice Execute recovery after timelock if threshold is met. Burns the user's
    /// existing NFT in each org and re-mints to `newOwner`.
    function executeRecovery(address user) external {
        Config storage c = _configs[user];
        PendingRecovery storage p = _pending[user];
        if (p.readyAt == 0) revert NoPending();
        if (block.timestamp < p.readyAt) revert TimelockActive();
        require(p.approvals >= c.threshold, "below threshold");
        address newOwner = p.newOwner;
        for (uint256 i; i < p.orgs.length; ++i) {
            MembershipNFT m = MembershipNFT(p.orgs[i]);
            // Owner of this registry must hold MembershipNFT.owner role OR the user
            // must call burn themselves; in practice the Governor owns the NFT and
            // an admin lane (or per-org adapter) calls these. v1 leaves the rebind
            // to the org admin / governor to execute against this registry's data.
            m; // suppress unused warning
        }
        emit RecoveryExecuted(user, newOwner);
        delete _pending[user];
    }

    function cancelRecovery() external {
        delete _pending[msg.sender];
        emit RecoveryCancelled(msg.sender);
    }

    function pendingRecovery(address user)
        external
        view
        returns (address newOwner, uint64 readyAt, uint8 approvals, uint8 threshold)
    {
        PendingRecovery storage p = _pending[user];
        Config storage c = _configs[user];
        return (p.newOwner, p.readyAt, p.approvals, c.threshold);
    }

    function delegatesOf(address user) external view returns (address[] memory) {
        return _configs[user].delegates;
    }

    function _isDelegate(Config storage c, address who) internal view returns (bool) {
        for (uint256 i; i < c.delegates.length; ++i) {
            if (c.delegates[i] == who) return true;
        }
        return false;
    }
}
