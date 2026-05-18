import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ethers } from 'ethers';
import { z } from 'zod';

const Env = z.object({
  POLICY_SIGNER_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  PAYMASTER_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  CHAIN_ID: z.coerce.number().int().positive(),
  RPC_URL: z.string().url(),
  SUBGRAPH_URL: z.string().url().optional().default(''),
  ALLOWED_SELECTORS: z
    .string()
    .default('')
    .transform((s) =>
      new Set(
        s
          .split(',')
          .map((x) => x.trim().toLowerCase())
          .filter((x) => /^0x[0-9a-f]{8}$/.test(x))
      )
    ),
  VALIDITY_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
  PORT: z.coerce.number().int().positive().default(8787)
});

type Env = z.infer<typeof Env>;

const PAYMASTER_ABI = [
  'function policyDigest(address sender, uint48 validUntil, uint48 validAfter, address target, bytes4 selector, address membership) view returns (bytes32)',
  'function selectorAllowed(bytes4) view returns (bool)',
  'function paused() view returns (bool)',
  'function depositBalance() view returns (uint256)'
];

const MEMBERSHIP_ABI = [
  'function memberSince(address) view returns (uint64)'
];

const MEMBERSHIP_AGE_SECONDS = 60 * 60; // 1 hour
const AUTOPAUSE_FLOOR = ethers.parseEther('0.05');

export const SponsorRequest = z.object({
  sender: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  target: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  selector: z.string().regex(/^0x[0-9a-fA-F]{8}$/),
  membership: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  callData: z.string().regex(/^0x[0-9a-fA-F]*$/).optional()
});
export type SponsorRequest = z.infer<typeof SponsorRequest>;

export type SponsorDeps = {
  env: Env;
  signer: ethers.Wallet;
  provider: ethers.JsonRpcProvider;
  paymaster: ethers.Contract;
  isKnownTarget: (address: string) => Promise<boolean>;
};

export type SponsorResult =
  | {
      ok: true;
      validUntil: number;
      validAfter: number;
      verificationGasLimit: number;
      postOpGasLimit: number;
      signature: string;
      paymasterAndData: string;
    }
  | { ok: false; status: number; error: string };

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

export async function evaluateSponsorship(req: SponsorRequest, deps: SponsorDeps): Promise<SponsorResult> {
  const { env, paymaster, provider, signer, isKnownTarget } = deps;

  const selector = req.selector.toLowerCase();
  if (env.ALLOWED_SELECTORS.size > 0 && !env.ALLOWED_SELECTORS.has(selector)) {
    return { ok: false, status: 403, error: 'selector_not_allowed' };
  }
  const onChainAllowed: boolean = await paymaster.selectorAllowed(selector);
  if (!onChainAllowed) return { ok: false, status: 403, error: 'selector_not_allowed' };

  if (await paymaster.paused()) return { ok: false, status: 503, error: 'paused' };
  const balance: bigint = await paymaster.depositBalance();
  if (balance < AUTOPAUSE_FLOOR) return { ok: false, status: 503, error: 'autopaused_low_balance' };

  if (!(await isKnownTarget(req.target.toLowerCase()))) {
    return { ok: false, status: 403, error: 'target_unknown' };
  }

  const isVoteOp = selector === '0x56781388' || selector === '0xeb9019d4';
  if (isVoteOp) {
    if (req.membership.toLowerCase() === ZERO_ADDR) {
      return { ok: false, status: 400, error: 'membership_required_for_vote' };
    }
    const m = new ethers.Contract(req.membership, MEMBERSHIP_ABI, provider);
    const since: bigint = await m.memberSince(req.sender);
    if (since === 0n) return { ok: false, status: 403, error: 'not_a_member' };
    const now = Math.floor(Date.now() / 1000);
    if (Number(since) + MEMBERSHIP_AGE_SECONDS > now) {
      return { ok: false, status: 403, error: 'membership_too_new' };
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const validAfter = 0;
  const validUntil = now + env.VALIDITY_WINDOW_SECONDS;

  const digest: string = await paymaster.policyDigest(
    req.sender,
    validUntil,
    validAfter,
    req.target,
    req.selector,
    req.membership
  );
  const signature = await signer.signMessage(ethers.getBytes(digest));

  const verificationGasLimit = 200_000;
  const postOpGasLimit = 100_000;

  const paymasterAndData = ethers.concat([
    env.PAYMASTER_ADDRESS,
    ethers.zeroPadValue(ethers.toBeHex(verificationGasLimit), 16),
    ethers.zeroPadValue(ethers.toBeHex(postOpGasLimit), 16),
    ethers.zeroPadValue(ethers.toBeHex(validUntil), 6),
    ethers.zeroPadValue(ethers.toBeHex(validAfter), 6),
    req.target,
    req.selector,
    req.membership,
    signature
  ]);

  return {
    ok: true,
    validUntil,
    validAfter,
    verificationGasLimit,
    postOpGasLimit,
    signature,
    paymasterAndData
  };
}

export async function buildServer(env: Env): Promise<{ app: FastifyInstance; deps: SponsorDeps }> {
  const provider = new ethers.JsonRpcProvider(env.RPC_URL, env.CHAIN_ID);
  const signer = new ethers.Wallet(env.POLICY_SIGNER_PRIVATE_KEY, provider);
  const paymaster = new ethers.Contract(env.PAYMASTER_ADDRESS, PAYMASTER_ABI, provider);

  const isKnownTarget = async (address: string): Promise<boolean> => {
    if (!env.SUBGRAPH_URL) return true; // dev mode: skip if no subgraph configured
    const query = `query($id: ID!) { governor: governor(id: $id) { id } recoveryRegistry(id: $id) { id } }`;
    const r = await fetch(env.SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: address.toLowerCase() } })
    });
    if (!r.ok) return false;
    const j: any = await r.json();
    return Boolean(j?.data?.governor?.id || j?.data?.recoveryRegistry?.id);
  };

  const deps: SponsorDeps = { env, signer, provider, paymaster, isKnownTarget };

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get('/health', async () => ({
    ok: true,
    signer: signer.address,
    paymaster: env.PAYMASTER_ADDRESS,
    chainId: env.CHAIN_ID
  }));

  app.post('/sponsor', async (req, reply) => {
    const parsed = SponsorRequest.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const result = await evaluateSponsorship(parsed.data, deps);
    if (!result.ok) return reply.code(result.status).send({ error: result.error });
    return reply.send(result);
  });

  return { app, deps };
}

async function main() {
  const env = Env.parse(process.env);
  const { app } = await buildServer(env);
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Enigma signer listening on :${env.PORT}`);
}

// Only auto-start when run directly (`node dist/index.js` / `tsx src/index.ts`),
// not when imported by tests.
const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
