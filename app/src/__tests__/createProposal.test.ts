/**
 * createProposal.test.ts
 *
 * Tests for CreateProposalScreen.
 *
 * Test A: Form validation — submit disabled until both fields valid
 * Test B: Happy path — pinJson called with correct payload, contract.propose called with CID
 * Test C: Pin failure — no contract call, no crash, Alert invoked
 */

import React from 'react';
import { act, create } from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GOVERNOR_ADDR = '0xgov0000000000000000000000000000000000000001';
const ORG_ID = '0xorg0000000000000000000000000000000000000001';
const USER_ADDRESS = '0xuser000000000000000000000000000000000001';
const MOCK_CID = 'QmTestCid123456789012345678901234567890123456';

// ---------------------------------------------------------------------------
// Mock pinJson from storage
// ---------------------------------------------------------------------------

const mockPinJson = jest.fn();

jest.mock('../utils/storage', () => ({
  pinJson: mockPinJson,
}));

// ---------------------------------------------------------------------------
// Mock WalletContext
// ---------------------------------------------------------------------------

const mockGetSigner = jest.fn();

jest.mock('../context/WalletContext', () => ({
  useWallet: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock ethers.Contract
// ---------------------------------------------------------------------------

const mockPropose = jest.fn();

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    Contract: jest.fn().mockImplementation(() => ({
      propose: mockPropose,
    })),
  };
});

// ---------------------------------------------------------------------------
// Mock navigation
// ---------------------------------------------------------------------------

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Import screen (after mocks)
// ---------------------------------------------------------------------------

import CreateProposalScreen from '../screens/Org/CreateProposalScreen';
import { Contract } from 'ethers';
import { ORG_GOVERNOR_ABI } from '../utils/abis';

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

function findByType(node: any, type: string): any[] {
  if (!node) return [];
  if (typeof node !== 'object') return [];
  const results: any[] = [];
  if (node.type === type) results.push(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      results.push(...findByType(child, type));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const DEFAULT_ROUTE = {
  params: { orgId: ORG_ID, governor: GOVERNOR_ADDR },
};

function setupMocks(overrides?: { signer?: any; pinJson?: any }) {
  const { useWallet } = require('../context/WalletContext');
  const { useRoute } = require('@react-navigation/native');

  useRoute.mockReturnValue(DEFAULT_ROUTE);

  const mockSigner = {
    getAddress: jest.fn().mockResolvedValue(USER_ADDRESS),
    ...overrides?.signer,
  };
  mockGetSigner.mockResolvedValue(mockSigner);

  useWallet.mockReturnValue({
    state: { identity: { address: USER_ADDRESS, chainId: 11155111 } },
    getSigner: mockGetSigner,
  });

  mockPinJson.mockResolvedValue({ cid: MOCK_CID });
  if (overrides?.pinJson) {
    mockPinJson.mockImplementation(overrides.pinJson);
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGoBack.mockReset();
  mockPropose.mockReset();
  mockPinJson.mockReset();
  setupMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateProposalScreen', () => {
  test('A: submit button disabled until both fields are valid', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(CreateProposalScreen));
    });

    let json = renderer.toJSON();
    // Submit button should be disabled with empty fields
    const submitBtn = findByTestID(json, 'submit-proposal-button');
    expect(submitBtn.length).toBeGreaterThan(0);
    expect(submitBtn[0].props.disabled).toBe(true);

    // Set title too short (3 chars — below 4 min)
    const inputs = findByType(json, 'TextInput');
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    await act(async () => {
      inputs[0].props.onChangeText('Hi!');
    });
    json = renderer.toJSON();
    const submitBtn2 = findByTestID(json, 'submit-proposal-button');
    expect(submitBtn2[0].props.disabled).toBe(true);

    // Set title valid (5 chars) but body still empty
    await act(async () => {
      const inputsNow = findByType(renderer.toJSON(), 'TextInput');
      inputsNow[0].props.onChangeText('Valid Title');
    });
    json = renderer.toJSON();
    const submitBtn3 = findByTestID(json, 'submit-proposal-button');
    expect(submitBtn3[0].props.disabled).toBe(true);

    // Set body valid (>= 10 chars)
    await act(async () => {
      const inputsNow = findByType(renderer.toJSON(), 'TextInput');
      inputsNow[1].props.onChangeText('A valid proposal body that is long enough to pass.');
    });
    json = renderer.toJSON();
    const submitBtn4 = findByTestID(json, 'submit-proposal-button');
    expect(submitBtn4[0].props.disabled).toBe(false);
  });

  test('B: happy path — pinJson called once with correct payload, propose called with CID', async () => {
    const mockTx = { hash: '0xprop', wait: jest.fn().mockResolvedValue({}) };
    mockPropose.mockResolvedValue(mockTx);
    mockPinJson.mockResolvedValue({ cid: MOCK_CID });

    // Re-apply Contract mock
    const { Contract: MockContract } = require('ethers');
    MockContract.mockImplementation(() => ({ propose: mockPropose }));

    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(CreateProposalScreen));
    });

    // Fill in valid title and body
    await act(async () => {
      const inputs = findByType(renderer.toJSON(), 'TextInput');
      inputs[0].props.onChangeText('Test Title');
      inputs[1].props.onChangeText('A valid proposal body that is long enough to pass.');
    });

    // Submit
    const submitBtn = findByTestID(renderer.toJSON(), 'submit-proposal-button');
    expect(submitBtn[0].props.disabled).toBe(false);
    await act(async () => {
      await submitBtn[0].props.onPress();
    });

    // pinJson called once with correct shape
    expect(mockPinJson).toHaveBeenCalledTimes(1);
    expect(mockPinJson).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Title',
        body: 'A valid proposal body that is long enough to pass.',
        proposer: expect.any(String),
        timestamp: expect.any(Number),
      }),
      'Test Title'
    );

    // Contract.propose called with ([], [], [], cid)
    expect(mockPropose).toHaveBeenCalledTimes(1);
    expect(mockPropose).toHaveBeenCalledWith([], [], [], MOCK_CID);

    // navigation.goBack called after wait()
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('C: pin failure — no contract call, no crash, Alert invoked', async () => {
    mockPinJson.mockRejectedValue(new Error('IPFS pin failed'));

    let renderer: any;
    await act(async () => {
      renderer = create(React.createElement(CreateProposalScreen));
    });

    // Fill in valid fields
    await act(async () => {
      const inputs = findByType(renderer.toJSON(), 'TextInput');
      inputs[0].props.onChangeText('Test Title');
      inputs[1].props.onChangeText('A valid proposal body that is long enough to pass.');
    });

    // Submit
    const submitBtn = findByTestID(renderer.toJSON(), 'submit-proposal-button');
    await act(async () => {
      await submitBtn[0].props.onPress();
    });

    // Contract.propose should NOT have been called
    expect(mockPropose).not.toHaveBeenCalled();

    // Alert should have been invoked
    const Alert = require('react-native').Alert;
    expect(Alert.alert).toHaveBeenCalledWith(
      'Create proposal failed',
      expect.stringContaining('IPFS pin failed')
    );

    // No crash — screen still renders
    expect(renderer.toJSON()).toBeTruthy();
  });
});
