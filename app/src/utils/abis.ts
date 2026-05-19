/**
 * abis.ts
 *
 * Centralized minimal Human-readable ABI string arrays for ethers v6.
 * Contains only the function/event signatures that Phase 4 plans actually call.
 */

// ---------------------------------------------------------------------------
// MembershipNFT ABI
// Used by: OrgDirectoryScreen (joinOpen), OrgInfoScreen (name/symbol/metadataURI)
// ---------------------------------------------------------------------------

export const MEMBERSHIP_NFT_ABI: string[] = [
  'function joinOpen() returns (uint256)',
  'function joinPolicy() view returns (uint8)',
  'function memberSince(address account) view returns (uint64)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function metadataURI() view returns (string)',
  'event MemberJoined(address indexed member, uint256 tokenId)',
];

// ---------------------------------------------------------------------------
// OrgGovernor ABI
// Used by: plan 04-03 (castVote, castVoteBySig, propose, execute, state, events)
// ---------------------------------------------------------------------------

export const ORG_GOVERNOR_ABI: string[] = [
  'function castVote(uint256 proposalId, uint8 support) returns (uint256)',
  'function castVoteBySig(uint256 proposalId, uint8 support, address voter, bytes signature) returns (uint256)',
  'function state(uint256 proposalId) view returns (uint8)',
  'function hasVoted(uint256 proposalId, address account) view returns (bool)',
  'function getVotes(address account, uint256 timepoint) view returns (uint256)',
  'function proposalSnapshot(uint256 proposalId) view returns (uint256)',
  'function proposalDeadline(uint256 proposalId) view returns (uint256)',
  'function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)',
  'function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) payable returns (uint256)',
  'function hashProposal(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) view returns (uint256)',
  'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)',
  'event ProposalExecuted(uint256 proposalId)',
  'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)',
];

// ---------------------------------------------------------------------------
// RecoveryRegistry ABI
// Used by: plan 04-04 (setDelegates, proposeRecovery, approveRecovery, executeRecovery,
//          cancelRecovery, delegatesOf, pendingRecovery, DelegatesSet event for threshold)
// ---------------------------------------------------------------------------

export const RECOVERY_REGISTRY_ABI: string[] = [
  'function setDelegates(address[] delegates, uint8 threshold)',
  'function proposeRecovery(address user, address newOwner, address[] orgs)',
  'function approveRecovery(address user)',
  'function executeRecovery(address user)',
  'function cancelRecovery()',
  'function delegatesOf(address user) view returns (address[])',
  'function pendingRecovery(address user) view returns (address newOwner, uint64 readyAt, uint8 approvals, address[] orgs)',
  'event DelegatesSet(address indexed user, address[] delegates, uint8 threshold)',
  'event RecoveryProposed(address indexed user, address newOwner)',
  'event RecoveryApproved(address indexed user, address approver)',
  'event RecoveryExecuted(address indexed user, address newOwner)',
  'event RecoveryCancelled(address indexed user)',
];
