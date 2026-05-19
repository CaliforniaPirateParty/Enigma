/**
 * orgDirectory.test.ts
 *
 * Tests for OrgDirectoryScreen.
 * Uses react-test-renderer (Node-compatible) to avoid @testing-library/react-native.
 *
 * Mocks: useOrgs, useUserOrgs, useWallet, ethers Contract
 */

import React from 'react';
import { act, create } from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_OPEN_NOT_JOINED = {
  id: '0xopen111',
  creator: '0xcreator',
  membership: '0xopen111',
  governor: '0xgov111',
  name: 'Open Org',
  symbol: 'OPN',
  metadataURI: 'ipfs://open',
  joinPolicy: 0,
  createdAt: '1000',
  memberCount: 5,
};

const ORG_OPEN_JOINED = {
  id: '0xjoin222',
  creator: '0xcreator',
  membership: '0xjoin222',
  governor: '0xgov222',
  name: 'Joined Org',
  symbol: 'JND',
  metadataURI: 'ipfs://joined',
  joinPolicy: 0,
  createdAt: '2000',
  memberCount: 10,
};

const ORG_ALLOWLIST = {
  id: '0xallow333',
  creator: '0xcreator',
  membership: '0xallow333',
  governor: '0xgov333',
  name: 'Allowlist Org',
  symbol: 'ALW',
  metadataURI: 'ipfs://allow',
  joinPolicy: 1,
  createdAt: '3000',
  memberCount: 3,
};

const USER_ADDRESS = '0xuseraddr';

// ---------------------------------------------------------------------------
// Mock useOrgs and useUserOrgs
// ---------------------------------------------------------------------------

const mockRefetchUserOrgs = jest.fn().mockResolvedValue(undefined);

jest.mock('../hooks/useOrgs', () => ({
  useOrgs: jest.fn(),
  useUserOrgs: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock useWallet
// ---------------------------------------------------------------------------

const mockGetSigner = jest.fn();

jest.mock('../context/WalletContext', () => ({
  useWallet: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock ethers
// ---------------------------------------------------------------------------

const mockJoinOpen = jest.fn();
const mockWait = jest.fn().mockResolvedValue({});

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    Contract: jest.fn(),
  };
});

// ---------------------------------------------------------------------------
// Mock Alert — standalone stub, no requireActual in Node env
// ---------------------------------------------------------------------------

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Import the component under test
// ---------------------------------------------------------------------------

import OrgDirectoryScreen from '../screens/Org/OrgDirectoryScreen';

// ---------------------------------------------------------------------------
// Helper: flatten the react-test-renderer tree to find all nodes
// ---------------------------------------------------------------------------

function findAllNodes(root: any, predicate: (node: any) => boolean): any[] {
  const results: any[] = [];
  function traverse(node: any) {
    if (!node) return;
    if (predicate(node)) results.push(node);
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  }
  traverse(root);
  return results;
}

function findTextNodes(root: any, text: string): any[] {
  return findAllNodes(root, (n) => typeof n === 'string' && n.includes(text));
}

function findByTestID(root: any, testID: string): any[] {
  return findAllNodes(root, (n) => n?.props?.testID === testID);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrgDirectoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJoinOpen.mockResolvedValue({ hash: '0xdeadbeef', wait: mockWait });
    mockWait.mockResolvedValue({});
    mockGetSigner.mockResolvedValue({
      getAddress: jest.fn().mockResolvedValue(USER_ADDRESS),
    });

    // Re-set ethers.Contract mock after clearAllMocks()
    const { Contract } = require('ethers');
    Contract.mockImplementation(() => ({
      joinOpen: mockJoinOpen,
    }));

    // Re-set useWallet implementation after clearAllMocks() cleared it
    const { useWallet } = require('../context/WalletContext');
    useWallet.mockReturnValue({
      state: { identity: { address: USER_ADDRESS, chainId: 11155111 } },
      getSigner: mockGetSigner,
    });

    // Re-set useOrgs/useUserOrgs after clearAllMocks()
    const { useOrgs, useUserOrgs } = require('../hooks/useOrgs');
    useOrgs.mockReturnValue({
      data: [ORG_OPEN_NOT_JOINED, ORG_OPEN_JOINED, ORG_ALLOWLIST],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    useUserOrgs.mockReturnValue({
      data: [ORG_OPEN_JOINED],
      loading: false,
      error: null,
      refetch: mockRefetchUserOrgs,
    });
  });

  it('renders org names for all orgs', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(OrgDirectoryScreen));
    });
    const json = renderer.toJSON();
    const openOrgName = findTextNodes(json, 'Open Org');
    const joinedOrgName = findTextNodes(json, 'Joined Org');
    const allowlistOrgName = findTextNodes(json, 'Allowlist Org');
    expect(openOrgName.length).toBeGreaterThan(0);
    expect(joinedOrgName.length).toBeGreaterThan(0);
    expect(allowlistOrgName.length).toBeGreaterThan(0);
  });

  it('renders exactly one Join button for open + non-member org', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(OrgDirectoryScreen));
    });
    const json = renderer.toJSON();
    // Only ORG_OPEN_NOT_JOINED should have a Join button
    const joinButtons = findByTestID(json, `join-btn-${ORG_OPEN_NOT_JOINED.id}`);
    expect(joinButtons.length).toBe(1);
  });

  it('shows Joined badge for already-joined org, not a Join button', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(OrgDirectoryScreen));
    });
    const json = renderer.toJSON();
    const joinedBadge = findByTestID(json, `joined-badge-${ORG_OPEN_JOINED.id}`);
    const joinButton = findByTestID(json, `join-btn-${ORG_OPEN_JOINED.id}`);
    expect(joinedBadge.length).toBe(1);
    expect(joinButton.length).toBe(0);
  });

  it('shows Allowlist badge (not Join button) for non-open org', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(OrgDirectoryScreen));
    });
    const json = renderer.toJSON();
    const allowlistBadge = findByTestID(json, `policy-badge-${ORG_ALLOWLIST.id}`);
    const joinButton = findByTestID(json, `join-btn-${ORG_ALLOWLIST.id}`);
    expect(allowlistBadge.length).toBe(1);
    expect(joinButton.length).toBe(0);
  });

  it('calls joinOpen() when Join button is pressed', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(OrgDirectoryScreen));
    });
    const json = renderer.toJSON();
    const joinButtons = findByTestID(json, `join-btn-${ORG_OPEN_NOT_JOINED.id}`);
    expect(joinButtons.length).toBe(1);

    // Call onPress and await all microtasks/promises
    // Call onPress directly — it returns a Promise since onJoin is async
    await act(async () => {
      // Invoke and wait for the full async chain
      await joinButtons[0].props.onPress();
    });
    expect(mockJoinOpen).toHaveBeenCalledTimes(1);
  });
});
