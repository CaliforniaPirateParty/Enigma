# Enigma v1.0 Requirements

## Functional Requirements

### Phase 1–2: Foundation & Contracts
- REQ-001: Mobile app connects to Base Sepolia testnet via WalletConnect
- REQ-002: Users can exchange encrypted DMs via XMTP
- REQ-003: Smart contracts deployed (OrgFactory, MembershipNFT, OrgGovernor, Paymaster, RecoveryRegistry)
- REQ-004: All contracts have full unit + invariant test coverage
- REQ-005: Contracts verified on Basescan

### Phase 3: Subgraph + Indexing
- REQ-301: Subgraph schema defined for Org, Member, Proposal, Vote, Recovery events
- REQ-302: Event mappings written for all deployed contracts
- REQ-303: Subgraph deployed to The Graph on Base Sepolia
- REQ-304: App can query org list, members, proposals, and votes in real time
- REQ-305: Signer endpoint uses subgraph to validate sponsorship targets
- REQ-306: Signer endpoint authenticated (HMAC or API-key)
- REQ-307: E2E UserOp test through real bundler (Pimlico/Alchemy/Stackup)

### Phase 4: Multi-org UI
- REQ-401: Users can switch between orgs and view directory
- REQ-402: Users can join org by minting MembershipNFT via paymaster
- REQ-403: Per-org chat implemented with XMTP groups
- REQ-404: Proposals list and detail screens
- REQ-405: Users can cast votes via paymaster (UserOp sponsorship)
- REQ-406: DM list and thread view
- REQ-407: Recovery setup and initiation UI
- REQ-408: App syncs state with subgraph queries

### Phase 5: Polish & Release
- REQ-501: Design system applied, accessibility audit passed
- REQ-502: iOS + Android store assets created
- REQ-503: TestFlight + Play internal testing set up
- REQ-504: Contracts migrated to Base mainnet
- REQ-505: App released to production

## Non-Functional Requirements
- NFR-001: All smart contracts follow Solidity best practices
- NFR-002: Mobile app targets iOS 14+, Android 10+
- NFR-003: XMTP messaging has <2s delivery time
- NFR-004: UserOps sponsored by paymaster with no user cost
- NFR-005: Subgraph queries return in <500ms
- NFR-006: Social recovery has 7-day timelock

## Out of Scope (v1)
- Multi-chain (v2+)
- Plugin system (v2+)
- Snapshot integration (v1.5)
- Advanced delegation rules (v2+)
- Treasury management (v2+)
