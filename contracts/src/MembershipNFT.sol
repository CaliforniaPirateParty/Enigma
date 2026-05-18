// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Votes} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Votes.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MembershipNFT — soulbound ERC-721 with ERC-721Votes for one org.
/// @notice One token per member. Transfers are blocked; only mint and burn allowed.
contract MembershipNFT is ERC721, ERC721Votes, Ownable {
    enum JoinPolicy {
        Open,        // Anyone can self-mint via `joinOpen()`.
        Allowlist,   // Only `owner` (initially creator; can be Governor) mints.
        Application  // Same as Allowlist but expected to be gated by an off-chain or
                     // on-chain application contract calling `mintTo`.
    }

    JoinPolicy public joinPolicy;
    string public metadataURI; // IPFS CID for org info
    uint256 private _nextId;

    /// @notice When each address received its current membership. Used by the Paymaster
    /// age gate (≥ 1 hour before sponsoring votes for that org).
    mapping(address => uint64) public memberSince;

    error TransfersDisabled();
    error AlreadyMember(address who);
    error NotOpen();

    event JoinPolicySet(JoinPolicy policy);
    event MetadataURISet(string uri);
    event MemberJoined(address indexed member, uint256 tokenId);
    event MemberRemoved(address indexed member, uint256 tokenId);

    constructor(string memory name_, string memory symbol_, string memory metadataURI_, JoinPolicy policy, address owner_)
        ERC721(name_, symbol_)
        EIP712(name_, "1")
        Ownable(owner_)
    {
        metadataURI = metadataURI_;
        joinPolicy = policy;
        emit JoinPolicySet(policy);
        emit MetadataURISet(metadataURI_);
    }

    /// @notice Self-mint when policy is `Open`.
    function joinOpen() external returns (uint256 tokenId) {
        if (joinPolicy != JoinPolicy.Open) revert NotOpen();
        return _mintTo(msg.sender);
    }

    /// @notice Owner-only mint for Allowlist/Application policies. Owner is typically
    /// the org creator initially; ownership can be transferred to the Governor.
    function mintTo(address to) external onlyOwner returns (uint256 tokenId) {
        return _mintTo(to);
    }

    function _mintTo(address to) internal returns (uint256 tokenId) {
        if (balanceOf(to) != 0) revert AlreadyMember(to);
        tokenId = ++_nextId;
        _safeMint(to, tokenId);
        memberSince[to] = uint64(block.timestamp);
        emit MemberJoined(to, tokenId);
    }

    /// @notice Burn a member's NFT — used by Governor or RecoveryRegistry for offboarding
    /// / identity rebinding.
    function burn(uint256 tokenId) external {
        address holder = _ownerOf(tokenId);
        require(holder != address(0), "no token");
        require(msg.sender == owner() || msg.sender == holder, "not authorized");
        _burn(tokenId);
        delete memberSince[holder];
        emit MemberRemoved(holder, tokenId);
    }

    function setJoinPolicy(JoinPolicy policy) external onlyOwner {
        joinPolicy = policy;
        emit JoinPolicySet(policy);
    }

    function setMetadataURI(string calldata uri) external onlyOwner {
        metadataURI = uri;
        emit MetadataURISet(uri);
    }

    // ---- Soulbound enforcement -------------------------------------------------

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Votes) returns (address) {
        address from = _ownerOf(tokenId);
        // Allow mint (from == 0) and burn (to == 0); block all transfers.
        if (from != address(0) && to != address(0)) revert TransfersDisabled();
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Votes) {
        super._increaseBalance(account, value);
    }
}
