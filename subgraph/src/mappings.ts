import { BigInt, Bytes, log, store } from '@graphprotocol/graph-ts';
import { Org, Proposal, Member, Vote, RecoveryDelegate, Sponsorship, PaymasterStatus } from '../generated/schema';
import {
  Sponsored as SponsoredEvent,
  Funded as FundedEvent,
  Withdrawn as WithdrawnEvent,
  PausedSet as PausedSetEvent,
  PolicySignerSet as PolicySignerSetEvent,
} from '../generated/Paymaster/Paymaster';
import {
  OrgCreated as OrgCreatedEvent,
  OrgFactory,
} from '../generated/OrgFactory/OrgFactory';
import {
  MemberJoined as MemberJoinedEvent,
  MemberRemoved as MemberRemovedEvent,
  MembershipNFT,
} from '../generated/templates/MembershipNFT/MembershipNFT';
import {
  ProposalCreated as ProposalCreatedEvent,
  VoteCast as VoteCastEvent,
  ProposalCanceled as ProposalCanceledEvent,
  ProposalQueued as ProposalQueuedEvent,
  ProposalExecuted as ProposalExecutedEvent,
  OrgGovernor,
} from '../generated/templates/OrgGovernor/OrgGovernor';
import {
  DelegatesSet as DelegatesSetEvent,
} from '../generated/RecoveryRegistry/RecoveryRegistry';
import {
  MembershipNFT as MembershipNFTTemplate,
  OrgGovernor as OrgGovernorTemplate,
} from '../generated/templates';

// ---- OrgFactory handlers ----

export function handleOrgCreated(event: OrgCreatedEvent): void {
  let org = new Org(event.params.membership.toHex());
  org.creator = event.params.creator;
  org.membership = event.params.membership;
  org.governor = event.params.governor;
  org.name = event.params.name;
  org.symbol = ''; // Will be updated by MembershipNFT contract calls if needed
  org.metadataURI = '';
  org.joinPolicy = 0; // Default, will be set by actual events
  org.createdAt = event.block.timestamp;
  org.memberCount = 0;
  org.save();

  MembershipNFTTemplate.create(event.params.membership);
  OrgGovernorTemplate.create(event.params.governor);

  log.info('OrgCreated: {} by {}', [org.id, event.params.creator.toHex()]);
}

// ---- MembershipNFT handlers (one per org) ----

export function handleMemberJoined(event: MemberJoinedEvent): void {
  let orgId = event.address.toHex();
  let org = Org.load(orgId);
  if (org === null) {
    log.warning('Org {} not found when member joined', [orgId]);
    return;
  }

  let memberId = orgId + '-' + event.params.member.toHex();
  let member = new Member(memberId);
  member.org = orgId;
  member.address = event.params.member;
  member.tokenId = event.params.tokenId;
  member.mintedAt = event.block.timestamp;
  member.burnedAt = null;
  member.active = true;
  member.save();

  org.memberCount = org.memberCount + 1;
  org.save();

  log.info('Member joined {} in org {}', [event.params.member.toHex(), orgId]);
}

export function handleMemberRemoved(event: MemberRemovedEvent): void {
  let orgId = event.address.toHex();
  let org = Org.load(orgId);
  if (org === null) {
    log.warning('Org {} not found when member removed', [orgId]);
    return;
  }

  let memberId = orgId + '-' + event.params.member.toHex();
  let member = Member.load(memberId);
  if (member !== null) {
    member.burnedAt = event.block.timestamp;
    member.active = false;
    member.save();
  }

  org.memberCount = org.memberCount > 0 ? org.memberCount - 1 : 0;
  org.save();

  log.info('Member removed {} from org {}', [event.params.member.toHex(), orgId]);
}

// ---- OrgGovernor handlers (one per org) ----

export function handleProposalCreated(event: ProposalCreatedEvent): void {
  let orgId = event.address.toHex();
  let proposalId = orgId + '-' + event.params.proposalId.toString();

  let proposal = new Proposal(proposalId);
  proposal.org = orgId;
  proposal.proposer = event.params.proposer;
  proposal.startBlock = event.params.voteStart;
  proposal.endBlock = event.params.voteEnd;
  proposal.proposalBody = event.params.description;
  proposal.state = 0; // Pending
  proposal.canceledAt = null;
  proposal.eta = null;
  proposal.executedAt = null;
  proposal.createdAt = event.block.timestamp;
  proposal.votesFor = BigInt.zero();
  proposal.votesAgainst = BigInt.zero();
  proposal.votesAbstain = BigInt.zero();
  proposal.save();

  log.info('Proposal {} created in org {}', [proposalId, orgId]);
}

export function handleVoteCast(event: VoteCastEvent): void {
  let orgId = event.address.toHex();
  let proposalId = orgId + '-' + event.params.proposalId.toString();
  let voteId = proposalId + '-' + event.params.voter.toHex();

  let vote = new Vote(voteId);
  vote.proposal = proposalId;
  vote.org = orgId;
  vote.voter = event.params.voter;
  vote.support = event.params.support;
  vote.weight = event.params.weight;
  vote.reason = event.params.reason;
  vote.blockNumber = event.block.number;
  vote.castAt = event.block.timestamp;
  vote.save();

  // Update proposal vote tallies
  let proposal = Proposal.load(proposalId);
  if (proposal !== null) {
    if (event.params.support == 0) {
      proposal.votesAgainst = proposal.votesAgainst.plus(event.params.weight);
    } else if (event.params.support == 1) {
      proposal.votesFor = proposal.votesFor.plus(event.params.weight);
    } else if (event.params.support == 2) {
      proposal.votesAbstain = proposal.votesAbstain.plus(event.params.weight);
    }
    proposal.save();
  }

  log.info('Vote cast by {} in proposal {}', [event.params.voter.toHex(), proposalId]);
}

