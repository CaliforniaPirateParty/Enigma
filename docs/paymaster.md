# Enigma Paymaster — Policy & Operations

**Status:** Locked 2026-05-18. v1 implementation lives in `contracts/src/Paymaster.sol`.

## Funding model

| Decision | Choice |
|---|---|
| Topology | **Shared** paymaster for all orgs in v1 (single contract on Base). |
| Funder | CPP treasury at `0xFbfA21E9931F647Bd6cC5be9E1a0dd9a41DA535e`. Only this address (or the contract owner) may send ETH to the paymaster. |
| Sponsored ops | `castVote`, `castVoteBySig` (Governor), `proposeRecovery` / `approveRecovery` / `executeRecovery` (RecoveryRegistry). Nothing else. |
| Daily limit | 10 sponsored ops per address per UTC day. |
| Auto-pause | Triggered when balance < 0.05 ETH. |
| Membership age gate | Address must hold its MembershipNFT for ≥ 1 hour before its votes for that org will be sponsored. Recovery ops are exempt. |
| Per-target allowlist | Not enforced in v1 (all Governors created by `OrgFactory` are implicitly trusted). Reserved for v2. |

## Why each lever

- **Daily limit (10):** typical user casts at most a handful of votes a day. 10 is generous enough that real members never hit it but caps a single drained key at ≈ 10 × per-vote-gas-cost per day.
- **Auto-pause floor (0.05 ETH):** roughly enough for ~hundreds of votes on Base. Going below this means we want a human to refill before sponsoring more, so the system fails closed.
- **Membership age (1 hour):** trivial to bypass for a real adversary willing to wait, but blocks the "create wallet → join Open org → drain paymaster" loop within a single tx-bundle, which is the dominant abuse vector for an Open-policy org.

## EntryPoint integration (v0.7) — TODO

`contracts/src/Paymaster.sol` is the policy/accounting layer. The ERC-4337 plumbing
is not wired yet because it depends on a couple of decisions we haven't taken:

1. Which EntryPoint version to target — v0.6 vs v0.7. v0.7 is the right call (cleaner
   `PackedUserOperation`, better gas-paid postOp), assuming the bundlers on Base
   have caught up.
2. Whether to validate via off-chain signature (verifying paymaster pattern) or
   to recompute policy on-chain inside `validatePaymasterUserOp`. v1 plan:
   off-chain signature from a designated `policySigner` key, with the on-chain
   contract checking `selectorAllowed` + age + daily-limit + balance.

When we add the `validatePaymasterUserOp` / `postOp` functions, `recordSponsorship`
should be called by EntryPoint via `postOp` (not by `owner`) so the counter is
trustworthy without a privileged off-chain agent.

## Funding the paymaster on Base

```bash
# From the funding wallet (0xFbfA21E9931F647Bd6cC5be9E1a0dd9a41DA535e) on Base mainnet:
cast send <PAYMASTER_ADDRESS> --value 0.5ether \
  --rpc-url https://mainnet.base.org \
  --private-key $FUNDING_WALLET_PRIVATE_KEY
```

The `receive()` function rejects ETH from any other sender, so accidental sends
from random EOAs revert (and won't drain the wrong wallet).

## Withdrawals

Only the contract owner (deployer multisig or 1-of-1 in v1) may `withdraw` to the
funding wallet or any other address. The intended cadence is: top up monthly, never
withdraw unless decommissioning.

## Monitoring

- `Paymaster.dailyUsage(addr)` → current day's sponsored-op count for any address.
- `address(Paymaster).balance` vs `AUTOPAUSE_FLOOR` (0.05 ETH).
- `Sponsored(user, target, selector, kind)` events for analytics / abuse review.

## v2 candidates

- Per-org paymasters that orgs fund themselves (shared paymaster falls back to "Enigma
  treasury bootstrap" only for orgs that opt in).
- Per-target allowlist enforced on-chain so we can sponsor third-party Governors.
- Quadratic per-address gas budget instead of a flat 10/day cap.
