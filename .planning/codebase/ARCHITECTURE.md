# Architecture

**Analysis Date:** 2026-05-18

## Pattern Overview

**Overall:** Layered mobile-first Web3 architecture with three independent domains (Wallet, Messaging, Governance) coordinated through React Context providers and a smart contract factory pattern.

**Key Characteristics:**
- Domain-driven context providers (WalletContext, MessagingContext, VotingContext) decouple concerns
- XMTP replaces custom messaging — app delegates encryption/delivery to XMTP SDK
- Smart contracts use factory pattern for org deployment (OrgFactory creates paired MembershipNFT + OrgGovernor per org)
- ERC-4337 account abstraction enables sponsored voting via Paymaster
- Pinata IPFS for proposal bodies and org metadata (not messages)
- RPC provider abstraction in contracts.ts for multi-chain readiness

## Layers

**Presentation (React Native UI):**
- Purpose: Mobile screens for onboarding, wallet management, voting, messaging
- Location: `app/src/screens/`
- Contains: Screen components (OnboardingScreen, VotingScreen, MessagingScreen, BalancesScreen)
- Depends on: WalletContext, VotingContext, MessagingContext, contracts.ts utilities
- Used by: App.tsx root navigator

**State Management (React Context):**
- Purpose: Encapsulate domain logic (wallet operations, message threads, proposals/voting)
- Location: `app/src/context/`
- Contains: Three context providers (WalletContext, MessagingContext, VotingContext)
- Depends on: ethers, @xmtp/react-native-sdk, react-native-keychain, AsyncStorage
- Used by: Screen components via hooks (useWallet, useMessaging, useVoting)

**Wallet Layer (WalletContext):**
- Purpose: Manage private keys, Ethereum addresses, signer instances, WalletConnect sessions
- Location: `app/src/context/WalletContext.tsx`
- Key methods: createWallet, importFromMnemonic, importFromPrivateKey, connectMetaMask, getSigner, getBalance
- Storage: react-native-keychain (secure enclave) for local keys; AsyncStorage for wallet state
- Chain: Reads RPC URL from expo config (currently Ethereum mainnet, target Base)

**Messaging Layer (MessagingContext):**
- Purpose: Manage XMTP client initialization, DM threads, message send/receive
- Location: `app/src/context/MessagingContext.tsx`
- Key methods: initClient, startThread, sendMessage, listMessages
- Dependencies: @xmtp/react-native-sdk
- Design: Lazy initializes XMTP client on first use; maintains Map-like thread state
- Note: Per-org group chats (MLS) are future scope; currently DMs only

**Voting Layer (VotingContext):**
- Purpose: Proposal fetching, voting power queries, off-chain signature generation, on-chain vote casting
- Location: `app/src/context/VotingContext.tsx`
- Key methods: fetchProposals, castVoteOnChain, castVoteOffChain, getVotingPower
- Current state: Mostly placeholder; contract ABIs and subgraph integration pending
- Design: Supports both on-chain (via provider) and off-chain (EIP-712 signatures) vote paths

**Smart Contracts Layer:**
- Purpose: On-chain membership, governance, account abstraction
- Location: `contracts/src/`
- Built with: Solidity 0.8.28, Foundry, OpenZeppelin Governor
- Deployment: OrgFactory creates pairs of (MembershipNFT, OrgGovernor); single RecoveryRegistry + Paymaster per chain

**Backend Sponsorship Service:**
- Purpose: Sign paymaster policy digests to enable sponsored voting
- Location: `services/signer/src/index.ts`
- Built with: Fastify, ethers, Zod
- Functionality: Validates sponsor request (selector, target, membership age, daily caps), signs policy digest, returns paymasterAndData
- Public endpoint: POST /sponsor, GET /health

**Storage & External Services:**
- Pinata IPFS: Proposal bodies, org metadata (via `app/src/utils/storage.ts`)
- The Graph: Indexing governance events, member lists (subgraph URL in contracts/script/Deploy.s.sol)

## Data Flow

**Wallet Initialization & Private Key Management:**

1. User launches app → OnboardingScreen
2. User creates wallet (12/24 words) or imports mnemonic/private key
3. WalletContext.createWallet generates HD wallet from entropy
4. Private key persisted to react-native-keychain (hardware-backed)
5. Wallet state (address, chainId, connection type) persisted to AsyncStorage
6. On app restart, WalletContext hydrates state from AsyncStorage; keys re-fetched from keychain on demand

