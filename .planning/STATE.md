# Enigma Project State

**Project:** Enigma — Multi-org Governance on Base
**Version:** 1.0
**Started:** 2026-05-18
**Current Phase:** 3 (Subgraph + Indexing)
**Last Session:** 2026-05-18 — Completed 02-03-PLAN.md (deploy to Ethereum Sepolia)

## Completed Phases
- Phase 1: Foundation (RPC, Pinata, XMTP, WalletConnect) — ~60% complete
- Phase 2: Contracts (Foundry contracts) — COMPLETE (plan 02-03 deployed)

## Current Focus
Phase 3: Subgraph indexing

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
1. **Signer endpoint auth** — Currently open; need HMAC or API-key before public exposure
2. **Subgraph validation** — Signer falls back to "trust any target" if SUBGRAPH_URL empty
3. **Bundler testing** — Fork test verifies EP interface, not bundler storage-rule strictness
4. **Paymaster unfunded** — Zero deposit on Sepolia; needs ETH before Phase 4 UserOp testing
5. **Deployer contract verification** — MembershipNFTDeployer and OrgGovernorDeployer have via_ir bytecode mismatch on Etherscan

## Tech Stack
- **Contracts:** Foundry (Solidity 0.8.28, via_ir=true)
- **App:** React Native + Expo
- **Messaging:** XMTP SDK
- **Indexing:** The Graph
- **Gas sponsorship:** ERC-4337 Pimlico/Alchemy
- **Chain:** Ethereum Sepolia (testnet) → Base (mainnet in Phase 5)
- **Test coverage:** 72 tests passing (unit + invariant)

## Assumptions
- Phase 1-2 code exists and is functional
- The Graph hosted service is available on Ethereum/Base
- Pimlico/Alchemy bundlers are available on Ethereum Sepolia
