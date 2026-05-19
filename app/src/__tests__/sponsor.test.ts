/**
 * sponsor.test.ts
 *
 * Tests for sponsor.ts utilities:
 *   - requestSponsorship: builds correct callData, POSTs to /sponsor, handles success/failure/network error
 *   - castSponsoredVote: always throws SponsorshipNotAvailable (Option A MVP)
 *   - castDirectVote: constructs the Contract correctly and calls castVote
 */

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// ---------------------------------------------------------------------------
// Mock ethers — use named Contract import to intercept correctly (per STATE.md decision)
// ---------------------------------------------------------------------------

const mockCastVote = jest.fn();

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    Contract: jest.fn().mockImplementation(() => ({
      castVote: mockCastVote,
    })),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ethers, Contract } from 'ethers';
import {
  requestSponsorship,
  castSponsoredVote,
  castDirectVote,
  SponsorshipNotAvailable,
} from '../utils/sponsor';
import { ORG_GOVERNOR_ABI } from '../utils/abis';

const MOCK_SIGNER = {
  getAddress: jest.fn().mockResolvedValue('0xsenderaddr'),
} as unknown as ethers.Signer;

const SPONSOR_PARAMS = {
  sender: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  governor: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  proposalId: '1',
  support: 1 as const,
  membership: '0xcccccccccccccccccccccccccccccccccccccccc',
};

const MOCK_SPONSOR_RESPONSE = {
  ok: true,
  validUntil: 9999999999,
  validAfter: 0,
  verificationGasLimit: 100000,
  postOpGasLimit: 50000,
  signature: '0xsig0001',
  paymasterAndData: '0xpmdata',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOkFetchResponse(body: object) {
  return {
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
    status: 200,
  };
}

function makeErrorFetchResponse(status: number, body: object) {
  return {
    ok: false,
    json: async () => body,
    text: async () => JSON.stringify(body),
    status,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockCastVote.mockReset();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// requestSponsorship
// ---------------------------------------------------------------------------

describe('requestSponsorship', () => {
  test('builds correct callData with castVote selector 0x56781388', async () => {
    mockFetch.mockResolvedValueOnce(makeOkFetchResponse(MOCK_SPONSOR_RESPONSE));

    await requestSponsorship(SPONSOR_PARAMS);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8787/sponsor');

    const body = JSON.parse(options.body);
    // Verify selector constant
    expect(body.selector).toBe('0x56781388');
    // Verify callData decodes correctly to castVote(proposalId=1, support=1)
    const iface = new (jest.requireActual('ethers') as typeof ethers).Interface(ORG_GOVERNOR_ABI);
    const decoded = iface.decodeFunctionData('castVote', body.callData);
    expect(decoded[0].toString()).toBe('1'); // proposalId
    expect(Number(decoded[1])).toBe(1); // support
  });

  test('POSTs to /sponsor with correct shape', async () => {
    mockFetch.mockResolvedValueOnce(makeOkFetchResponse(MOCK_SPONSOR_RESPONSE));

    await requestSponsorship(SPONSOR_PARAMS);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.sender).toBe(SPONSOR_PARAMS.sender);
    expect(body.target).toBe(SPONSOR_PARAMS.governor);
    expect(body.membership).toBe(SPONSOR_PARAMS.membership);
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  test('returns body on 200 ok:true response', async () => {
    mockFetch.mockResolvedValueOnce(makeOkFetchResponse(MOCK_SPONSOR_RESPONSE));

    const result = await requestSponsorship(SPONSOR_PARAMS);
    expect(result.ok).toBe(true);
    expect(result.paymasterAndData).toBe('0xpmdata');
    expect(result.signature).toBe('0xsig0001');
  });

  test('throws with error string on ok:false body', async () => {
    mockFetch.mockResolvedValueOnce(
      makeOkFetchResponse({ ok: false, error: 'insufficient_balance' })
    );

    await expect(requestSponsorship(SPONSOR_PARAMS)).rejects.toThrow('insufficient_balance');
  });

  test('throws on non-200 response with no body error', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorFetchResponse(500, {}));

    await expect(requestSponsorship(SPONSOR_PARAMS)).rejects.toThrow(/signer_http_500/);
  });

  test('throws on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

    await expect(requestSponsorship(SPONSOR_PARAMS)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// castSponsoredVote (Option A MVP: always throws SponsorshipNotAvailable)
// ---------------------------------------------------------------------------

describe('castSponsoredVote', () => {
  test('throws SponsorshipNotAvailable even on successful handshake (Option A MVP)', async () => {
    mockFetch.mockResolvedValueOnce(makeOkFetchResponse(MOCK_SPONSOR_RESPONSE));

    await expect(
      castSponsoredVote({ signer: MOCK_SIGNER, ...SPONSOR_PARAMS })
    ).rejects.toBeInstanceOf(SponsorshipNotAvailable);
  });

  test('throws SponsorshipNotAvailable when sponsor service fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('signer service down'));

    await expect(
      castSponsoredVote({ signer: MOCK_SIGNER, ...SPONSOR_PARAMS })
    ).rejects.toBeInstanceOf(SponsorshipNotAvailable);
  });

  test('SponsorshipNotAvailable has correct name', async () => {
    mockFetch.mockResolvedValueOnce(makeOkFetchResponse(MOCK_SPONSOR_RESPONSE));

    try {
      await castSponsoredVote({ signer: MOCK_SIGNER, ...SPONSOR_PARAMS });
      fail('expected SponsorshipNotAvailable');
    } catch (e: unknown) {
      expect((e as SponsorshipNotAvailable).name).toBe('SponsorshipNotAvailable');
    }
  });
});

// ---------------------------------------------------------------------------
// castDirectVote
// ---------------------------------------------------------------------------

describe('castDirectVote', () => {
  test('constructs Contract with ORG_GOVERNOR_ABI and calls castVote', async () => {
    const mockTx = { hash: '0xtxhash', wait: jest.fn().mockResolvedValue({}) };
    mockCastVote.mockResolvedValueOnce(mockTx);

    const result = await castDirectVote({
      signer: MOCK_SIGNER,
      governor: SPONSOR_PARAMS.governor,
      proposalId: SPONSOR_PARAMS.proposalId,
      support: SPONSOR_PARAMS.support,
    });

    expect(Contract).toHaveBeenCalledWith(
      SPONSOR_PARAMS.governor,
      ORG_GOVERNOR_ABI,
      MOCK_SIGNER
    );
    expect(mockCastVote).toHaveBeenCalledWith(
      SPONSOR_PARAMS.proposalId,
      SPONSOR_PARAMS.support
    );
    expect(result.hash).toBe('0xtxhash');
  });
});