**Message Flow (DMs via XMTP):**

1. Screen calls useMessaging().initClient()
2. MessagingContext.initClient() retrieves signer from useWallet().getSigner()
3. Signer used to register XMTP identity (signature required once per device)
4. XMTP client connected; existing conversations hydrated
5. sendMessage() retrieves or creates Conversation, calls conversation.send(text)
6. Incoming messages persisted by XMTP SDK; app reads from thread.conversation.messages()

**Voting Flow (On-Chain Vote Casting):**

1. Screen calls useVoting().castVoteOnChain(proposalId, choiceIndex)
2. VotingContext retrieves signer from useWallet()
3. Two paths:
   - Off-chain signature path: signer.signTypedData() for EIP-712 vote struct
   - On-chain path: signer.sendTransaction() to Governor.castVote() (future implementation)
4. If sponsored (via paymaster): Frontend calls services/signer POST /sponsor endpoint with sender, target, selector, membership
5. Signer service validates request (membership age, daily caps, selector allowlist), returns paymasterAndData
6. Frontend constructs UserOperation with paymasterAndData, submits to EntryPoint
7. EntryPoint validates via Paymaster.validatePaymasterUserOp(), executes transaction, calls Paymaster.postOp() to increment daily usage

**Org Creation Flow (Via OrgFactory):**

1. User/client calls OrgFactory.createOrg(OrgParams) with org name, symbol, metadata IPFS CID, join policy
2. Factory deploys new MembershipNFT (soulbound ERC-721)
3. Factory deploys new OrgGovernor (extends OpenZeppelin Governor, reads voting power from MembershipNFT)
4. Genesis token minted to creator
5. Ownership transferred: Open policy → creator (allows self-minting); Allowlist/Application → governor (DAO-controlled)
6. OrgCreated event emitted
7. The Graph subgraph indexes event; app queries subgraph to discover orgs

**State Management:**

- WalletContext state: persisted to AsyncStorage (survives app restart)
- MessagingContext threads: in-memory only (re-fetched from XMTP on init)
- VotingContext proposals: in-memory; fetched from subgraph on demand (future implementation)
- All mutable state: useState + useCallback for immutability and re-render optimization

## Key Abstractions

**WalletIdentity:**
- Purpose: Represents authenticated user (address + chain)
- Examples: `{ address: '0xabc...', chainId: 8453 }`
- Pattern: Passed through context to enable multi-chain awareness

**Thread (Messaging):**
- Purpose: Wraps XMTP Conversation with peer address for easy lookup
- Examples: `{ peer: '0x123...', conversation: Conversation }`
- Pattern: Threads keyed by peerAddress for quick DM thread access

**Proposal:**
- Purpose: Represents a governance proposal
- Example: `{ id, title, description, choices, quorum, startBlock, endBlock }`
- Pattern: Currently hardcoded in VotingContext; will be fetched from subgraph + smart contract state

**OrgParams (Smart Contracts):**
- Purpose: Bundle org creation arguments for OrgFactory
- Pattern: Struct-based configuration for consistency across Factory and Governor
- Used by: OrgFactory.createOrg()

**JoinPolicy (Smart Contracts):**
- Purpose: Enum controlling membership minting (Open, Allowlist, Application)
- Pattern: Determines who owns MembershipNFT post-creation
- Enforcement: MembershipNFT ownership transferred to creator (Open) or Governor (Allowlist/Application)

**SponsorRequest & SponsorResult:**
- Purpose: Request/response types for paymaster sponsorship endpoint
- Location: `services/signer/src/index.ts`
- Pattern: Zod-validated JSON schema
- Usage: Frontend encodes sponsor request, backend validates + signs, returns paymasterAndData

## Entry Points

**App (React Native):**
- Location: `app/App.tsx`
- Triggers: App launch
- Responsibilities: Initialize context providers (Wallet, Voting, Messaging), create root stack navigator, render screens

**OnboardingScreen:**
- Location: `app/src/screens/Wallet/OnboardingScreen.tsx`
- Triggers: Initial route after app launch
- Responsibilities: Prompt user to create/import wallet or connect MetaMask

