# Enigma

Mobile-first, web3-native app for **encrypted wallet-to-wallet messaging** and **multi-organization governance**. Any group can mint a soulbound membership NFT collection and coordinate proposals, votes, and recovery on-chain — no intermediaries.

Reference deployment targets the **California Pirate Party**, but the architecture is generic: any group can spin up an org without forking the app.

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Mobile App  —  React Native + Expo (iOS & Android)        │
│  ┌─────────────┬──────────────┬─────────────────────────┐  │
│  │   Wallet    │   Messaging  │   Governance            │  │
│  │  (ethers,   │  (XMTP SDK)  │  (org switcher,         │  │
│  │   WC v2)    │              │   proposals, votes)     │  │
│  └─────────────┴──────────────┴─────────────────────────┘  │
└────────┬──────────────┬───────────────┬────────────────────┘
         │              │               │
         ▼              ▼               ▼
   ┌──────────┐   ┌──────────┐   ┌────────────────────┐
   │ EVM RPC  │   │   XMTP   │   │  Subgraph (Graph   │
   │ +ERC4337 │   │ network  │   │  Studio) for reads │
   │Paymaster │   │          │   │                    │
   └──────────┘   └──────────┘   └────────────────────┘
```

See [SPEC.md](./SPEC.md) for the full technical specification.

---

## Repository Layout

| Path | What |
|------|------|
| [`app/`](./app) | React Native (Expo) mobile app — wallet, XMTP messaging, governance UI |
| [`contracts/`](./contracts) | Solidity contracts — git submodule → [Enigma-contracts](https://github.com/CaliforniaPirateParty/Enigma-contracts) |
| [`services/`](./services) | Backend services (signer, paymaster policy) |
| [`docs/`](./docs) | Additional documentation |
| `SPEC.md` | Technical specification |
| `.planning/` | GSD planning artifacts (phases, roadmap, state) |

---

## Smart Contracts — deployed on Ethereum Sepolia

Five governance contracts deployed to Sepolia (chainId `11155111`). Source in the [Enigma-contracts](https://github.com/CaliforniaPirateParty/Enigma-contracts) submodule.

| Contract | Address | Verified |
|----------|---------|----------|
| **OrgFactory** | [`0xE8D76d1D192c54493C81eB0C8bAbbCD98ad785ea`](https://sepolia.etherscan.io/address/0xE8D76d1D192c54493C81eB0C8bAbbCD98ad785ea) | ✓ |
| **RecoveryRegistry** | [`0x3faCd12FeE4B242cAaBD01315C42d840fb75010d`](https://sepolia.etherscan.io/address/0x3faCd12FeE4B242cAaBD01315C42d840fb75010d) | ✓ |
| **Paymaster** (ERC-4337) | [`0x9a2014ad25159faF44736CaAba6F8a49477766A4`](https://sepolia.etherscan.io/address/0x9a2014ad25159faF44736CaAba6F8a49477766A4) | ✓ |
| MembershipNFTDeployer | [`0xe8f0Fd5643E845C1b2f49a01f5523420e69341e9`](https://sepolia.etherscan.io/address/0xe8f0Fd5643E845C1b2f49a01f5523420e69341e9) | helper |
| OrgGovernorDeployer | [`0x45375d5A52EA69d2eefB6483788692a1A53D32a2`](https://sepolia.etherscan.io/address/0x45375d5A52EA69d2eefB6483788692a1A53D32a2) | helper |

**EntryPoint** (ERC-4337 v0.7): `0x0000000071727De22E5E9d8BAf0edAc6f37da032`

---

## What the contracts do

- **OrgFactory** — atomic `createOrg()` that spins up a paired MembershipNFT + OrgGovernor under one of three join policies (Open / Allowlist / Application). Genesis NFT minted to creator; ownership handed to creator (Open) or Governor (Allowlist/Application).
- **MembershipNFT** — soulbound ERC721 (no transfers) with ERC721Votes for governance. One token per address, max.
- **OrgGovernor** — OpenZeppelin Governor over the MembershipNFT vote weight; standard propose/vote/queue/execute lifecycle with configurable quorum.
- **RecoveryRegistry** — per-user social-recovery delegate set with k-of-n threshold + timelock. Members nominate delegates; delegates approve a new owner address after the timelock elapses.
- **Paymaster** — ERC-4337 v0.7 verifying paymaster. Hybrid policy: signed off-chain authorization + on-chain per-user daily cap + selector allowlist. Sponsors gas for member ops without exposing the contract to drain.

---

## Status

| Phase | What | Status |
|-------|------|--------|
| 1 | XMTP messaging + WalletConnect foundation | scaffolded |
| 2 | Smart contracts (5) — written, tested, deployed | ✅ complete |
| 3 | Subgraph indexing — Graph Studio deployed | indexing (needs re-point to Sepolia + real addresses) |
| 4 | Multi-org UI — org switcher, proposals, voting, recovery | up next |
| 5 | Polish & store release | pending |

**Test suite:** 72 forge tests, 0 failures. Invariant suites for MembershipNFT (no double-mint), RecoveryRegistry (k-of-n consistency), and Paymaster (daily cap, deposit non-negative).

**First sea-trial target:** Memorial Cruise, SS Jeremiah O'Brien, 2026-05-30.

---

## Quick start (mobile app)

```bash
cd app
npm install
npx expo start
```

The app expects a wallet via WalletConnect v2 and reads org/proposal data from the subgraph at <https://api.studio.thegraph.com/query/1753533/enimga-base-sepolia/version/latest> (note: currently labeled `base-sepolia` — being re-pointed to `sepolia`).

## Development Setup

### Environment Variables

Create `app/.env` (excluded from git) with:

```
EXPO_PUBLIC_XMTP_ENV=dev
EXPO_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id
```

- `EXPO_PUBLIC_XMTP_ENV` — set to `dev` for testnet or `production` for mainnet XMTP network
- `EXPO_PUBLIC_WC_PROJECT_ID` — get a free project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com)

These are read via `expo-constants` in `WalletContext.tsx` (`walletConnectProjectId`) and `MessagingContext.tsx` (`xmtpEnv`). Without `WC_PROJECT_ID`, the WalletConnect button is a no-op.

### Running tests

```bash
cd app
npm test -- --watchAll=false
```

## Quick start (contracts)

```bash
git submodule update --init --recursive
cd contracts
forge install
forge test
```

To deploy your own copy to Ethereum Sepolia, see `contracts/script/Deploy.s.sol` and supply `DEPLOYER_PRIVATE_KEY`, `SEPOLIA_RPC_URL`, `ETHERSCAN_API_KEY`, `ENTRYPOINT_ADDRESS`, `POLICY_SIGNER_ADDRESS` via `.env`.

---

## License

See [LICENSE](./LICENSE).
