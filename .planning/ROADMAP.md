# Enigma v1.0 Roadmap

## Phase 1 — Foundation (2–3 weeks)
**Status:** In Progress / Completed
**Goal:** Base Sepolia testnet, messaging SDK integration, wallet flows

- Switch RPC to Base Sepolia
- Replace `ipfs-http-client` with Pinata SDK
- Integrate `@xmtp/react-native-sdk`, delete custom messaging crypto
- Wire WalletConnect QR display + deep-link callbacks
- Working DM between two test wallets

## Phase 2 — Contracts (3–4 weeks)
**Status:** COMPLETE (deployed 2026-05-18)
**Goal:** Deployable governance and recovery contracts with full test coverage

- Write `OrgFactory`, `MembershipNFT` (soulbound), `OrgGovernor`, `RecoveryRegistry`, `Paymaster` in Foundry
- Full unit + invariant tests (72 tests, 0 failures)
- Deployed to Ethereum Sepolia (chainId 11155111) — see `deployments/sepolia.json`
- OrgFactory, RecoveryRegistry, Paymaster verified on sepolia.etherscan.io

## Phase 3 — Subgraph + Indexing (1 week)
**Status:** Planned
**Goal:** Real-time org, member, proposal, and vote indexing

- Define subgraph schema for Org, Member, Proposal, Vote, Recovery events
- Write event mappings for all contracts
- Deploy to The Graph on Base Sepolia
- Write query helpers for app and signer validation
- Integrate subgraph into signer endpoint for target validation
- Add auth (HMAC/API-key) to signer `/sponsor` endpoint
- E2E UserOp test through real bundler (Pimlico/Alchemy/Stackup)

## Phase 4 — Multi-org UI (3–4 weeks)
**Status:** Planned
**Goal:** Mobile-first UI for org management, proposals, and voting

- Org switcher, directory, join flows
- Per-org chat (XMTP group), DM list + threads
- Proposals list, detail, vote casting via paymaster
- Recovery setup and initiation UI
- Integration with Phase 3 subgraph for real-time state
- Integration with signer endpoint for gas-free UserOps

## Phase 5 — Polish & Release (2–3 weeks)
**Status:** Future
**Goal:** Production-ready app on Base mainnet

- Design system pass, accessibility, error states
- iOS + Android store assets
- TestFlight + Play internal testing beta
- Move to Base mainnet
- Production release

## Phase 6 (v1.5) — Snapshot Interop (2 weeks)
**Status:** Future
**Goal:** Support existing Snapshot spaces

- Import existing Snapshot spaces by ENS name
- Render Snapshot proposals alongside native Governor proposals
- Cast Snapshot votes via EIP-712 signature
- Useful for orgs migrating from Snapshot

---

## Open Issues (to resolve in Phase 3–4)
1. **Signer endpoint auth** — Currently open; need HMAC or API-key
2. **Subgraph validation** — Signer falls back to "trust any target" if `SUBGRAPH_URL` empty
3. **Bundler testing** — Fork test verifies EP interface, but not bundler strictness
4. **Real subgraph** — Schema, mappings, deployment on Base Sepolia

**Total v1 estimate:** 11–15 weeks of focused work.
