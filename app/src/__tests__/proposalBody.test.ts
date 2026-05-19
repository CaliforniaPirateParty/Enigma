/**
 * proposalBody.test.ts
 *
 * Tests for resolveProposalBody utility.
 * - Plain text (no CID regex match) → kind: 'plain', no fetch
 * - Valid CIDv0 (Qm…) with JSON response → kind: 'ipfs', json
 * - Valid CIDv1 (bafy…) with text response → kind: 'ipfs', text
 * - Fetch error → kind: 'ipfs', error (does not throw)
 */

// ---------------------------------------------------------------------------
// Mock expo-constants for gateway URL
// ---------------------------------------------------------------------------

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        pinataGateway: 'https://gateway.pinata.cloud',
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import { resolveProposalBody, ProposalBodyResolution } from '../utils/proposalBody';

const VALID_CID_V0 = 'QmV1CsDJJhUZ2RN8X4bwDkBFX5DqCLkWZRuuK47abcdefg'; // 46-char Qm CID

// CIDv1 — bafy + 50+ lowercase chars
const VALID_CID_V1 = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

beforeEach(() => {
  mockFetch.mockReset();
});

describe('resolveProposalBody', () => {
  test('returns plain for empty string', async () => {
    const result = await resolveProposalBody('');
    expect(result.kind).toBe('plain');
    if (result.kind === 'plain') {
      expect(result.text).toBe('');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('returns plain text for non-CID body', async () => {
    const result = await resolveProposalBody('a plain description');
    expect(result.kind).toBe('plain');
    if (result.kind === 'plain') {
      expect(result.text).toBe('a plain description');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('fetches IPFS and returns json for CIDv0 with JSON content-type', async () => {
    const payload = { title: 'Test Proposal', body: 'Proposal body here' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    });

    const result = await resolveProposalBody(VALID_CID_V0);
    expect(result.kind).toBe('ipfs');
    if (result.kind === 'ipfs') {
      expect(result.cid).toBe(VALID_CID_V0);
      expect(result.json).toEqual(payload);
      expect(result.error).toBeUndefined();
    }
    expect(mockFetch).toHaveBeenCalledWith(
      `https://gateway.pinata.cloud/ipfs/${VALID_CID_V0}`
    );
  });

  test('fetches IPFS and returns text for CIDv1 with text content-type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'text/plain' },
      text: async () => 'hello world',
    });

    const result = await resolveProposalBody(VALID_CID_V1);
    expect(result.kind).toBe('ipfs');
    if (result.kind === 'ipfs') {
      expect(result.cid).toBe(VALID_CID_V1);
      expect(result.text).toBe('hello world');
      expect(result.error).toBeUndefined();
    }
    expect(mockFetch).toHaveBeenCalledWith(
      `https://gateway.pinata.cloud/ipfs/${VALID_CID_V1}`
    );
  });

  test('returns error in object (does not throw) on non-ok fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => 'text/html' },
    });

    const result = await resolveProposalBody(VALID_CID_V0);
    expect(result.kind).toBe('ipfs');
    if (result.kind === 'ipfs') {
      expect(result.cid).toBe(VALID_CID_V0);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('404');
    }
  });

  test('returns error in object (does not throw) on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await resolveProposalBody(VALID_CID_V0);
    expect(result.kind).toBe('ipfs');
    if (result.kind === 'ipfs') {
      expect(result.cid).toBe(VALID_CID_V0);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Network error');
    }
  });
});