export function handleProposalCanceled(event: ProposalCanceledEvent): void {
  let orgId = event.address.toHex();
  let proposalId = orgId + '-' + event.params.proposalId.toString();

  let proposal = Proposal.load(proposalId);
  if (proposal !== null) {
    proposal.state = 2; // Canceled
    proposal.canceledAt = event.block.timestamp;
    proposal.save();
  }

  log.info('Proposal {} canceled', [proposalId]);
}

export function handleProposalQueued(event: ProposalQueuedEvent): void {
  let orgId = event.address.toHex();
  let proposalId = orgId + '-' + event.params.proposalId.toString();

  let proposal = Proposal.load(proposalId);
  if (proposal !== null) {
    proposal.state = 5; // Queued
    proposal.eta = event.params.etaSeconds;
    proposal.save();
  }

  log.info('Proposal {} queued', [proposalId]);
}

export function handleProposalExecuted(event: ProposalExecutedEvent): void {
  let orgId = event.address.toHex();
  let proposalId = orgId + '-' + event.params.proposalId.toString();

  let proposal = Proposal.load(proposalId);
  if (proposal !== null) {
    proposal.state = 6; // Executed
    proposal.executedAt = event.block.timestamp;
    proposal.save();
  }

  log.info('Proposal {} executed', [proposalId]);
}

// ---- RecoveryRegistry handlers ----

export function handleDelegatesSet(event: DelegatesSetEvent): void {
  let user = event.params.user;

  // Clear old delegates for this user
  let i = 0;
  let delegateId = user.toHex() + '-delegate-' + i.toString();
  while (RecoveryDelegate.load(delegateId) !== null) {
    store.remove('RecoveryDelegate', delegateId);
    i = i + 1;
    delegateId = user.toHex() + '-delegate-' + i.toString();
  }

  // Create new delegate entries for each delegate in the array
  let delegates = event.params.delegates;
  for (let j = 0; j < delegates.length; j++) {
    let delegate = delegates[j];
    let newDelegateId = user.toHex() + '-' + delegate.toHex();

    let recoveryDelegate = new RecoveryDelegate(newDelegateId);
    recoveryDelegate.user = user;
    recoveryDelegate.delegate = delegate;
    recoveryDelegate.addedAt = event.block.timestamp;
    recoveryDelegate.removedAt = null;
    recoveryDelegate.active = true;
    recoveryDelegate.save();
  }

  log.info('Delegates set for user {} with {} delegates', [user.toHex(), BigInt.fromI32(delegates.length).toString()]);
}

// ---- Paymaster handlers ----

const PAYMASTER_STATUS_ID = 'paymaster';

function loadStatus(): PaymasterStatus {
  let status = PaymasterStatus.load(PAYMASTER_STATUS_ID);
  if (status === null) {
    status = new PaymasterStatus(PAYMASTER_STATUS_ID);
    status.paused = false;
    status.policySigner = Bytes.fromHexString('0x0000000000000000000000000000000000000000') as Bytes;
    status.totalDeposited = BigInt.zero();
    status.totalWithdrawn = BigInt.zero();
    status.totalSponsored = BigInt.zero();
    status.updatedAt = BigInt.zero();
  }
  return status as PaymasterStatus;
}

export function handleSponsored(event: SponsoredEvent): void {
  let id = event.transaction.hash.toHex() + '-' + event.logIndex.toString();
  let sponsorship = new Sponsorship(id);
  sponsorship.user = event.params.user;
  sponsorship.target = event.params.target;
  sponsorship.selector = event.params.selector;
  sponsorship.kind = event.params.kind;
  sponsorship.actualGasCost = event.params.actualGasCost;
  sponsorship.blockNumber = event.block.number;
  sponsorship.timestamp = event.block.timestamp;
  sponsorship.txHash = event.transaction.hash;
  sponsorship.save();

  let status = loadStatus();
  status.totalSponsored = status.totalSponsored.plus(event.params.actualGasCost);
  status.updatedAt = event.block.timestamp;
  status.save();
}

export function handleFunded(event: FundedEvent): void {
  let status = loadStatus();
  status.totalDeposited = status.totalDeposited.plus(event.params.amount);
  status.updatedAt = event.block.timestamp;
  status.save();
}

export function handleWithdrawn(event: WithdrawnEvent): void {
  let status = loadStatus();
  status.totalWithdrawn = status.totalWithdrawn.plus(event.params.amount);
  status.updatedAt = event.block.timestamp;
  status.save();
}

export function handlePausedSet(event: PausedSetEvent): void {
  let status = loadStatus();
  status.paused = event.params.paused;
  status.updatedAt = event.block.timestamp;
  status.save();
}

export function handlePolicySignerSet(event: PolicySignerSetEvent): void {
  let status = loadStatus();
  status.policySigner = event.params.signer;
  status.updatedAt = event.block.timestamp;
  status.save();
}
