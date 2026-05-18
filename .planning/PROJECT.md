# Enigma – Multi-org Governance on Base

## Vision
Enigma is a mobile-first governance platform for DAOs and organizations. Members coordinate via encrypted messaging (XMTP), cast votes through gas-free sponsorship (ERC-4337 paymaster), and control recovery through social delegates. Built on Base mainnet.

## What We're Building (v1)
- **Smart contracts** – Org factory, soulbound membership NFTs, on-chain governor, social recovery, gas paymaster
- **Mobile app** – Org switcher, per-org chat and proposals, vote casting, recovery flows
- **Indexing** – The Graph subgraph for fast org/proposal/vote queries
- **Messaging** – XMTP for encrypted DMs and group chats
- **Gas sponsorship** – ERC-4337 paymaster lets users vote for free

## Why This Matters
Governance tooling is fragmented (governance = governance layer, messaging = Discord, recovery = Gnosis Safe, etc.). Enigma unifies the stack into a mobile app where members coordinate openly, vote securely, and recover their account if needed—all in one place.

## Success Criteria (v1)
- Orgs can be created and members invited
- Members can send DMs and participate in group chat per org
- Proposals can be created and voted on, with votes settling on-chain
- Recovery is testable end-to-end
- Mobile app works on TestFlight (iOS) and Play internal testing (Android)
- ProductionReady on Base mainnet

## Out of Scope (v1)
- Multi-chain support (Base only)
- Mobile app extensibility / plugin system
- Snapshot integration (v1.5)
- Advanced delegation rules
- Treasury management
