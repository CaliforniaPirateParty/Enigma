/**
 * proposalBody.ts
 *
 * Resolves proposal body content:
 * - If the body matches a CID regex (CIDv0 Qm… or CIDv1 bafy…), fetch from IPFS gateway
 * - Otherwise treat as plain text
 *
 * On fetch errors, returns { kind: 'ipfs', cid, error } rather than throwing.
 */

import Constants from 'expo-constants';

export type ProposalBodyResolution =
  | { kind: 'plain'; text: string }
  | { kind: 'ipfs'; cid: string; json?: unknown; text?: string; error?: Error };

/** Matches CIDv0 (Qm + 44 base58 chars) and CIDv1 (bafy + 50+ lowercase alphanumeric) */
const CID_RE = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[0-9a-z]{50,})$/;

/**
 * Resolves a proposal body string.
 * If the string is a CID, fetches the content from the configured IPFS gateway.
 * Never throws — errors are returned in the resolution object.
 */
export async function resolveProposalBody(body: string): Promise<ProposalBodyResolution> {
  if (!body) return { kind: 'plain', text: '' };
  if (!CID_RE.test(body)) return { kind: 'plain', text: body };

  const extra = (Constants.expoConfig?.extra as { pinataGateway?: string }) || {};
  const gateway = extra.pinataGateway || 'https://gateway.pinata.cloud';

  try {
    const res = await fetch(`${gateway}/ipfs/${body}`);
    if (!res.ok) {
      return { kind: 'ipfs', cid: body, error: new Error(`HTTP ${res.status}`) };
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return { kind: 'ipfs', cid: body, json: await res.json() };
    }
    return { kind: 'ipfs', cid: body, text: await res.text() };
  } catch (e: unknown) {
    return {
      kind: 'ipfs',
      cid: body,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}
