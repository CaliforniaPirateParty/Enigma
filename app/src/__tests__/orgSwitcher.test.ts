/**
 * orgSwitcher.test.ts
 *
 * Smoke tests for OrgSwitcherScreen.
 * Uses react-test-renderer (Node-compatible).
 *
 * Mocks: useOrgs (useUserOrgs), useWallet, OrgTabs, useNavigation, orgStore
 */

import React from 'react';
import { act, create } from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_AAA = {
  id: '0xaaa',
  creator: '0xcreator',
  membership: '0xaaa',
  governor: '0xgov1',
  name: 'Alpha Org',
  symbol: 'AAA',
  metadataURI: '',
  joinPolicy: 0,
  createdAt: '1',
  memberCount: 3,
};

const ORG_BBB = {
  id: '0xbbb',
  creator: '0xcreator',
  membership: '0xbbb',
  governor: '0xgov2',
  name: 'Beta Org',
  symbol: 'BBB',
  metadataURI: '',
  joinPolicy: 0,
  createdAt: '2',
  memberCount: 5,
};

const ORG_CCC = {
  id: '0xccc',
  creator: '0xcreator',
  membership: '0xccc',
  governor: '0xgov3',
  name: 'Gamma Org',
  symbol: 'CCC',
  metadataURI: '',
  joinPolicy: 0,
  createdAt: '3',
  memberCount: 2,
};

const USER_ADDRESS = '0xuseraddr';

// ---------------------------------------------------------------------------
// Mock hooks
// ---------------------------------------------------------------------------

const mockSetActiveOrg = jest.fn();
const mockRefetchUserOrgs = jest.fn().mockResolvedValue(undefined);

jest.mock('../hooks/useOrgs', () => ({
  useOrgs: jest.fn(),
  useUserOrgs: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock WalletContext
// ---------------------------------------------------------------------------

jest.mock('../context/WalletContext', () => ({
  useWallet: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock orgStore
// ---------------------------------------------------------------------------

jest.mock('../state/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock OrgTabs — simplify to null; the rail is what we're testing
// ---------------------------------------------------------------------------

jest.mock('../navigation/OrgTabs', () => ({
  OrgTabs: () => null,
}));

// ---------------------------------------------------------------------------
// Mock useNavigation
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({ navigate: mockNavigate })),
}));

// ---------------------------------------------------------------------------
// Import the component under test (after mocks)
// ---------------------------------------------------------------------------

import OrgSwitcherScreen from '../screens/Org/OrgSwitcherScreen';

// ---------------------------------------------------------------------------
// Helper
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

function findByTestID(root: any, testID: string): any[] {
  return findAllNodes(root, (n) => n?.props?.testID === testID);
}

function findTextNodes(root: any, text: string): any[] {
  return findAllNodes(root, (n) => typeof n === 'string' && n.includes(text));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrgSwitcherScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetActiveOrg.mockImplementation(jest.fn());

    const { useWallet } = require('../context/WalletContext');
    useWallet.mockReturnValue({
      state: { identity: { address: USER_ADDRESS } },
      getSigner: jest.fn(),
    });

    const { useOrgs, useUserOrgs } = require('../hooks/useOrgs');
    useOrgs.mockReturnValue({ data: [], loading: false, error: null, refetch: jest.fn() });
    useUserOrgs.mockReturnValue({
      data: [ORG_AAA, ORG_BBB, ORG_CCC],
      loading: false,
      error: null,
      refetch: mockRefetchUserOrgs,
    });

    const { useOrgStore } = require('../state/orgStore');
    useOrgStore.mockReturnValue({
      activeOrgId: null,
      setActiveOrg: mockSetActiveOrg,
      clearActiveOrg: jest.fn(),
      hydrate: jest.fn().mockResolvedValue(undefined),
    });
    // Also mock getState for the useEffect auto-select path
    useOrgStore.getState = jest.fn(() => ({
      activeOrgId: null,
      setActiveOrg: mockSetActiveOrg,
    }));

    const { useNavigation } = require('@react-navigation/native');
    useNavigation.mockReturnValue({ navigate: mockNavigate });
  });

  // -------------------------------------------------------------------------
  // Test A: renders three rail items (one per fixture org)
  // -------------------------------------------------------------------------

  it('renders three rail items for three joined orgs', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(OrgSwitcherScreen));
    });

    const json = renderer.toJSON();
    const orgItems = findByTestID(json, 'org-rail-0xaaa-off')
      .concat(findByTestID(json, 'org-rail-0xbbb-off'))
      .concat(findByTestID(json, 'org-rail-0xccc-off'))
      .concat(findByTestID(json, 'org-rail-0xaaa-on'))
      .concat(findByTestID(json, 'org-rail-0xbbb-on'))
      .concat(findByTestID(json, 'org-rail-0xccc-on'));

    expect(orgItems.length).toBe(3);
  });

  // -------------------------------------------------------------------------
  // Test B: auto-select first org when activeOrgId is null
  // -------------------------------------------------------------------------

  it('auto-selects first org when activeOrgId is null and orgs exist', async () => {
    await act(async () => {
      create(React.createElement(OrgSwitcherScreen));
      // Flush useEffect
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockSetActiveOrg).toHaveBeenCalledWith('0xaaa');
  });

  // -------------------------------------------------------------------------
  // Test C: selected-highlight follows store
  // -------------------------------------------------------------------------

  it('marks the active org rail item as selected (on)', async () => {
    // Set activeOrgId to '0xbbb'
    const { useOrgStore } = require('../state/orgStore');
    useOrgStore.mockReturnValue({
      activeOrgId: '0xbbb',
      setActiveOrg: mockSetActiveOrg,
      clearActiveOrg: jest.fn(),
      hydrate: jest.fn().mockResolvedValue(undefined),
    });
    useOrgStore.getState = jest.fn(() => ({
      activeOrgId: '0xbbb',
      setActiveOrg: mockSetActiveOrg,
    }));

    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(OrgSwitcherScreen));
    });

    const json = renderer.toJSON();
    const selectedItems = findByTestID(json, 'org-rail-0xbbb-on');
    const nonSelectedAAA = findByTestID(json, 'org-rail-0xaaa-off');
    const nonSelectedCCC = findByTestID(json, 'org-rail-0xccc-off');

    expect(selectedItems.length).toBe(1);
    expect(nonSelectedAAA.length).toBe(1);
    expect(nonSelectedCCC.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Test D: empty-state CTA when useUserOrgs returns []
  // -------------------------------------------------------------------------

  it('renders empty-state CTA when no orgs joined', async () => {
    const { useUserOrgs } = require('../hooks/useOrgs');
    useUserOrgs.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(OrgSwitcherScreen));
    });

    const json = renderer.toJSON();
    const ctaText = findTextNodes(json, "haven't joined any orgs");
    expect(ctaText.length).toBeGreaterThan(0);
  });
});
