# Enigma Contracts

Foundry project for the Enigma on-chain governance system.

## Contracts

| Contract | Purpose |
|---|---|
| `OrgFactory.sol` | Anyone calls `createOrg()` → deploys `MembershipNFT` + `OrgGovernor` for a new organization. |
| `MembershipNFT.sol` | Soulbound ERC-721 + ERC-721Votes. One token per member per org. Non-transferable. |
| `OrgGovernor.sol` | Per-org OpenZeppelin Governor. Reads voting weight from `MembershipNFT`. |
| `RecoveryRegistry.sol` | Per-user social-recovery: 3–5 delegates, 7-day timelock, rebinds identity across all orgs. |
| `Paymaster.sol` | ERC-4337 verifying paymaster. Sponsors `castVote`, `castVoteBySig`, and recovery ops. |

## Paymaster policy (locked 2026-05-18)

- **Shared Enigma paymaster** — single contract serves all orgs in v1.
- **Sponsored ops:** `castVote`, `castVoteBySig`, recovery initiation/finalization.
- **Rate limit:** 10 sponsored ops per address per UTC day.
- **Auto-pause:** disables sponsorship when balance < 0.05 ETH.
- **Membership age gate:** address must hold its membership NFT for ≥ 1 hour before votes are sponsored for that org.
- **Funding wallet:** `0xFbfA21E9931F647Bd6cC5be9E1a0dd9a41DA535e` (CPP treasury, Base).

See `../docs/paymaster.md` for the full policy.

## Setup

```bash
# Install Foundry if missing: https://book.getfoundry.sh/getting-started/installation
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install eth-infinitism/account-abstraction --no-commit
forge build
forge test
```

## Deploy (Base Sepolia)

```bash
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
export DEPLOYER_PRIVATE_KEY=0x...
export BASESCAN_API_KEY=...
forge script script/Deploy.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast --verify
```
