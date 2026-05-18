# Enigma Paymaster — Policy & Operations

**Status:** Hybrid v0.7 implementation landed 2026-05-18. Lives in
`contracts/src/Paymaster.sol`.

## Funding model

| Decision | Choice |
|---|---|
| Topology | **Shared** paymaster for all orgs in v1 (single contract on Base). |
| Funder | CPP treasury at `0xFbfA21E9931F647Bd6cC5be9E1a0dd9a41DA535e`. Only this address (or the contract owner) may send ETH to the paymaster. |
| Sponsored ops | `castVote`, `castVoteBySig` (Governor), `proposeRecovery` / `approveRecovery` / `executeRecovery` (RecoveryRegistry). Nothing else. |
| Daily limit | 10 sponsored ops per address per UTC day. |
| Auto-pause | Triggered when the paymaster's EntryPoint deposit < 0.05 ETH. |
| Membership age gate | Address must hold its MembershipNFT for ≥ 1 hour before its votes for that org will be sponsored. Recovery ops are exempt. |
| Per-target allowlist | Not enforced on-chain in v1; enforced by `policySigner`. |

## ERC-4337 wiring (v0.7)

Paymaster targets the canonical Base EntryPoint v0.7 at
`0x0000000071727De22E5E9d8BAf0edAc6f37da032` (same on Base mainnet and Sepolia).

The paymaster:
- Forwards every `receive()` payment into `EntryPoint.depositTo(address(this))` so
  sponsored UserOps have funds available.
- Reads `EntryPoint.balanceOf(address(this))` for the auto-pause check (the on-chain
  ETH balance of the paymaster itself stays at 0).
- Implements the canonical `IPaymaster` interface (`validatePaymasterUserOp` +
  `postOp`); both functions revert unless `msg.sender == entryPoint`.

## Hybrid policy split

### On-chain (in `validatePaymasterUserOp`)

1. `msg.sender == entryPoint`
2. Not paused
3. Deposit balance ≥ 0.05 ETH
4. Selector is in `selectorAllowed`
5. `usage[sender][utcDay] < 10`
6. ECDSA signature recovers to `policySigner`

### Signer-enforced (off-chain)

The bundler-side signing service is the only entity that knows enough to refuse
sponsorship for app-level reasons. It MUST verify before signing:

1. Target contract is a Governor produced by `OrgFactory` (look up via subgraph)
   OR the canonical `RecoveryRegistry`.
2. Selector matches the inner call the smart account will execute (parse
   `userOp.callData` for the standard `execute(target, value, data)` shape).
3. For vote ops: `MembershipNFT.memberSince(sender) > 0 && block.timestamp ≥
   memberSince + 1 hour`.
4. `validUntil` is at most 5 minutes from now (short window keeps the signed
   permission from being replayed against a paused/drained paymaster).

### Counter (in `postOp`)

`usage[sender][utcDay]++` happens in `postOp` regardless of `PostOpMode`. This
makes the daily cap trustless: even if the signer mis-signs, an attacker is
bounded to 10 ops/day/address.

## paymasterAndData layout (173 bytes)

| Offset | Length | Field |
|---|---|---|
| 0 | 20 | paymaster address |
| 20 | 16 | `paymasterVerificationGasLimit` |
| 36 | 16 | `paymasterPostOpGasLimit` |
| 52 | 6 | `validUntil` (uint48 BE) |
| 58 | 6 | `validAfter` (uint48 BE) |
| 64 | 20 | `target` (Governor or RecoveryRegistry address) |
| 84 | 4 | `selector` (function selector being sponsored) |
| 88 | 20 | `membership` (per-org `MembershipNFT`; `0x0` for recovery ops) |
| 108 | 65 | ECDSA signature `r ‖ s ‖ v` over the policy digest |

## Policy digest

```solidity
keccak256(abi.encode(
    block.chainid,
    paymaster,           // address(this)
    sender,              // userOp.sender
    validUntil,          // uint48
    validAfter,          // uint48
    target,              // address
    selector,            // bytes4
    membership           // address
))
```

The signer hashes this digest with `toEthSignedMessageHash` (`\x19Ethereum
Signed Message:\n32`) before signing. `paymaster.policyDigest(...)` is exposed
as a view so the signing service can match it byte-for-byte.

## Signing service contract (off-chain)

A tiny HTTP service that the mobile app calls before sending a UserOp.

### `POST /sponsor`

```jsonc
// request
{
  "sender":     "0x…",      // smart-account address
  "target":     "0x…",      // OrgGovernor or RecoveryRegistry
  "selector":   "0x…",      // 4 bytes
  "membership": "0x…",      // MembershipNFT or 0x0 for recovery
  "callData":   "0x…"       // optional; allows the signer to double-check the inner call
}

// 200 response
{
  "validUntil":   1747600000,
  "validAfter":   0,
  "verificationGasLimit": 200000,
  "postOpGasLimit":       100000,
  "signature":    "0x…",                                    // 65-byte r‖s‖v
  "paymasterAndData": "0x…"                                 // ready to drop into the UserOp
}

// 403 response
{ "error": "membership_too_new" | "selector_not_allowed" | "target_unknown" | "rate_limited" | "paused" }
```

`validUntil` is `now + 300` seconds. The signer is responsible for replay-safety
beyond what the chain enforces (the EntryPoint accepts the signed window but
won't tell us the same user already burned it elsewhere — we trust the on-chain
counter for that).

### Trust assumptions

- Compromise of the `policySigner` key allows draining up to `dailyLimit ×
  numAddresses × dailyDeposit` until the owner rotates via `setPolicySigner`.
- Key rotation is a single owner-only tx; no migration of state required.
- The signer never gains custody of funds; the worst-case is signing for an
  invalid target, which doesn't help the signer (gas is paid to the EntryPoint
  miner, not to the target).

## Funding the paymaster on Base

```bash
# From the funding wallet (0xFbfA21E9931F647Bd6cC5be9E1a0dd9a41DA535e) on Base mainnet:
cast send <PAYMASTER_ADDRESS> --value 0.5ether \
  --rpc-url https://mainnet.base.org \
  --private-key $FUNDING_WALLET_PRIVATE_KEY
```

The `receive()` function rejects ETH from any other sender (reverts), so an
accidental send from a random EOA leaves funds where they were instead of
draining into the wrong contract.

## Monitoring

- `Paymaster.dailyUsage(addr)` — current day's sponsored-op count for any address.
- `Paymaster.depositBalance()` vs `AUTOPAUSE_FLOOR` (0.05 ETH).
- `Sponsored(user, target, selector, kind, actualGasCost)` events for analytics
  and abuse review.

## v2 candidates

- Per-org paymasters that orgs fund themselves; shared paymaster falls back to
  "Enigma treasury bootstrap" only for orgs that opt in.
- Per-target allowlist enforced on-chain (only relevant if we sponsor third-party
  Governors).
- Quadratic per-address gas budget instead of a flat 10/day cap.
- EIP-712 typed-data signatures from `policySigner` for wallet-readable approvals.
