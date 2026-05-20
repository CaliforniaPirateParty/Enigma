# Enigma Project State

**Project:** Enigma — Multi-org Governance on Base
**Version:** 1.0
**Started:** 2026-05-18
**Current Phase:** 4 (Multi-org UI) — COMPLETE; Phase 3 (Subgraph) deferred
**Last Session:** 2026-05-19 — Phase 4 execution wrapped (commit d64baa0)

## Completed Phases
- Phase 1: Foundation (RPC, Pinata, XMTP, WalletConnect) — ~60% complete
- Phase 2: Contracts (Foundry contracts) — COMPLETE (deployed to Ethereum Sepolia)
- Phase 4: Multi-org UI — COMPLETE (plans 04-01 through 04-05 executed)
  - 04-01: active-org Zustand store, OrgDirectory, OrgSwitcher, OrgTabs, OrgInfoScreen
  - 04-02: OrgChatScreen, OrgMembersScreen, XMTP group chat in MessagingContext, useOrgMembers hook
  - 04-03: proposals (list/detail/create) + voting + execute + sponsor/proposalBody helpers (23 tests, 159 total passing)
  - 04-04: useRecovery hooks, Setup/Initiate/Status screens, RecoveryHomeScreen wired into App.tsx
  - 04-05: gap-fix — walletAddress access in OrgChatScreen (closes UI-05)

## Current Focus
Phase 3 (Subgraph + Indexing) — **deferred but now blocking**. Phase 5 (Polish / Base mainnet) cannot start until subgraph is deployed, Paymaster funded, and signer auth locked down.

## Deployed Contracts — Ethereum Sepolia (chainId 11155111)

| Contract | Address |
|----------|---------|
| MembershipNFTDeployer | `0xe8f0Fd5643E845C1b2f49a01f5523420e69341e9` |
| OrgGovernorDeployer | `0x45375d5A52EA69d2eefB6483788692a1A53D32a2` |
| OrgFactory | `0xE8D76d1D192c54493C81eB0C8bAbbCD98ad785ea` |
| RecoveryRegistry | `0x3faCd12FeE4B242cAaBD01315C42d840fb75010d` |
| Paymaster | `0x9a2014ad25159faF44736CaAba6F8a49477766A4` |

EntryPoint (ERC-4337 v0.7): `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
PolicySigner: `0xFbfA21E9931F647Bd6cC5be9E1a0dd9a41DA535e`
Artifact: `Enigma/contracts/deployments/sepolia.json`

## Key Decisions (accumulated)
- **Deployed to Ethereum Sepolia (chainId 11155111)** — not Base Sepolia. User override applied in 02-03.
- **Deployer-per-contract pattern** — OrgFactory was 29848 bytes (over EIP-170 limit); split into MembershipNFTDeployer + OrgGovernorDeployer + thin OrgFactory (1526 bytes).
- **MembershipNFTDeployer and OrgGovernorDeployer unverified on Etherscan** — via_ir bytecode mismatch; OrgFactory, RecoveryRegistry, Paymaster are verified.

## Key Open Issues
1. **Signer endpoint auth** — Still open; need HMAC or API-key before public exposure
2. **Subgraph not deployed** — Signer falls back to "trust any target" when SUBGRAPH_URL empty; Phase 3 schema/mappings drafted but not shipped to The Graph
3. **Bundler testing** — Fork test verifies EP interface, not bundler storage-rule strictness; no E2E UserOp run through real Pimlico/Alchemy yet
4. **Paymaster unfunded** — Zero deposit on Sepolia; blocks live UserOp testing of Phase 4 UI
5. **Deployer contract verification** — MembershipNFTDeployer and OrgGovernorDeployer have via_ir bytecode mismatch on Etherscan
6. **Phase 1 finish-up** — RPC/Pinata/XMTP/WalletConnect integration only ~60% complete; revisit before mainnet

## Tech Stack
- **Contracts:** Foundry (Solidity 0.8.28, via_ir=true)
- **App:** React Native + Expo
- **Messaging:** XMTP SDK
- **Indexing:** The Graph
- **Gas sponsorship:** ERC-4337 Pimlico/Alchemy
- **Chain:** Ethereum Sepolia (testnet) → Base (mainnet in Phase 5)
- **Test coverage:** 72 contract tests + 159 app tests passing

## Assumptions
- Phase 1-2 code exists and is functional
- The Graph hosted service is available on Ethereum/Base
- Pimlico/Alchemy bundlers are available on Ethereum Sepolia
