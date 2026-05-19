/**
 * recoveryStatus.test.ts
 *
 * Tests for deriveThresholdFromEvents and RecoveryStatusScreen.
 */

// ---------------------------------------------------------------------------
// Mocks (must be before imports)
// ---------------------------------------------------------------------------

const mockQueryFilter = jest.fn();
const mockFilters = { DelegatesSet: jest.fn().mockReturnValue({}) };

jest.mock('../utils/contracts', () => ({
  getContract: jest.fn(),
  getExtra: jest.fn(),
  getProvider: jest.fn(),
}));

jest.mock('../utils/abis', () => ({
  RECOVERY_REGISTRY_ABI: ['event DelegatesSet(address indexed user, address[] delegates, uint8 threshold)'],
}));

jest.mock('../hooks/useRecovery', () => ({
  useRecoveryDelegates: jest.fn(),
  usePendingRecovery: jest.fn(),
  deriveThresholdFromEvents: jest.requireActual('../hooks/useRecovery').deriveThresholdFromEvents,
}));

jest.mock('../context/WalletContext', () => ({
  useWallet: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({ navigate: jest.fn(), goBack: jest.fn() })),
  useRoute: jest.fn(() => ({ params: { user: '0xuseraddr' } })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import React from 'react';
import { act, create } from 'react-test-renderer';

import { deriveThresholdFromEvents } from '../hooks/useRecovery';
import * as contractsModule from '../utils/contracts';
import * as useRecoveryModule from '../hooks/useRecovery';
import * as WalletContext from '../context/WalletContext';

const mockGetContract = contractsModule.getContract as jest.MockedFunction<typeof contractsModule.getContract>;
const mockGetExtra = contractsModule.getExtra as jest.MockedFunction<typeof contractsModule.getExtra>;
const mockUsePendingRecovery = useRecoveryModule.usePendingRecovery as jest.MockedFunction<typeof useRecoveryModule.usePendingRecovery>;
const mockUseWallet = WalletContext.useWallet as jest.MockedFunction<typeof WalletContext.useWallet>;

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

function findTextNodes(root: any, text: string): any[] {
  return findAllNodes(root, (n) => typeof n === 'string' && n.includes(text));
}

// ---------------------------------------------------------------------------
// deriveThresholdFromEvents tests
// ---------------------------------------------------------------------------

describe('deriveThresholdFromEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetExtra.mockReturnValue({
      rpcUrl: 'https://rpc.example.com',
      chainId: 11155111,
      chainName: 'sepolia',
      recoveryRegistryAddress: '0x3faCd12FeE4B242cAaBD01315C42d840fb75010d',
    } as any);
    mockFilters.DelegatesSet.mockReturnValue({});
    mockGetContract.mockReturnValue({
      filters: mockFilters,
      queryFilter: mockQueryFilter,
    } as any);
  });

  it('Test 1: returns null when queryFilter returns empty array', async () => {
    mockQueryFilter.mockResolvedValue([]);
    const result = await deriveThresholdFromEvents('0xabc');
    expect(result).toBeNull();
  });

  it('Test 2: returns threshold from single DelegatesSet event', async () => {
    mockQueryFilter.mockResolvedValue([
      { blockNumber: 100, args: ['0xabc', ['0x1', '0x2', '0x3'], 2] },
    ]);
    const result = await deriveThresholdFromEvents('0xabc');
    expect(result).toBe(2);
  });

  it('Test 3: returns threshold from latest event when multiple events exist', async () => {
    mockQueryFilter.mockResolvedValue([
      { blockNumber: 100, args: ['0xabc', ['0x1', '0x2', '0x3'], 2] },
      { blockNumber: 200, args: ['0xabc', ['0x1', '0x2', '0x3', '0x4'], 3] },
    ]);
    const result = await deriveThresholdFromEvents('0xabc');
    expect(result).toBe(3);
  });

  it('Test 4: returns null when queryFilter throws (no throw escapes)', async () => {
    mockQueryFilter.mockRejectedValue(new Error('RPC connection failed'));
    const result = await deriveThresholdFromEvents('0xabc');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// RecoveryStatusScreen smoke test
// ---------------------------------------------------------------------------

describe('RecoveryStatusScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetExtra.mockReturnValue({
      rpcUrl: 'https://rpc.example.com',
      chainId: 11155111,
      chainName: 'sepolia',
      recoveryRegistryAddress: '0x3faCd12FeE4B242cAaBD01315C42d840fb75010d',
    } as any);
    mockFilters.DelegatesSet.mockReturnValue({});
    mockGetContract.mockReturnValue({
      filters: mockFilters,
      queryFilter: mockQueryFilter,
      delegatesOf: jest.fn().mockResolvedValue([]),
    } as any);
    mockUseWallet.mockReturnValue({
      state: { identity: { address: '0xuseraddr', chainId: 11155111 } },
      getSigner: jest.fn(),
    } as any);
  });

  it('Bonus: renders without crashing when usePendingRecovery returns null (no pending)', async () => {
    mockQueryFilter.mockResolvedValue([]);
    mockUsePendingRecovery.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const RecoveryStatusScreen = require('../screens/Recovery/RecoveryStatusScreen').default;
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(RecoveryStatusScreen));
    });
    const json = renderer.toJSON();
    expect(json).not.toBeNull();
    // Should show no-pending state
    const noRecoveryText = findTextNodes(json, 'No pending');
    expect(noRecoveryText.length).toBeGreaterThan(0);
  });
});
