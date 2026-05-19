/**
 * sponsor.ts
 *
 * Sponsorship handshake and vote-casting utilities for proposal voting.
 *
 * Architecture (Option A — MVP):
 * - requestSponsorship: performs a real HTTP round-trip to the signer service /sponsor endpoint.
 *   Returns paymasterAndData for future bundler submission.
 * - castSponsoredVote: calls requestSponsorship, then throws SponsorshipNotAvailable
 *   (even on success) so the UI always falls back to castDirectVote.
 *   The seam is preserved for a future phase to wire UserOp construction + bundler submission.
 * - castDirectVote: submits castVote directly to the Governor contract (user pays gas).
 *
 * See plan 04-03 "Sponsorship MVP decision (Option A — locked)" for full rationale.
 */

import { ethers, Contract, Interface } from 'ethers';
import Constants from 'expo-constants';
import { ORG_GOVERNOR_ABI } from './abis';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class SponsorshipNotAvailable extends Error {
  readonly cause?: Error;
  constructor(msg: string, cause?: Error) {
    super(msg);
    this.name = 'SponsorshipNotAvailable';
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** castVote(uint256,uint8) selector, verified registered on Paymaster (Sepolia 0x9a2014…) */
const CAST_VOTE_SELECTOR = '0x56781388';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SponsorRequestPayload = {
  sender: string;
  governor: string;
  proposalId: string;
  support: 0 | 1 | 2;
  membership: string;
};

export type SponsorResponse = {
  ok: true;
  validUntil: number;
  validAfter: number;
  verificationGasLimit: number;
  postOpGasLimit: number;
  signature: string;
  paymasterAndData: string;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Lazily created to support Jest module isolation
let _iface: Interface | undefined;
function getIface(): Interface {
  if (!_iface) _iface = new Interface(ORG_GOVERNOR_ABI);
  return _iface;
}

function getSignerServiceUrl(): string {
  const extra = (Constants.expoConfig?.extra as { signerServiceUrl?: string }) || {};
  if (extra.signerServiceUrl) return extra.signerServiceUrl;
  // Dev fallback — only in dev builds
  if (typeof __DEV__ !== 'undefined' && __DEV__) return 'http://localhost:8787';
  return '';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Requests sponsorship from the signer service.
 * Encodes castVote calldata, POSTs to /sponsor, returns the sponsor response.
 * Throws on non-200 responses, ok:false bodies, or network failures.
 * Times out after 5 seconds.
 */
export async function requestSponsorship(req: SponsorRequestPayload): Promise<SponsorResponse> {
  const url = getSignerServiceUrl();
  if (!url) throw new Error('signer_service_url_not_configured');

  const callData = getIface().encodeFunctionData('castVote', [req.proposalId, req.support]);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${url}/sponsor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: req.sender,
        target: req.governor,
        selector: CAST_VOTE_SELECTOR,
        membership: req.membership,
        callData,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const body = await res.json().catch(() => ({})) as Record<string, unknown>;

    if (!res.ok || body?.ok === false || body?.error) {
      throw new Error((body?.error as string) || `signer_http_${res.status}`);
    }

    return body as unknown as SponsorResponse;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Submits a vote directly to the Governor contract.
 * The user pays gas. Always succeeds or throws a contract error.
 */
export async function castDirectVote(opts: {
  signer: ethers.Signer;
  governor: string;
  proposalId: string;
  support: 0 | 1 | 2;
}) {
  const c = new Contract(opts.governor, ORG_GOVERNOR_ABI, opts.signer);
  return await c.castVote(opts.proposalId, opts.support);
}

/**
 * Option A MVP: performs the sponsorship handshake but always falls back to direct vote.
 *
 * Calls requestSponsorship (real HTTP round-trip). On success, throws SponsorshipNotAvailable
 * carrying the sponsor response in cause — the bundler submission seam is preserved for a
 * future phase. Sponsor-service failures also flow through SponsorshipNotAvailable so the
 * UI has a single error path.
 *
 * The UI catches SponsorshipNotAvailable and calls castDirectVote.
 */
export async function castSponsoredVote(opts: {
  signer: ethers.Signer; // kept as ethers.Signer type for interface compatibility
  sender: string;
  governor: string;
  proposalId: string;
  support: 0 | 1 | 2;
  membership: string;
}) {
  try {
    const sponsor = await requestSponsorship(opts);
    // Bundler submission deferred to future phase — throw to trigger direct-vote fallback
    throw new SponsorshipNotAvailable(
      'user_op_bundler_not_wired',
      new Error(`sponsor.signature=${sponsor.signature.slice(0, 10)}…`)
    );
  } catch (e: unknown) {
    if (e instanceof SponsorshipNotAvailable) throw e;
    throw new SponsorshipNotAvailable(
      'sponsor_request_failed',
      e instanceof Error ? e : new Error(String(e))
    );
  }
}
