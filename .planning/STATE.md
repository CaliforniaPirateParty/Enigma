# Enigma Project State

**Project:** Enigma — Multi-org Governance on Base
**Version:** 1.0
**Started:** 2026-05-18
**Current Phase:** 3 (Subgraph + Indexing)

## Completed Phases
- Phase 1: Foundation (RPC, Pinata, XMTP, WalletConnect) — ~60% complete
- Phase 2: Contracts (Foundry contracts) — ~80% complete

## Current Focus
Phases 3 and 4: Subgraph indexing + multi-org UI

## Key Open Issues
1. **Signer endpoint auth** — Currently open; need HMAC or API-key before public exposure
2. **Subgraph validation** — Signer falls back to "trust any target" if SUBGRAPH_URL empty
3. **Bundler testing** — Fork test verifies EP interface, not bundler storage-rule strictness
4. **Real subgraph** — Schema, mappings, deployment on Base Sepolia

## Tech Stack
- **Contracts:** Foundry (Solidity 0.8.20+)
- **App:** React Native + Expo
- **Messaging:** XMTP SDK
- **Indexing:** The Graph
- **Gas sponsorship:** ERC-4337 Pimlico/Alchemy
- **Chain:** Base Sepolia (testnet) → Base (mainnet in Phase 5)

## Dependencies
- Contracts deployed on Base Sepolia
- All test coverage at 95%+
- Project uses GSD for planning/execution

## Assumptions
- Phase 1-2 code exists and is functional
- The Graph hosted service is available on Base
- Pimlico/Alchemy bundlers are available on Base Sepolia
