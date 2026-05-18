// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MembershipNFT} from "./MembershipNFT.sol";
import {OrgGovernor} from "./OrgGovernor.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

/// @title OrgFactory — deploy a new (MembershipNFT, OrgGovernor) pair in one call.
contract OrgFactory {
    event OrgCreated(
        address indexed creator,
        address membership,
        address governor,
        string name
    );

    struct OrgParams {
        string name;
        string symbol;
        string metadataURI;
        uint48 votingDelay; // in blocks (Base ≈ 2s/block)
        uint32 votingPeriod; // in blocks
        uint256 proposalThreshold; // min NFTs to propose
        uint256 quorumPercent; // 0–100
        MembershipNFT.JoinPolicy joinPolicy;
    }

    function createOrg(OrgParams calldata p)
        external
        returns (address membership, address governor)
    {
        // Factory holds membership ownership temporarily so it can hand it to the Governor.
        MembershipNFT m = new MembershipNFT(p.name, p.symbol, p.metadataURI, p.joinPolicy, address(this));

        OrgGovernor g = new OrgGovernor(
            p.name,
            IVotes(address(m)),
            p.votingDelay,
            p.votingPeriod,
            p.proposalThreshold,
            p.quorumPercent
        );

        // Mint genesis token to creator so they can propose immediately.
        m.mintTo(msg.sender);

        // Transfer membership ownership: Open policy → creator (no admin minting needed);
        // Allowlist/Application → governor (DAO-controlled).
        if (p.joinPolicy == MembershipNFT.JoinPolicy.Open) {
            m.transferOwnership(msg.sender);
        } else {
            m.transferOwnership(address(g));
        }

        emit OrgCreated(msg.sender, address(m), address(g), p.name);
        return (address(m), address(g));
    }
}
