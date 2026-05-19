/**
 * orgStore.test.ts
 *
 * Tests for the active-org Zustand store and centralized ABI definitions.
 *
 * Zustand stores are tested by reading from getState() directly — no provider needed.
 * jest.resetModules() is used between persistence tests to simulate fresh app sessions.
 */

import { ethers } from 'ethers';

// ---------------------------------------------------------------------------
// Mock @react-native-async-storage/async-storage with Map-backed stub
// ---------------------------------------------------------------------------

const asyncStorageData: Map<string, string> = new Map();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(asyncStorageData.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    asyncStorageData.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    asyncStorageData.delete(key);
    return Promise.resolve();
  }),
}));

// ---------------------------------------------------------------------------
// Import store and ABIs (after mocks are set up)
// ---------------------------------------------------------------------------

import { useOrgStore, OrgStoreState } from '../state/orgStore';
import { MEMBERSHIP_NFT_ABI, ORG_GOVERNOR_ABI, RECOVERY_REGISTRY_ABI } from '../utils/abis';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  useOrgStore.setState({ activeOrgId: null });
  asyncStorageData.clear();
  jest.clearAllMocks();
}

// ---------------------------------------------------------------------------
// Tests: orgStore behavior
// ---------------------------------------------------------------------------

describe('useOrgStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('activeOrgId is null on first read', () => {
    expect(useOrgStore.getState().activeOrgId).toBeNull();
  });

  it('setActiveOrg updates activeOrgId', () => {
    useOrgStore.getState().setActiveOrg('0xABC123');
    expect(useOrgStore.getState().activeOrgId).toBe('0xabc123');
  });

  it('setActiveOrg lowercases the address before storing', () => {
    useOrgStore.getState().setActiveOrg('0xABCDEF1234567890ABCDEF1234567890ABCDEF12');
    expect(useOrgStore.getState().activeOrgId).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
  });

  it('clearActiveOrg sets activeOrgId back to null', () => {
    useOrgStore.getState().setActiveOrg('0xabc');
    useOrgStore.getState().clearActiveOrg();
    expect(useOrgStore.getState().activeOrgId).toBeNull();
  });

  it('setting the same id twice is idempotent', () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    useOrgStore.getState().setActiveOrg('0xabc');
    // Reset the mock call count
    AsyncStorage.setItem.mockClear();
    useOrgStore.getState().setActiveOrg('0xabc');
    // Because the lowercased value is the same, no-op should not call setItem again
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('setActiveOrg writes through to AsyncStorage', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    useOrgStore.getState().setActiveOrg('0xabc');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('enigma:active-org', '0xabc');
  });

  it('clearActiveOrg removes from AsyncStorage', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    useOrgStore.getState().setActiveOrg('0xabc');
    useOrgStore.getState().clearActiveOrg();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('enigma:active-org');
  });

  it('hydrate() reads from AsyncStorage and sets activeOrgId', async () => {
    // Pre-seed AsyncStorage
    asyncStorageData.set('enigma:active-org', '0xdef456');
    await useOrgStore.getState().hydrate();
    expect(useOrgStore.getState().activeOrgId).toBe('0xdef456');
  });

  it('hydrate() with no stored value leaves activeOrgId null', async () => {
    await useOrgStore.getState().hydrate();
    expect(useOrgStore.getState().activeOrgId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: ABI sanity — ethers.Interface must parse each ABI without throwing
// ---------------------------------------------------------------------------

describe('MEMBERSHIP_NFT_ABI', () => {
  it('parses with ethers.Interface without error', () => {
    expect(() => new ethers.Interface(MEMBERSHIP_NFT_ABI)).not.toThrow();
  });

  it('includes joinOpen() function fragment', () => {
    const iface = new ethers.Interface(MEMBERSHIP_NFT_ABI);
    const fn = iface.getFunction('joinOpen');
    expect(fn).not.toBeNull();
    expect(fn?.name).toBe('joinOpen');
  });

  it('includes MemberJoined event', () => {
    const iface = new ethers.Interface(MEMBERSHIP_NFT_ABI);
    const ev = iface.getEvent('MemberJoined');
    expect(ev).not.toBeNull();
    expect(ev?.name).toBe('MemberJoined');
  });
});

describe('ORG_GOVERNOR_ABI', () => {
  it('parses with ethers.Interface without error', () => {
    expect(() => new ethers.Interface(ORG_GOVERNOR_ABI)).not.toThrow();
  });

  it('includes propose() function', () => {
    const iface = new ethers.Interface(ORG_GOVERNOR_ABI);
    const fn = iface.getFunction('propose');
    expect(fn).not.toBeNull();
  });

  it('includes execute() function', () => {
    const iface = new ethers.Interface(ORG_GOVERNOR_ABI);
    const fn = iface.getFunction('execute');
    expect(fn).not.toBeNull();
  });

  it('includes hashProposal() function', () => {
    const iface = new ethers.Interface(ORG_GOVERNOR_ABI);
    const fn = iface.getFunction('hashProposal');
    expect(fn).not.toBeNull();
  });

  it('includes castVote() function', () => {
    const iface = new ethers.Interface(ORG_GOVERNOR_ABI);
    const fn = iface.getFunction('castVote');
    expect(fn).not.toBeNull();
  });

  it('includes ProposalCreated event', () => {
    const iface = new ethers.Interface(ORG_GOVERNOR_ABI);
    const ev = iface.getEvent('ProposalCreated');
    expect(ev).not.toBeNull();
  });

  it('includes ProposalExecuted event', () => {
    const iface = new ethers.Interface(ORG_GOVERNOR_ABI);
    const ev = iface.getEvent('ProposalExecuted');
    expect(ev).not.toBeNull();
  });

  it('includes VoteCast event', () => {
    const iface = new ethers.Interface(ORG_GOVERNOR_ABI);
    const ev = iface.getEvent('VoteCast');
    expect(ev).not.toBeNull();
  });
});

describe('RECOVERY_REGISTRY_ABI', () => {
  it('parses with ethers.Interface without error', () => {
    expect(() => new ethers.Interface(RECOVERY_REGISTRY_ABI)).not.toThrow();
  });

  it('includes setDelegates() function', () => {
    const iface = new ethers.Interface(RECOVERY_REGISTRY_ABI);
    const fn = iface.getFunction('setDelegates');
    expect(fn).not.toBeNull();
  });

  it('includes proposeRecovery() function', () => {
    const iface = new ethers.Interface(RECOVERY_REGISTRY_ABI);
    const fn = iface.getFunction('proposeRecovery');
    expect(fn).not.toBeNull();
  });

  it('includes DelegatesSet event with threshold arg', () => {
    const iface = new ethers.Interface(RECOVERY_REGISTRY_ABI);
    const ev = iface.getEvent('DelegatesSet');
    expect(ev).not.toBeNull();
    expect(ev?.name).toBe('DelegatesSet');
    // Verify threshold param is present
    const hasThreshold = ev?.inputs.some(i => i.name === 'threshold');
    expect(hasThreshold).toBe(true);
  });
});
