/**
 * orgChatScreen.test.ts
 *
 * Smoke tests for OrgChatScreen membership gate and OrgMembersScreen.
 * Uses react-test-renderer (Node-compatible) — no @testing-library/react-native.
 *
 * Test A: non-member sees unauthorized-banner, NOT message-list
 * Test B: member sees message-list, NOT unauthorized-banner
 * Test C: no activeOrgId → "No org selected"
 */

import React from 'react';
import { act, create } from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Mocks (must be set up before importing the screen)
// ---------------------------------------------------------------------------

// 1. orgStore
let mockActiveOrgId: string | null = '0xorg1';
jest.mock('../state/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ activeOrgId: mockActiveOrgId }),
}));

// 2. WalletContext
let mockWalletAddress = '0x' + 'W'.repeat(40);
jest.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    address: mockWalletAddress,
    state: { address: mockWalletAddress },
  }),
}));

// 3. useOrgs / useUserOrgs
let mockUserOrgsData: any[] = [{ id: '0xorg1' }];
let mockOrgsData: any[] = [{ id: '0xorg1', name: 'TestOrg', creator: '0x' + 'C'.repeat(40), memberCount: 2 }];
jest.mock('../hooks/useOrgs', () => ({
  useOrgs: () => ({ data: mockOrgsData, loading: false, error: null, refetch: jest.fn() }),
  useUserOrgs: () => ({ data: mockUserOrgsData, loading: false, error: null, refetch: jest.fn() }),
}));

// 4. useOrgMembers
let mockMembersData: any[] = [
  {
    id: '1',
    address: '0x' + 'A'.repeat(40),
    tokenId: '1',
    mintedAt: '1700000000',
    burnedAt: null,
    active: true,
    org: { id: '0xorg1' },
  },
];
jest.mock('../hooks/useMembers', () => ({
  useOrgMembers: () => ({
    data: mockMembersData,
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

// 5. MessagingContext
const mockGetOrCreateOrgGroup = jest.fn().mockResolvedValue({});
const mockSendGroupMessage = jest.fn().mockResolvedValue(undefined);
const mockReconcileGroupMembers = jest.fn().mockResolvedValue(undefined);
jest.mock('../context/MessagingContext', () => ({
  useMessaging: () => ({
    ready: true,
    orgGroupMessages: {},
    orgGroups: {},
    initClient: jest.fn().mockResolvedValue(undefined),
    getOrCreateOrgGroup: mockGetOrCreateOrgGroup,
    sendGroupMessage: mockSendGroupMessage,
    reconcileGroupMembers: mockReconcileGroupMembers,
  }),
}));

// 6. React Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

// ---------------------------------------------------------------------------
// Helper to find a node with a given testID in the test renderer tree
// ---------------------------------------------------------------------------

function findByTestId(instance: any, testId: string): any {
  if (!instance) return null;
  if (instance.props && instance.props.testID === testId) return instance;
  const children = instance.props?.children;
  if (!children) return null;
  if (Array.isArray(children)) {
    for (const child of children) {
      const result = findByTestId(child, testId);
      if (result) return result;
    }
  } else {
    return findByTestId(children, testId);
  }
  return null;
}

function containsText(instance: any, text: string): boolean {
  if (!instance) return false;
  if (typeof instance === 'string') return instance.includes(text);
  if (instance.props?.children) {
    const children = instance.props.children;
    if (typeof children === 'string') return children.includes(text);
    if (Array.isArray(children)) {
      return children.some((c: any) => containsText(c, text));
    }
    return containsText(children, text);
  }
  return false;
}

function hasTestId(tree: any, testId: string): boolean {
  return findByTestId(tree, testId) !== null;
}

// ---------------------------------------------------------------------------
// Import screen AFTER mocks
// ---------------------------------------------------------------------------

import OrgChatScreen from '../screens/Org/OrgChatScreen';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrgChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to defaults
    mockActiveOrgId = '0xorg1';
    mockUserOrgsData = [{ id: '0xorg1' }];
    mockMembersData = [
      {
        id: '1',
        address: '0x' + 'A'.repeat(40),
        tokenId: '1',
        mintedAt: '1700000000',
        burnedAt: null,
        active: true,
        org: { id: '0xorg1' },
      },
    ];
  });

  it('Test A: non-member sees unauthorized-banner, NOT message-list', () => {
    // User is NOT a member of 0xorg1
    mockUserOrgsData = [{ id: '0xotherOrg' }];

    let renderer: any;
    act(() => {
      renderer = create(React.createElement(OrgChatScreen));
    });

    const json = renderer.toJSON();
    const tree = renderer.root;
    const jsonStr = JSON.stringify(json);

    // Should have unauthorized-banner
    expect(jsonStr).toContain('unauthorized-banner');
    // Should NOT have message-list
    expect(jsonStr).not.toContain('message-list');
  });

  it('Test B: member sees message-list, NOT unauthorized-banner', () => {
    // User IS a member of 0xorg1
    mockUserOrgsData = [{ id: '0xorg1' }];

    let renderer: any;
    act(() => {
      renderer = create(React.createElement(OrgChatScreen));
    });

    const json = renderer.toJSON();
    const jsonStr = JSON.stringify(json);

    // Should have message-list
    expect(jsonStr).toContain('message-list');
    // Should NOT have unauthorized-banner
    expect(jsonStr).not.toContain('unauthorized-banner');
  });

  it('Test C: no activeOrgId renders "No org selected"', () => {
    mockActiveOrgId = null;

    let renderer: any;
    act(() => {
      renderer = create(React.createElement(OrgChatScreen));
    });

    const json = renderer.toJSON();
    const jsonStr = JSON.stringify(json);

    expect(jsonStr).toContain('No org selected');
  });
});
