/**
 * walletconnect.test.ts
 *
 * Unit tests for WalletContext WalletConnect flow.
 * All native modules and WalletConnect SDK are mocked.
 *
 * Uses react-test-renderer (Node-compatible) to avoid react-native Flow
 * syntax incompatibility in the ts-jest Node test environment.
 *
 * Verifies:
 *  - pendingWcUri is undefined on initial render
 *  - connectMetaMask() sets pendingWcUri to the wc:// URI while approval is pending
 *  - clearWcUri() resets pendingWcUri to undefined
 *  - pendingWcUri is undefined after approval resolves
 */

import React from 'react';
import { act, create } from 'react-test-renderer';
import { WalletProvider, useWallet } from '../context/WalletContext';

// ---------------------------------------------------------------------------
// Mock session fixture
// ---------------------------------------------------------------------------

const mockSession = {
  topic: 'test-topic',
  namespaces: {
    eip155: {
      accounts: ['eip155:1:0xabcdef1234567890abcdef1234567890abcdef12'],
    },
  },
};

// ---------------------------------------------------------------------------
// Mock @walletconnect/sign-client
// The factory must not reference outer variables (jest.mock is hoisted).
// ---------------------------------------------------------------------------

jest.mock('@walletconnect/sign-client', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock react-native-keychain
// ---------------------------------------------------------------------------

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn().mockResolvedValue(false),
  setGenericPassword: jest.fn().mockResolvedValue(true),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
  ACCESS_CONTROL: { BIOMETRY_ANY: 'BIOMETRY_ANY' },
  SECURITY_LEVEL: { SECURE_HARDWARE: false },
}));

// ---------------------------------------------------------------------------
// Mock @react-native-async-storage/async-storage
// ---------------------------------------------------------------------------

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock expo-constants — add walletConnectProjectId so initWc() runs
// ---------------------------------------------------------------------------

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        walletConnectProjectId: 'test-project-id',
        rpcUrl: 'https://ethereum.publicnode.com',
        subgraphUrl: 'https://api.thegraph.com/subgraphs/name/enigma/base-sepolia',
        chainId: 1,
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Helper: create a mock SignClient instance with controllable connect()
// ---------------------------------------------------------------------------

function buildMockSignClient(connectResult: {
  uri: string;
  approval: () => Promise<typeof mockSession>;
}) {
  return {
    connect: jest.fn().mockResolvedValue(connectResult),
    disconnect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Lightweight renderHook using react-test-renderer
// ---------------------------------------------------------------------------

function renderWalletHook<T>(hook: () => T): { result: () => T; unmount: () => void } {
  const ref = { current: undefined as unknown as T };
  function TestComponent() {
    ref.current = hook();
    return null;
  }
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(
      React.createElement(WalletProvider, null, React.createElement(TestComponent)),
    );
  });
  return {
    result: () => ref.current,
    unmount: () => renderer.unmount(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WalletContext WalletConnect flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pendingWcUri is undefined initially', () => {
    const SignClient = require('@walletconnect/sign-client').default;
    // No project ID needed for this test — just block init from completing
    SignClient.init.mockResolvedValue({ connect: jest.fn(), disconnect: jest.fn(), on: jest.fn() });

    const { result } = renderWalletHook(() => useWallet());
    expect(result().pendingWcUri).toBeUndefined();
  });

  it('connectMetaMask exposes pendingWcUri while approval is pending', async () => {
    let approvalResolve!: (s: typeof mockSession) => void;
    const mockClient = buildMockSignClient({
      uri: 'wc://test-uri',
      approval: () =>
        new Promise<typeof mockSession>((resolve) => {
          approvalResolve = resolve;
        }),
    });

    const SignClient = require('@walletconnect/sign-client').default;
    SignClient.init.mockResolvedValue(mockClient);

    const { result } = renderWalletHook(() => useWallet());

    // Wait for the WC client to be initialised in useEffect
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Fire connectMetaMask without awaiting — we want to inspect mid-flight state
    act(() => {
      result().connectMetaMask().catch(() => {});
    });

    // Wait for connect() to resolve and URI to propagate
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result().pendingWcUri).toBe('wc://test-uri');

    // Resolve approval to avoid dangling async work
    if (approvalResolve) {
      await act(async () => {
        approvalResolve(mockSession);
        await new Promise((r) => setTimeout(r, 20));
      });
    }
  });

  it('clearWcUri resets pendingWcUri to undefined', async () => {
    let approvalResolve!: (s: typeof mockSession) => void;
    const mockClient = buildMockSignClient({
      uri: 'wc://test-uri-2',
      approval: () =>
        new Promise<typeof mockSession>((resolve) => {
          approvalResolve = resolve;
        }),
    });

    const SignClient = require('@walletconnect/sign-client').default;
    SignClient.init.mockResolvedValue(mockClient);

    const { result } = renderWalletHook(() => useWallet());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    act(() => {
      result().connectMetaMask().catch(() => {});
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result().pendingWcUri).toBe('wc://test-uri-2');

    // Manually dismiss via clearWcUri
    act(() => {
      result().clearWcUri();
    });
    expect(result().pendingWcUri).toBeUndefined();

    if (approvalResolve) {
      await act(async () => {
        approvalResolve(mockSession);
        await new Promise((r) => setTimeout(r, 20));
      });
    }
  });

  it('pendingWcUri is undefined after approval resolves', async () => {
    let approvalResolve!: (s: typeof mockSession) => void;
    const mockClient = buildMockSignClient({
      uri: 'wc://test-uri-3',
      approval: () =>
        new Promise<typeof mockSession>((resolve) => {
          approvalResolve = resolve;
        }),
    });

    const SignClient = require('@walletconnect/sign-client').default;
    SignClient.init.mockResolvedValue(mockClient);

    const { result } = renderWalletHook(() => useWallet());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    act(() => {
      result().connectMetaMask().catch(() => {});
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result().pendingWcUri).toBe('wc://test-uri-3');

    // Resolve approval — pendingWcUri should auto-clear after this
    await act(async () => {
      approvalResolve(mockSession);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result().pendingWcUri).toBeUndefined();
  });
});
