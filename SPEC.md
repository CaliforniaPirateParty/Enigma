# Enigma — Technical Specification

**Status:** Draft v0.1
**Last updated:** 2026-05-18
**Owner:** Darren McKeeman (@dmckeeman)

---

## 1. Vision

Enigma is a mobile-first, web3-native application that combines:

- **Encrypted wallet-to-wallet messaging** between any two Ethereum addresses
- **Multi-organization governance** where any group can mint a soulbound membership NFT collection and use it to coordinate proposals and votes

The app supports multiple concurrent organizations per user — switch between orgs the same way you switch between Discord servers — with voting rights and member discovery scoped to each org's membership NFT collection.

The reference deployment targets the California Pirate Party, but the architecture is intentionally generic: any group can spin up an org without needing to fork the app.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Mobile App (React Native + Expo — iOS & Android)       │
│  ┌─────────────┬──────────────┬──────────────────────┐  │
│  │  Wallet     │  Messaging   │  Governance          │  │
│  │  (ethers)   │  (XMTP SDK)  │  (Org switcher,      │  │
│  │             │              │   proposals, votes)  │  │
│  └─────────────┴──────────────┴──────────────────────┘  │
└────────┬──────────────┬──────────────────┬──────────────┘
         │              │                  │
         ▼              ▼                  ▼
   ┌──────────┐   ┌────────────┐   ┌───────────────────┐
   │  Base    │   │   XMTP     │   │  IPFS (Pinata)    │
   │  RPC +   │   │  Network   │   │  Proposal bodies  │
   │ Paymaster│   │            │   │  & org metadata   │
   └──────────┘   └────────────┘   └───────────────────┘
         │
         ▼
   ┌─────────────────────────────────────────────────┐
   │  Smart Contracts (Base mainnet)                 │
   │  • OrgFactory             (mint new orgs)       │
   │  • MembershipNFT          (ERC-721 soulbound)   │
   │  • OrgGovernor            (per-org Governor)    │
   │  • RecoveryRegistry       (social recovery)     │
   │  • Paymaster              (gas sponsorship)     │
   └─────────────────────────────────────────────────┘
```

**Key principle:** XMTP handles all messaging concerns (key exchange, delivery, persistence, encryption). Smart contracts handle membership and governance only. The app is a thin orchestration layer over both.

---

## 3. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React Native + Expo SDK 51+ | Already chosen, cross-platform |
| Language | TypeScript (strict) | Already chosen |
| Chain | **Base mainnet** (chainId 8453) | Low fees, EVM, Coinbase-backed |
| Wallet | ethers v6 + WalletConnect v2 | Already in repo |
| Account abstraction | ERC-4337 smart accounts + paymaster | Gas sponsorship for voting |
| Messaging | **XMTP** (`@xmtp/react-native-sdk`) | Replaces all custom crypto/IPFS messaging |
| Storage (proposals) | IPFS via Pinata | Proposal bodies, org metadata |
| Secure key storage | `react-native-keychain` | Already in repo |
| Local state | Zustand | Multi-org state needs structured store |
| Smart contracts | Solidity 0.8.24 + OpenZeppelin Governor | Battle-tested governance |
| Contract framework | Foundry | Faster than Hardhat for testing |
| Indexing | The Graph (hosted on Base) | Query orgs, proposals, members |
| Build & deploy | EAS Build + EAS Submit | Cloud builds for iOS + Android |

---

## 4. Chain & Smart Contracts

### 4.1 Network

- **Base mainnet** (chainId 8453) — production
- **Base Sepolia** (chainId 84532) — staging/testnet

### 4.2 Contracts

#### `OrgFactory.sol`

Anyone can call `createOrg()` to spin up a new organization. Deploys a `MembershipNFT` and an `OrgGovernor` with sensible defaults, owned by the creator until handed to the DAO.

```solidity
function createOrg(
    string name,
    string symbol,
    string metadataURI,        // IPFS CID for org info
    uint256 votingDelay,       // in blocks
    uint256 votingPeriod,      // in blocks
    uint256 proposalThreshold, // min NFTs to propose
    JoinPolicy joinPolicy      // Open | Allowlist | Application
) external returns (address membership, address governor);

