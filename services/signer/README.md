# Enigma Signer Service

The off-chain half of the hybrid paymaster policy. A small Fastify service that:

1. Validates each sponsorship request against the locked policy (selector
   allowlist, target identity via subgraph, membership age ≥ 1 hour, paymaster
   state).
2. Signs the paymaster's `policyDigest(...)` with the `policySigner` key.
3. Returns the fully-assembled 173-byte `paymasterAndData` blob ready to drop
   into a UserOp.

The on-chain paymaster (`contracts/src/Paymaster.sol`) re-verifies the
signature, daily cap, and autopause floor — so a buggy signer can't drain the
treasury beyond `10 ops × N addresses × per-op-gas`.

## Endpoints

### `GET /health`
Sanity check. Returns `{ ok, signer, paymaster, chainId }`.

### `POST /sponsor`

Request:
```json
{
  "sender":     "0x...",
  "target":     "0x...",
  "selector":   "0xdeadbeef",
  "membership": "0x...",
  "callData":   "0x..."
}
```

200 OK:
```json
{
  "ok": true,
  "validUntil": 1747600000,
  "validAfter": 0,
  "verificationGasLimit": 200000,
  "postOpGasLimit":       100000,
  "signature":      "0x...",
  "paymasterAndData":"0x..."
}
```

Non-200 (refused): `{ error: "selector_not_allowed" | "target_unknown" | "membership_too_new" | "not_a_member" | "membership_required_for_vote" | "paused" | "autopaused_low_balance" }`.

## Environment

See `.env.example`. Required: `POLICY_SIGNER_PRIVATE_KEY`, `PAYMASTER_ADDRESS`,
`CHAIN_ID`, `RPC_URL`. `SUBGRAPH_URL` is optional in dev (skips target identity
check when absent).

## Run

```bash
pnpm install
cp .env.example .env # then fill in
pnpm dev
```

## Trust assumptions

- A compromised `POLICY_SIGNER_PRIVATE_KEY` lets an attacker request signatures
  for any sender that meets on-chain checks. Damage is bounded by
  `DAILY_OP_LIMIT × addresses × deposit balance`.
- Rotation is a single owner-only call: `paymaster.setPolicySigner(newAddress)`.
  Generate a new key, set it on the paymaster, then update this service's env
  and restart.
- Run behind TLS. The signer never touches user funds, but a public signing
  endpoint should still be authenticated (TODO: add HMAC or API-key auth before
  going to mainnet).
