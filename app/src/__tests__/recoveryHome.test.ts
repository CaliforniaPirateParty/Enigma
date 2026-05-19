/**
 * recoveryHome.test.ts
 *
 * Smoke tests for RecoveryHomeScreen.
 * Uses react-test-renderer (Node-compatible).
 */

// ---------------------------------------------------------------------------
// Mocks (must be before imports)
// ---------------------------------------------------------------------------

jest.mock('../hooks/useRecovery', () => ({
  useRecoveryDelegates: jest.fn(),
  usePendingRecovery: jest.fn(),
  deriveThresholdFromEvents: jest.fn().mockResolvedValue(null),
}));

jest.mock('../context/WalletContext', () => ({
  useWallet: jest.fn(),
}));

jest.mock('../utils/contracts', () => ({
  getContract: jest.fn(),
  getExtra: jest.fn(() => ({
    rpcUrl: 'https://rpc.example.com',
    chainId: 11155111,
    chainName: 'sepolia',
    recoveryRegistryAddress: '0x3faCd12FeE4B242cAaBD01315C42d840fb75010d',
  })),
  getProvider: jest.fn(),
}));

jest.mock('../utils/abis', () => ({
  RECOVERY_REGISTRY_ABI: ['function cancelRecovery()'],
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({ navigate: mockNavigate, goBack: mockGoBack })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import React from 'react';
import { act, create } from 'react-test-renderer';

import * as useRecoveryModule from '../hooks/useRecovery';
import * as WalletContext from '../context/WalletContext';

const mockUseRecoveryDelegates = useRecoveryModule.useRecoveryDelegates as jest.MockedFunction<typeof useRecoveryModule.useRecoveryDelegates>;
const mockUsePendingRecovery = useRecoveryModule.usePendingRecovery as jest.MockedFunction<typeof useRecoveryModule.usePendingRecovery>;
const mockUseWallet = WalletContext.useWallet as jest.MockedFunction<typeof WalletContext.useWallet>;

// ---------------------------------------------------------------------------
// Helper: flatten the tree
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecoveryHomeScreen', () => {
  let RecoveryHomeScreen: any;

  beforeAll(() => {
    RecoveryHomeScreen = require('../screens/Recovery/RecoveryHomeScreen').default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockReset();
    mockGoBack.mockReset();
  });

  // -------------------------------------------------------------------------
  // Test A: wallet connected + no delegates + no pending → empty-state branch
  // -------------------------------------------------------------------------

  it('Test A: shows "No recovery configured" when no delegates and no pending recovery', async () => {
    mockUseWallet.mockReturnValue({
      state: { identity: { address: '0xuseraddr', chainId: 11155111 } },
      getSigner: jest.fn(),
    } as any);

    mockUseRecoveryDelegates.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUsePendingRecovery.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(RecoveryHomeScreen));
    });

    const json = renderer.toJSON();
    const emptyState = findTextNodes(json, 'No recovery configured');
    expect(emptyState.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Test B: wallet connected + delegates + pending recovery → pending-recovery branch
  // -------------------------------------------------------------------------

  it('Test B: shows "Pending recovery" when usePendingRecovery returns non-null', async () => {
    mockUseWallet.mockReturnValue({
      state: { identity: { address: '0xuseraddr', chainId: 11155111 } },
      getSigner: jest.fn(),
    } as any);

    mockUseRecoveryDelegates.mockReturnValue({
      data: [{ id: '1', user: '0xuseraddr', delegate: '0xabc123def456abc123def456abc123def456abc1', addedAt: '1000', removedAt: null, active: true }],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUsePendingRecovery.mockReturnValue({
      data: {
        newOwner: '0xnewowner',
        readyAt: 1700000000,
        approvals: 1,
        orgs: [],
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(RecoveryHomeScreen));
    });

    const json = renderer.toJSON();
    const pendingText = findTextNodes(json, 'Pending recovery');
    expect(pendingText.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Test C: wallet not connected → show connect prompt
  // -------------------------------------------------------------------------

  it('Test C: shows "Connect a wallet" when no wallet is connected', async () => {
    mockUseWallet.mockReturnValue({
      state: {},
      getSigner: jest.fn(),
    } as any);

    // These will still be called with undefined address, so they should return defaults
    mockUseRecoveryDelegates.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUsePendingRecovery.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(RecoveryHomeScreen));
    });

    const json = renderer.toJSON();
    const connectText = findTextNodes(json, 'Connect a wallet');
    expect(connectText.length).toBeGreaterThan(0);
  });
});