event OrgCreated(
    address indexed creator,
    address membership,
    address governor,
    string name
);
```

#### `MembershipNFT.sol` (Soulbound ERC-721 + ERC-721Votes)

- One NFT per member per org
- **Soulbound** — `_beforeTokenTransfer` reverts on transfer; only mint and burn allowed
- Supports `ERC721Votes` for snapshot-based voting power
- Mint authority configurable: Governor, admin, or open
- Per-org `metadataURI` points to IPFS for org branding

#### `OrgGovernor.sol` (extends OpenZeppelin Governor)

- Standard Governor with `GovernorVotes` reading from `MembershipNFT`
- Off-chain vote casting via EIP-712 signatures (gasless via paymaster)
- Proposal bodies stored on IPFS; only the CID hash is on-chain
- Default: 1 NFT = 1 vote (configurable for weighted/quadratic in v2)

#### `RecoveryRegistry.sol`

- Each user designates 3–5 recovery delegates (other Ethereum addresses)
- Recovery: after a configurable timelock (default 7 days), a quorum of delegates can re-bind a user's identity to a new address
- Membership NFTs are re-minted to the new address; old NFTs burned
- XMTP identity is updated via XMTP's revocation + re-registration flow
- Per-user, not per-org (one recovery setup covers all orgs the user belongs to)

#### `Paymaster.sol` (ERC-4337 verifying paymaster)

- Sponsors gas for `castVote` and `castVoteBySig` calls only
- Rate-limited per address (anti-abuse): N votes per epoch
- Funded by the Enigma project initially; orgs can fund their own paymaster in v2

### 4.3 Indexing

A Graph subgraph indexes:

- `OrgCreated` events from `OrgFactory`
- All `Governor` proposal/vote/execute events per org
- `MembershipNFT` mint/burn events
- `RecoveryRegistry` delegate-set and recovery events

The app queries the subgraph for org lists, proposals, member counts — avoiding expensive RPC fan-out.

---

## 5. Messaging Layer (XMTP)

XMTP **completely replaces** the existing custom messaging code (`MessagingContext`, message-related helpers in `crypto.ts`, IPFS message upload). The current code is kept in git history as a reference but removed from runtime paths.

### What XMTP provides for free

- End-to-end encrypted DMs between any two Ethereum addresses
- Key registration and discovery (XMTP key bundles)
- Message persistence and delivery
- Group messaging (XMTP v3 / MLS) — used for **per-org chat rooms**
- Push notifications via XMTP's notification server

### Implementation

- `@xmtp/react-native-sdk` for the client
- XMTP identity bound to the user's wallet (one signature to register)
- **Per-org group chats:** each org gets one XMTP group, gated by membership NFT (admin enforces membership)
- **DMs:** any-to-any between any two Ethereum addresses, independent of orgs

### What we lose (and accept)

- Custom X25519/HKDF/AES-GCM message flow is deleted
- IPFS is no longer used for messages (still used for proposal/org metadata)

---

## 6. Multi-Org Membership NFT Model

### Org discovery

- App queries subgraph for all `OrgCreated` events → shows a public directory
- User can also paste a Membership contract address to add an org manually

### User experience

- **Org switcher** at the top of the app (Discord guild list pattern)
- Each org tab shows: chat, proposals, member directory, org info
- User's "joined orgs" = the set of orgs whose membership NFT they hold
- DMs are global (not org-scoped) — separate top-level tab

### Joining an org — three patterns

Set by the org creator at deploy time via `JoinPolicy`:

1. **Open** — anyone can mint themselves a membership NFT
2. **Allowlist** — admin or Governor mints to specific addresses
3. **Application** — submit address, existing members vote to admit

### Voting power

- **1 NFT = 1 vote** by default
- Quadratic or weighted voting configurable at org deploy (v2)
- Snapshot block determined per-proposal by Governor

---

## 7. Mobile Apps (iOS & Android)

### Code-sharing strategy

Single React Native codebase via Expo managed workflow. Custom dev client required for native modules (XMTP SDK, secure enclave biometrics). No need to drop to bare unless a native module forces it.

### Platform-specific work

| Concern | iOS | Android |
|---|---|---|
| Store listing | Apple Developer ($99/yr), screenshots, privacy labels | Google Play Console ($25 one-time) |
| Push notifications | APNs setup, `expo-notifications` | FCM setup, `expo-notifications` |
| Biometric prompts | Face ID Info.plist usage description | BiometricPrompt (auto) |
| Deep linking | Universal Links | App Links via assetlinks.json |
| Bundle ID | `org.californiapirateparty.enigma` | `org.californiapirateparty.enigma` |
| Icons / splash | 1024×1024 + adaptive | Adaptive icon (foreground + background) |
| Crypto compliance | Self-classification (likely exempt under 5D002) | N/A |

### Build & distribution

- **EAS Build** for cloud builds — no local Xcode/Android Studio required
- **EAS Submit** for store uploads
- **TestFlight** (iOS) + **Internal testing track** (Android) for beta
- **OTA updates** via EAS Update for JS-only changes

---

## 8. Gap Analysis vs. Current Scaffold

| Component | Current | Target | Action |
|---|---|---|---|
| Chain | Ethereum mainnet (hardcoded) | Base mainnet + Sepolia | Update RPC URLs, chain ID |
| Messaging | Custom X25519/HKDF/AES-GCM + IPFS, no delivery | XMTP | **Delete and replace** |
| Smart contracts | None | OrgFactory + MembershipNFT + OrgGovernor + RecoveryRegistry + Paymaster | Build from scratch |
| Key exchange | Stubbed (all-zero pubkeys) | Handled by XMTP | Delete custom path |
| Voting power | Returns `0n` | Read from MembershipNFT (ERC721Votes) | Implement |
| Proposals fetch | No-op | Query subgraph | Implement |
| On-chain vote | `console.log` only | `Governor.castVote` / `castVoteBySig` via paymaster | Implement |
| WalletConnect QR | URI ignored | QR display + deep-link handling | Implement |
| Multi-org UI | Single screen | Org switcher + per-org tabs | New UI layer |
| IPFS endpoint | `ipfs.io` (read-only, broken) | Pinata SDK | Replace |
| Account abstraction | None | ERC-4337 smart accounts + paymaster | Add |
| Recovery | None | RecoveryRegistry + delegate flow UI | Build |
| Tests | Configured, zero tests | Unit + contract tests | Build out |
| App store assets | None | Icons, splash, bundle IDs, store listings | Build out |

---

## 9. Implementation Phases

### Phase 1 — Foundation (2-3 weeks)

- Switch RPC to Base Sepolia
- Replace `ipfs-http-client` with Pinata SDK
- Integrate `@xmtp/react-native-sdk`, delete custom messaging crypto
- Wire WalletConnect QR display + deep-link callbacks
- Working DM between two test wallets

### Phase 2 — Contracts (3-4 weeks)

- Write `OrgFactory`, `MembershipNFT` (soulbound), `OrgGovernor`, `RecoveryRegistry`, `Paymaster` in Foundry
- Full unit + invariant tests
- Deploy to Base Sepolia
- Verify on Basescan

### Phase 3 — Subgraph + Indexing (1 week)

- Subgraph schema + mappings
- Deploy to The Graph hosted service on Base
- Query helpers in app

### Phase 4 — Multi-org UI (3-4 weeks)

- Org switcher, org directory, join flows
- Per-org chat (XMTP group), proposals list, proposal detail, vote casting via paymaster
- DM list + thread view
- Recovery setup + recovery initiation UI

### Phase 5 — Polish & Release (2-3 weeks)

- Design system pass, accessibility, error states
- iOS + Android store assets
- TestFlight + Play internal testing beta
- Move to Base mainnet
- Production release

### Phase 6 (v1.5) — Snapshot Interop (2 weeks)

- Import existing Snapshot spaces by ENS name
- Render Snapshot proposals alongside native Governor proposals
- Cast Snapshot votes via EIP-712 signature directly from the app
- Useful for orgs that already use Snapshot and don't want to migrate

**Total estimate (v1):** 11–15 weeks of focused work.

---

## 10. Decisions Locked

| Decision | Choice | Rationale |
|---|---|---|
| Chain | Base mainnet | Low fees, EVM, ecosystem momentum |
| Messaging | XMTP | Replaces all custom crypto, gives us delivery + key exchange |
| Governance unit | Soulbound membership NFT per org | Non-transferable, prevents vote buying |
| Multi-org | Yes, factory pattern | Anyone can create an org |
| Gas sponsorship | ERC-4337 paymaster on Base | Free voting for users |
| Recovery | Social recovery via delegate registry | 3–5 delegates, 7-day timelock |
| Scaffold reuse | Keep wallet/onboarding/Keychain, delete custom messaging | Salvage what works |
| Snapshot | v1.5 (post-launch) | Build native Governor first, add interop later |

---

## 11. Open Questions for v2+

1. **Paymaster funding model** — who pays for gas long-term? Each org funding its own paymaster vs. a shared sponsored pool with rate limits.
2. **Quadratic voting** — interesting for political-party use cases; defer to v2.
3. **Token-gated content within chats** — e.g., proposal-specific subchannels, polls.
4. **Cross-org reputation** — does activity in one org confer trust signals in others?
5. **Mobile-only constraint** — should we also ship a web version? Probably not in v1, but worth revisiting.

---

## 12. Repository Layout (Target)

```
Enigma/
├── SPEC.md                          ← this file
├── README.md
├── pirate-vote-mobile/              ← existing Expo app (to be renamed)
│   └── src/
├── contracts/                       ← new Foundry project
│   ├── src/
│   │   ├── OrgFactory.sol
│   │   ├── MembershipNFT.sol
│   │   ├── OrgGovernor.sol
│   │   ├── RecoveryRegistry.sol
│   │   └── Paymaster.sol
│   ├── test/
│   ├── script/
│   └── foundry.toml
├── subgraph/                        ← new Graph subgraph
│   ├── schema.graphql
│   ├── subgraph.yaml
│   └── src/mapping.ts
└── docs/
    ├── architecture.md
    ├── deployment.md
    └── user-guide.md
```

The app directory may be renamed from `pirate-vote-mobile/` to `app/` once the multi-org pivot is committed — that name is too narrow for the new scope.

---

## 13. References

- [Base documentation](https://docs.base.org/)
- [XMTP protocol](https://xmtp.org/)
- [OpenZeppelin Governor](https://docs.openzeppelin.com/contracts/5.x/api/governance)
- [ERC-4337 account abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [Pinata IPFS](https://www.pinata.cloud/)
- [The Graph on Base](https://thegraph.com/docs/en/deploying/deploying-a-subgraph-to-studio/)
- [Snapshot.org docs](https://docs.snapshot.org/) (for v1.5 interop)