**MessagingScreen:**
- Location: `app/src/screens/Messaging/MessagingScreen.tsx`
- Triggers: User navigates to Messaging tab
- Responsibilities: Display DM threads, render messages, handle send

**VotingScreen:**
- Location: `app/src/screens/Voting/VotingScreen.tsx`
- Triggers: User navigates to Voting tab
- Responsibilities: Fetch + render proposals, display voting UI, submit vote (on-chain or off-chain)

**BalancesScreen:**
- Location: `app/src/screens/Wallet/BalancesScreen.tsx`
- Triggers: User navigates to Balances tab
- Responsibilities: Fetch + display wallet balance, handle disconnect

**OrgFactory (Smart Contracts):**
- Location: `contracts/src/OrgFactory.sol`
- Triggers: External createOrg() call
- Responsibilities: Deploy (MembershipNFT, OrgGovernor) pair, mint genesis token, transfer ownership per policy

**Deploy Script:**
- Location: `contracts/script/Deploy.s.sol`
- Triggers: `forge script` or `forge create` commands
- Responsibilities: Deploy OrgFactory, RecoveryRegistry, Paymaster; configure paymaster selectors

**Sponsorship Signer Service:**
- Location: `services/signer/src/index.ts`
- Triggers: POST /sponsor endpoint from frontend
- Responsibilities: Validate sponsor request, sign policy digest, return paymasterAndData

## Error Handling

**Strategy:** Layered with domain-specific catch-all error handlers in each context.

**Patterns:**

**Wallet Context:**
- Private key parsing errors: thrown and caught by OnboardingScreen (displays Alert)
- Keychain errors: logged; app degrades to WalletConnect-only
- WalletConnect connection errors: Promise rejection caught by UI

**Messaging Context:**
- XMTP client init errors: logged; app shows messaging unavailable
- Thread creation errors: caught by startThread caller (Screen handles Alert)
- Send errors: logged; UX shows "failed to send" with retry

**Voting Context:**
- EIP-712 signing errors: Promise rejection; UI shows "failed to sign vote"
- Contract call errors: ethers library throws; caller catches and displays Alert
- Subgraph fetch errors: logged; app falls back to empty proposal list

**Sponsorship Service:**
- Invalid request body: 400 Bad Request with Zod issues
- Selector not allowed: 403 Forbidden
- Selector not allowed on-chain: 403 Forbidden
- Membership too new: 403 Forbidden
- Daily limit reached: 403 Forbidden (checked on-chain in postOp)
- Paymaster paused or low balance: 503 Service Unavailable

**Smart Contracts:**
- Transfers on MembershipNFT: revert TransfersDisabled()
- Invalid join policy: revert NotOpen() when OpenJoin called on non-open org
- Recovery without delegates: revert NotInitialized()
- Recovery without quorum: revert below threshold (assert in Solidity)

## Cross-Cutting Concerns

**Logging:** 
- App layer: console.log in context methods (visible in Expo CLI or React Native Debugger)
- Signer service: Fastify logger (configured in buildServer)
- Contracts: console2.log in scripts; forge test output for test runs

**Validation:**
- Frontend: Zod schemas for signer request (SponsorRequest)
- Context methods: Ethers library validates addresses, amounts
- Smart contracts: require() statements for input validation; custom errors for revert reasons

**Authentication:**
- Wallet: Private key in keychain; signature required to use signer (WalletContext.getSigner)
- XMTP: Signature-based registration; one identity per signer per device
- Sponsorship: Signature verification in Paymaster.validatePaymasterUserOp via ECDSA recover
- On-chain: Governor checks voting power from MembershipNFT.getVotes(address, blockNumber)

**Multi-Chain Awareness:**
- RPC URL configurable via expo config (app/src/utils/contracts.ts getExtra())
- Currently hardcoded to Ethereum mainnet; target Base mainnet (chainId 8453)
- ChainId passed to ethers JsonRpcProvider
- Smart contracts: Network specified via Foundry config (rpc_endpoints in foundry.toml)

**Rate Limiting:**
- Paymaster: 10 operations per address per UTC day (enforced in postOp increment)
- Membership age gate: 1 hour minimum before vote sponsorship (checked by signer service)
- Selector allowlist: On-chain + off-chain validation (signer service checks both)

---

*Architecture analysis: 2026-05-18*
