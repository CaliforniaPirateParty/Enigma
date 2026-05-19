/**
 * recoverySetup.test.ts
 *
 * Tests for RecoverySetupScreen and its exported validate() helper.
 * Uses react-test-renderer (Node-compatible).
 */

// ---------------------------------------------------------------------------
// Mocks (must be before imports)
// ---------------------------------------------------------------------------

jest.mock('../hooks/useRecovery', () => ({
  useRecoveryDelegates: jest.fn(),
  usePendingRecovery: jest.fn(),
  deriveThresholdFromEvents: jest.fn(),
}));

jest.mock('../context/WalletContext', () => ({
  useWallet: jest.fn(),
}));

jest.mock('../utils/contracts', () => ({
  getContract: jest.fn(),
  getExtra: jest.fn(),
  getProvider: jest.fn(),
}));

jest.mock('../utils/abis', () => ({
  RECOVERY_REGISTRY_ABI: ['function setDelegates(address[],uint8)'],
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({ navigate: jest.fn(), goBack: jest.fn() })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import React from 'react';
import { act, create } from 'react-test-renderer';

import { validate } from '../screens/Recovery/RecoverySetupScreen';
import * as useRecoveryModule from '../hooks/useRecovery';
import * as WalletContext from '../context/WalletContext';
import * as contractsModule from '../utils/contracts';

const mockUseRecoveryDelegates = useRecoveryModule.useRecoveryDelegates as jest.MockedFunction<typeof useRecoveryModule.useRecoveryDelegates>;
const mockUseWallet = WalletContext.useWallet as jest.MockedFunction<typeof WalletContext.useWallet>;
const mockGetContract = contractsModule.getContract as jest.MockedFunction<typeof contractsModule.getContract>;
const mockGetExtra = contractsModule.getExtra as jest.MockedFunction<typeof contractsModule.getExtra>;

// ---------------------------------------------------------------------------
// Helper: flatten the react-test-renderer tree
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
// Tests for validate() helper
// ---------------------------------------------------------------------------

describe('validate() helper', () => {
  it('rejects fewer than 3 delegates', () => {
    expect(validate(['0x' + 'a'.repeat(40), '0x' + 'b'.repeat(40)], 2)).not.toBeNull();
  });

  it('rejects more than 5 delegates', () => {
    const addrs = Array.from({ length: 6 }, (_, i) => '0x' + i.toString().padStart(40, '0'));
    expect(validate(addrs, 4)).not.toBeNull();
  });

  it('rejects invalid address format', () => {
    const addrs = ['0xnotvalid', '0x' + 'b'.repeat(40), '0x' + 'c'.repeat(40)];
    expect(validate(addrs, 2)).not.toBeNull();
  });

  it('rejects duplicate delegates', () => {
    const addr = '0x' + 'a'.repeat(40);
    const addr2 = '0x' + 'b'.repeat(40);
    const addr3 = '0x' + 'c'.repeat(40);
    expect(validate([addr, addr2, addr.toLowerCase()], 2)).not.toBeNull();
  });

  it('rejects threshold of 0', () => {
    const addrs = Array.from({ length: 3 }, (_, i) => '0x' + i.toString().padStart(40, '0'));
    expect(validate(addrs, 0)).not.toBeNull();
  });

  it('rejects threshold greater than N', () => {
    const addrs = Array.from({ length: 3 }, (_, i) => '0x' + i.toString().padStart(40, '0'));
    expect(validate(addrs, 4)).not.toBeNull();
  });

  it('rejects threshold that does not form a strict majority (threshold*2 <= N)', () => {
    // N=3, threshold=1: 1*2=2 <= 3 → not strict majority
    const addrs = Array.from({ length: 3 }, (_, i) => '0x' + i.toString().padStart(40, '0'));
    expect(validate(addrs, 1)).not.toBeNull();
  });

  it('accepts threshold that forms a strict majority (threshold*2 > N)', () => {
    // N=3, threshold=2: 2*2=4 > 3 → strict majority
    const addrs = Array.from({ length: 3 }, (_, i) => '0x' + i.toString().padStart(40, '0'));
    expect(validate(addrs, 2)).toBeNull();
  });

  it('accepts threshold=3 with N=5 (strict majority)', () => {
    // N=5, threshold=3: 3*2=6 > 5 → strict majority
    const addrs = Array.from({ length: 5 }, (_, i) => '0x' + i.toString().padStart(40, '0'));
    expect(validate(addrs, 3)).toBeNull();
  });

  it('rejects threshold=2 with N=5 (not strict majority)', () => {
    // N=5, threshold=2: 2*2=4 <= 5 → not strict majority
    const addrs = Array.from({ length: 5 }, (_, i) => '0x' + i.toString().padStart(40, '0'));
    expect(validate(addrs, 2)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Screen render test
// ---------------------------------------------------------------------------

describe('RecoverySetupScreen', () => {
  const mockSetDelegates = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseWallet.mockReturnValue({
      state: { identity: { address: '0xuseraddr', chainId: 11155111 } },
      getSigner: jest.fn().mockResolvedValue({
        getAddress: jest.fn().mockResolvedValue('0xuseraddr'),
      }),
    } as any);

    mockUseRecoveryDelegates.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockGetExtra.mockReturnValue({
      rpcUrl: 'https://rpc.example.com',
      chainId: 11155111,
      chainName: 'sepolia',
      recoveryRegistryAddress: '0x3faCd12FeE4B242cAaBD01315C42d840fb75010d',
    } as any);

    mockSetDelegates.mockResolvedValue({ hash: '0xtxhash', wait: jest.fn().mockResolvedValue({}) });
    mockGetContract.mockReturnValue({
      setDelegates: mockSetDelegates,
    } as any);
  });

  it('renders without crashing', async () => {
    const RecoverySetupScreen = require('../screens/Recovery/RecoverySetupScreen').default;
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(RecoverySetupScreen));
    });
    expect(renderer.toJSON()).not.toBeNull();
  });

  it('renders Save Delegates button', async () => {
    const RecoverySetupScreen = require('../screens/Recovery/RecoverySetupScreen').default;
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(RecoverySetupScreen));
    });
    const json = renderer.toJSON();
    const saveText = findTextNodes(json, 'Save');
    expect(saveText.length).toBeGreaterThan(0);
  });
});
