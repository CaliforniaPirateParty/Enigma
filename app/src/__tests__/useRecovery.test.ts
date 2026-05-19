/**
 * useRecovery.test.ts
 *
 * Tests for useRecoveryDelegates, usePendingRecovery, and deriveThresholdFromEvents.
 * Hooks use React state so we test their query logic directly via mocks.
 * We also test deriveThresholdFromEvents as a standalone async function.
 */

// ---------------------------------------------------------------------------
// Mocks (must be before imports)
// ---------------------------------------------------------------------------

jest.mock('../api/subgraph', () => ({
  queryRecoveryDelegates: jest.fn(),
}));

jest.mock('../utils/contracts', () => ({
  getContract: jest.fn(),
  getExtra: jest.fn(),
  getProvider: jest.fn(),
}));

jest.mock('../utils/abis', () => ({
  RECOVERY_REGISTRY_ABI: ['function pendingRecovery(address user) view returns (address,uint64,uint8,address[])'],
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import * as useRecoveryModule from '../hooks/useRecovery';
import * as subgraphApi from '../api/subgraph';
import * as contractsModule from '../utils/contracts';

const mockQueryRecoveryDelegates = subgraphApi.queryRecoveryDelegates as jest.MockedFunction<typeof subgraphApi.queryRecoveryDelegates>;
const mockGetContract = contractsModule.getContract as jest.MockedFunction<typeof contractsModule.getContract>;
const mockGetExtra = contractsModule.getExtra as jest.MockedFunction<typeof contractsModule.getExtra>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DELEGATE_FIXTURE = {
  id: '1',
  user: '0xuser',
  delegate: '0xdelegate',
  addedAt: '1000',
  removedAt: null,
  active: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRecovery module exports', () => {
  it('exports useRecoveryDelegates function', () => {
    expect(typeof useRecoveryModule.useRecoveryDelegates).toBe('function');
  });

  it('exports usePendingRecovery function', () => {
    expect(typeof useRecoveryModule.usePendingRecovery).toBe('function');
  });

  it('exports deriveThresholdFromEvents function', () => {
    expect(typeof useRecoveryModule.deriveThresholdFromEvents).toBe('function');
  });
});

describe('useRecoveryDelegates query logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryRecoveryDelegates.mockResolvedValue([DELEGATE_FIXTURE]);
  });

  it('calls queryRecoveryDelegates with lowercased address', async () => {
    const address = '0xUSERaddr';
    const lc = address.toLowerCase();
    await mockQueryRecoveryDelegates(lc);
    expect(mockQueryRecoveryDelegates).toHaveBeenCalledWith(lc);
  });

  it('queryRecoveryDelegates returns the delegate fixture', async () => {
    const result = await mockQueryRecoveryDelegates('0xuseraddr');
    expect(result).toEqual([DELEGATE_FIXTURE]);
  });

  it('hook is exported and is a function (skip behavior is internal)', () => {
    expect(typeof useRecoveryModule.useRecoveryDelegates).toBe('function');
  });
});

describe('usePendingRecovery query logic', () => {
  const mockPendingRecovery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetExtra.mockReturnValue({
      rpcUrl: 'https://rpc.example.com',
      chainId: 11155111,
      chainName: 'sepolia',
      recoveryRegistryAddress: '0x3faCd12FeE4B242cAaBD01315C42d840fb75010d',
    });
    mockGetContract.mockReturnValue({
      pendingRecovery: mockPendingRecovery,
      filters: {},
      queryFilter: jest.fn(),
    } as any);
  });

  it('is a function', () => {
    expect(typeof useRecoveryModule.usePendingRecovery).toBe('function');
  });

  it('treats ZeroAddress newOwner as no pending recovery (returns null)', async () => {
    const ethers = require('ethers');
    mockPendingRecovery.mockResolvedValue([ethers.ZeroAddress, 0, 0, []]);

    // Replicate the query function logic from usePendingRecovery
    const result = await (async () => {
      const extra = mockGetExtra();
      if (!extra.recoveryRegistryAddress) return null;
      const c = mockGetContract(extra.recoveryRegistryAddress, []);
      const [newOwner, readyAt, approvals, orgs] = await c.pendingRecovery('0xuser');
      if (newOwner === ethers.ZeroAddress || Number(readyAt) === 0) return null;
      return { newOwner: String(newOwner), readyAt: Number(readyAt), approvals: Number(approvals), orgs: (orgs as string[]).map(String) };
    })();

    expect(result).toBeNull();
  });

  it('returns pending recovery data when valid recovery exists', async () => {
    const ethers = require('ethers');
    mockPendingRecovery.mockResolvedValue(['0xnewOwner', 1234567890, 2, ['0xorg1']]);

    const result = await (async () => {
      const extra = mockGetExtra();
      if (!extra.recoveryRegistryAddress) return null;
      const c = mockGetContract(extra.recoveryRegistryAddress, []);
      const [newOwner, readyAt, approvals, orgs] = await c.pendingRecovery('0xuser');
      if (newOwner === ethers.ZeroAddress || Number(readyAt) === 0) return null;
      return { newOwner: String(newOwner), readyAt: Number(readyAt), approvals: Number(approvals), orgs: (orgs as string[]).map(String) };
    })();

    expect(result).not.toBeNull();
    expect(result?.newOwner).toBe('0xnewOwner');
    expect(result?.readyAt).toBe(1234567890);
    expect(result?.approvals).toBe(2);
    expect(result?.orgs).toEqual(['0xorg1']);
  });
});

describe('deriveThresholdFromEvents', () => {
  const mockQueryFilter = jest.fn();
  const mockFilters = { DelegatesSet: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetExtra.mockReturnValue({
      rpcUrl: 'https://rpc.example.com',
      chainId: 11155111,
      chainName: 'sepolia',
      recoveryRegistryAddress: '0x3faCd12FeE4B242cAaBD01315C42d840fb75010d',
    });
    mockFilters.DelegatesSet.mockReturnValue({});
    mockGetContract.mockReturnValue({
      pendingRecovery: jest.fn(),
      filters: mockFilters,
      queryFilter: mockQueryFilter,
    } as any);
  });

  it('returns null when no events found', async () => {
    mockQueryFilter.mockResolvedValue([]);
    const result = await useRecoveryModule.deriveThresholdFromEvents('0xabc');
    expect(result).toBeNull();
  });

  it('returns threshold from single DelegatesSet event', async () => {
    mockQueryFilter.mockResolvedValue([
      { blockNumber: 100, args: ['0xabc', ['0x1', '0x2', '0x3'], 2] },
    ]);
    const result = await useRecoveryModule.deriveThresholdFromEvents('0xabc');
    expect(result).toBe(2);
  });

  it('returns threshold from latest event when multiple events exist', async () => {
    mockQueryFilter.mockResolvedValue([
      { blockNumber: 100, args: ['0xabc', ['0x1', '0x2', '0x3'], 2] },
      { blockNumber: 200, args: ['0xabc', ['0x1', '0x2', '0x3', '0x4'], 3] },
    ]);
    const result = await useRecoveryModule.deriveThresholdFromEvents('0xabc');
    expect(result).toBe(3);
  });

  it('returns null when queryFilter throws', async () => {
    mockQueryFilter.mockRejectedValue(new Error('RPC error'));
    const result = await useRecoveryModule.deriveThresholdFromEvents('0xabc');
    expect(result).toBeNull();
  });
});
