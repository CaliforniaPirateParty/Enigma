/**
 * proposalDetail.test.ts
 *
 * Tests for ProposalDetailScreen.
 * Uses react-test-renderer (Node-compatible).
 *
 * Four scenarios:
 *  a) Active proposal + user is member + no prior vote → For/Against/Abstain buttons;
 *     pressing For calls castSponsoredVote; on SponsorshipNotAvailable falls back to
 *     castDirectVote and shows tx hash.
 *  b) Active proposal + user already voted → "You voted" badge; no vote buttons; no execute button.
 *  c) Defeated proposal → "Voting closed" message; no execute button.
 *  d) Succeeded proposal + user is member → execute button present; tapping calls
 *     Contract.execute([], [], [], descriptionHash) with correct hash.
 */

import React from 'react';
import { act, create } from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROPOSAL_ID = 'prop-001';
const GOVERNOR_ADDR = '0xgov0000000000000000000000000000000000000001';
const DESCRIPTION = 'QmTestDescription1234567890123456789012345';
const USER_ADDRESS = '0xuseraddress123';
const MEMBERSHIP_ADDR = '0xmembership0000000000000000000000000000001';

const BASE_PROPOSAL = {
  id: PROPOSAL_ID,
  org: {
    id: MEMBERSHIP_ADDR,
    creator: '0xcreator',
    membership: MEMBERSHIP_ADDR,
    governor: GOVERNOR_ADDR,
    name: 'Test Org',
    symbol: 'TST',
    metadataURI: '',
    joinPolicy: 0,
    createdAt: '1',
    memberCount: 5,
  },
  proposer: '0xproposer',
  startBlock: '100',
  endBlock: '200',
  proposalBody: DESCRIPTION,
  canceledAt: null,
  eta: null,
  executedAt: null,
  createdAt: '1000',
  votesFor: '3',
  votesAgainst: '1',
  votesAbstain: '0',
};

const ACTIVE_PROPOSAL = { ...BASE_PROPOSAL, state: 1 };
const DEFEATED_PROPOSAL = { ...BASE_PROPOSAL, state: 3 };
const SUCCEEDED_PROPOSAL = { ...BASE_PROPOSAL, state: 4 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findByTestID(node: any, testID: string): any[] {
  if (!node) return [];
  if (typeof node !== 'object') return [];
  const results: any[] = [];
  if (node.props?.testID === testID) results.push(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      results.push(...findByTestID(child, testID));
    }
  }
  return results;
}

function findTextNodes(node: any, text: string): any[] {
  if (!node) return [];
  if (typeof node === 'string' && node.includes(text)) return [node];
  if (typeof node !== 'object') return [];
  const results: any[] = [];
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      results.push(...findTextNodes(child, text));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../hooks/useProposals', () => ({
  useProposalDetail: jest.fn(),
}));

jest.mock('../hooks/useOrgs', () => ({
  useOrgs: jest.fn(),
  useUserOrgs: jest.fn(),
}));

jest.mock('../context/WalletContext', () => ({
  useWallet: jest.fn(),
}));

jest.mock('../state/orgStore', () => ({
  useOrgStore: jest.fn((selector: any) => selector({ activeOrgId: MEMBERSHIP_ADDR })),
}));

jest.mock('../utils/proposalBody', () => ({
  resolveProposalBody: jest.fn().mockResolvedValue({ kind: 'plain', text: 'Proposal body text' }),
}));

const mockCastSponsoredVote = jest.fn();
const mockCastDirectVote = jest.fn();

jest.mock('../utils/sponsor', () => {
  class SponsorshipNotAvailable extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'SponsorshipNotAvailable';
    }
  }
  return {
    SponsorshipNotAvailable,
    castSponsoredVote: mockCastSponsoredVote,
    castDirectVote: mockCastDirectVote,
  };
});

const mockExecute = jest.fn();

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    Contract: jest.fn().mockImplementation(() => ({
      execute: mockExecute,
    })),
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function setupDefaultMocks() {
  const { useProposalDetail } = require('../hooks/useProposals');
  const { useUserOrgs, useOrgs } = require('../hooks/useOrgs');
  const { useWallet } = require('../context/WalletContext');

  useWallet.mockReturnValue({
    state: { identity: { address: USER_ADDRESS, chainId: 11155111 } },
    getSigner: jest.fn().mockResolvedValue({ getAddress: jest.fn().mockResolvedValue(USER_ADDRESS) }),
  });

  useOrgs.mockReturnValue({ data: [BASE_PROPOSAL.org], loading: false, error: null, refetch: jest.fn() });
  useUserOrgs.mockReturnValue({
    data: [BASE_PROPOSAL.org],
    loading: false,
    error: null,
    refetch: jest.fn(),
  });

  useProposalDetail.mockReturnValue({
    data: { proposal: ACTIVE_PROPOSAL, votes: [] },
    loading: false,
    error: null,
    refetch: jest.fn(),
  });
}

// ---------------------------------------------------------------------------
// Import screen (after mocks)
// ---------------------------------------------------------------------------

import ProposalDetailScreen from '../screens/Org/ProposalDetailScreen';
import { SponsorshipNotAvailable } from '../utils/sponsor';
import { ethers, Contract } from 'ethers';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  setupDefaultMocks();
  mockCastSponsoredVote.mockReset();
  mockCastDirectVote.mockReset();
  mockExecute.mockReset();
});

const DEFAULT_ROUTE = {
  params: { proposalId: PROPOSAL_ID, governor: GOVERNOR_ADDR, description: DESCRIPTION },
};

describe('ProposalDetailScreen', () => {
  test('a) Active proposal + member + no prior vote: shows vote buttons, fallback to direct vote', async () => {
    const { useRoute } = require('@react-navigation/native');
    useRoute.mockReturnValue(DEFAULT_ROUTE);

    // castSponsoredVote throws SponsorshipNotAvailable → UI falls back to castDirectVote
    mockCastSponsoredVote.mockRejectedValue(new SponsorshipNotAvailable('bundler_not_wired'));
    const mockTx = { hash: '0xvotehash', wait: jest.fn().mockResolvedValue({}) };
    mockCastDirectVote.mockResolvedValue(mockTx);

    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(ProposalDetailScreen));
    });

    const json = renderer.toJSON();
    // Vote buttons should be present
    const forButton = findByTestID(json, 'vote-for-button');
    expect(forButton.length).toBeGreaterThan(0);
    const againstButton = findByTestID(json, 'vote-against-button');
    expect(againstButton.length).toBeGreaterThan(0);
    const abstainButton = findByTestID(json, 'vote-abstain-button');
    expect(abstainButton.length).toBeGreaterThan(0);

    // Execute button should NOT be present (state is Active, not Succeeded)
    const execButton = findByTestID(json, 'execute-button');
    expect(execButton.length).toBe(0);

    // Press For button
    await act(async () => {
      await forButton[0].props.onPress();
    });

    // castSponsoredVote was called, then fallback to castDirectVote
    expect(mockCastSponsoredVote).toHaveBeenCalled();
    expect(mockCastDirectVote).toHaveBeenCalledWith(
      expect.objectContaining({ support: 1 })
    );
  });

  test('b) Active proposal + user already voted: shows badge, no vote buttons, no execute button', async () => {
    const { useRoute } = require('@react-navigation/native');
    useRoute.mockReturnValue(DEFAULT_ROUTE);

    const { useProposalDetail } = require('../hooks/useProposals');
    useProposalDetail.mockReturnValue({
      data: {
        proposal: ACTIVE_PROPOSAL,
        votes: [
          {
            id: 'vote-1',
            proposal: ACTIVE_PROPOSAL,
            voter: USER_ADDRESS.toLowerCase(),
            support: 1, // For
            weight: '1',
            reason: null,
            blockNumber: '150',
            castAt: '1500',
          },
        ],
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(ProposalDetailScreen));
    });

    const json = renderer.toJSON();
    // Vote buttons should NOT be present
    expect(findByTestID(json, 'vote-for-button').length).toBe(0);
    expect(findByTestID(json, 'vote-against-button').length).toBe(0);
    expect(findByTestID(json, 'vote-abstain-button').length).toBe(0);

    // Execute button should NOT be present (state is Active)
    expect(findByTestID(json, 'execute-button').length).toBe(0);

    // "You voted" badge should be present
    const voted = findTextNodes(json, 'You voted');
    expect(voted.length).toBeGreaterThan(0);
  });

  test('c) Defeated proposal: shows voting closed message, no execute button', async () => {
    const { useRoute } = require('@react-navigation/native');
    useRoute.mockReturnValue(DEFAULT_ROUTE);

    const { useProposalDetail } = require('../hooks/useProposals');
    useProposalDetail.mockReturnValue({
      data: { proposal: DEFEATED_PROPOSAL, votes: [] },
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(ProposalDetailScreen));
    });

    const json = renderer.toJSON();
    // Vote buttons should NOT be present
    expect(findByTestID(json, 'vote-for-button').length).toBe(0);
    // Execute button should NOT be present
    expect(findByTestID(json, 'execute-button').length).toBe(0);
    // Voting closed message
    const closed = findTextNodes(json, 'Voting closed');
    expect(closed.length).toBeGreaterThan(0);
  });

  test('d) Succeeded proposal + member: shows execute button; tapping calls execute with correct descriptionHash', async () => {
    const { useRoute } = require('@react-navigation/native');
    useRoute.mockReturnValue(DEFAULT_ROUTE);

    const { useProposalDetail } = require('../hooks/useProposals');
    useProposalDetail.mockReturnValue({
      data: { proposal: SUCCEEDED_PROPOSAL, votes: [] },
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const mockTx = { hash: '0xexechash', wait: jest.fn().mockResolvedValue({}) };
    mockExecute.mockResolvedValue(mockTx);

    // Re-mock Contract after clearAllMocks
    const { Contract: MockContract } = require('ethers');
    MockContract.mockImplementation(() => ({ execute: mockExecute }));

    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(ProposalDetailScreen));
    });

    const json = renderer.toJSON();
    // Execute button should be present
    const execButton = findByTestID(json, 'execute-button');
    expect(execButton.length).toBeGreaterThan(0);

    // Vote buttons should NOT be present (state is Succeeded, not Active)
    expect(findByTestID(json, 'vote-for-button').length).toBe(0);

    // Tap execute button
    await act(async () => {
      await execButton[0].props.onPress();
    });

    // Verify execute was called with correct args
    const expectedHash = ethers.keccak256(ethers.toUtf8Bytes(DESCRIPTION));
    expect(mockExecute).toHaveBeenCalledWith([], [], [], expectedHash);
  });
});
