# Codebase Structure

**Analysis Date:** 2026-05-18

## Directory Layout

```
Enigma/
├── README.md                       # Project overview
├── SPEC.md                         # Technical specification (vision, architecture, phases)
├── LICENSE                         # MIT license
├── .planning/                      # GSD planning artifacts
│   └── codebase/                   # Generated analysis documents
├── app/                            # React Native Expo mobile application
│   ├── App.tsx                     # Root navigator setup
│   ├── package.json                # App dependencies, Expo config
│   ├── tsconfig.json               # TypeScript strict mode config
│   └── src/
│       ├── context/                # State management (React Context)
│       │   ├── WalletContext.tsx    # Private key, signer, balance management
│       │   ├── MessagingContext.tsx # XMTP client, DM threads
│       │   └── VotingContext.tsx    # Proposals, vote casting
│       ├── screens/                # UI screens (React Native)
│       │   ├── Wallet/
│       │   │   ├── OnboardingScreen.tsx    # Wallet creation/import/MetaMask connect
│       │   │   └── BalancesScreen.tsx      # Display balance, disconnect
│       │   ├── Messaging/
│       │   │   └── MessagingScreen.tsx     # DM threads, message list, send
│       │   └── Voting/
│       │       └── VotingScreen.tsx        # Proposal list, vote UI
│       └── utils/                  # Utility functions
│           ├── contracts.ts        # RPC provider, ethers contract helpers
│           ├── crypto.ts           # Private key parsing (messaging crypto removed)
│           └── storage.ts          # Pinata IPFS upload/fetch (proposals, org metadata)
│
├── contracts/                      # Smart contracts (Foundry)
│   ├── foundry.toml                # Forge config: solc 0.8.28, optimization, remappings
│   ├── README.md                   # Contract deployment instructions
│   ├── src/                        # Smart contract source code
│   │   ├── OrgFactory.sol          # Factory: deploys (MembershipNFT, OrgGovernor) pairs
│   │   ├── MembershipNFT.sol       # Soulbound ERC-721 with voting power (ERC-721Votes)
│   │   ├── OrgGovernor.sol         # OpenZeppelin Governor, reads from MembershipNFT
│   │   ├── RecoveryRegistry.sol    # Social recovery: delegates + timelock + rebinding
│   │   └── Paymaster.sol           # ERC-4337 v0.7 verifying paymaster, gas sponsorship
│   ├── script/
│   │   └── Deploy.s.sol            # Foundry script: deploy core contracts + configure
│   ├── test/                       # Foundry test files
│   │   ├── MembershipNFT.t.sol     # Unit tests for soulbound behavior
│   │   ├── Paymaster.t.sol         # Unit tests for sponsorship logic
│   │   ├── PaymasterFork.t.sol     # Fork tests (mainnet integration)
│   │   └── mocks/
│   │       └── MockEntryPoint.sol  # Mock ERC-4337 EntryPoint for testing
│   ├── lib/                        # Foundry dependencies (forge install)
│   │   ├── openzeppelin-contracts/ # @openzeppelin/contracts (ERC721, Governor, etc.)
│   │   ├── account-abstraction/    # ERC-4337 interfaces & types
│   │   └── forge-std/              # Forge test utilities
│   └── out/                        # Compiled artifacts (generated)
│
├── services/                       # Backend services
│   └── signer/                     # Paymaster sponsorship signer service
│       ├── package.json            # Fastify, ethers, zod
│       ├── tsconfig.json           # TypeScript config
│       ├── .env.example            # Environment variables template
│       ├── README.md               # Signer service docs
│       └── src/
│           └── index.ts            # Fastify app: GET /health, POST /sponsor
│
└── docs/                           # Additional documentation (placeholder)
    └── (to be populated)
```

## Directory Purposes

**app/:** React Native Expo mobile application
- Primary codebase for iOS & Android builds
- Single shared TypeScript codebase (no platform-specific code yet)
- Entry point: `app/App.tsx`
- Dev command: `npm run start` (launches Expo CLI)

**app/src/context/:** State management via React Context
- **WalletContext:** Manages Ethereum address, private key (via keychain), balance, signer instances
- **MessagingContext:** Manages XMTP client lifecycle, DM threads, message persistence
- **VotingContext:** Manages proposals (hardcoded placeholder), vote casting functions

**app/src/screens/:** UI Screen components
- **OnboardingScreen:** Entry point after app launch; wallet creation/import options
- **BalancesScreen:** Display balance; wallet info and disconnect
- **MessagingScreen:** DM thread list and message view
- **VotingScreen:** Proposal list and vote submission UI

**app/src/utils/:** Shared utility functions
- **contracts.ts:** Provides ethers JsonRpcProvider, contract factory; reads config from expo config.extra
- **crypto.ts:** Private key validation (X25519/HKDF/AES-GCM messaging crypto removed)
- **storage.ts:** Pinata SDK wrapper for uploading/fetching proposal bodies and org metadata

**contracts/:** Smart contracts (Solidity) and tests
- **src/:** Production contract source
  - **OrgFactory.sol:** Deploys org infrastructure (MembershipNFT + OrgGovernor)
  - **MembershipNFT.sol:** Soulbound voting token (blocks transfers, allows mint/burn)
  - **OrgGovernor.sol:** OpenZeppelin Governor with MembershipNFT voting power
  - **RecoveryRegistry.sol:** Social recovery with delegate quorum and timelock
  - **Paymaster.sol:** ERC-4337 gas sponsorship for voting
- **test/:** Foundry test files (.t.sol suffix)
- **script/:** Foundry deployment scripts
- **lib/:** Dependencies (OpenZeppelin, ERC-4337, Forge stdlib)
- **foundry.toml:** Solc version (0.8.28), optimization, Base RPC endpoints

**services/signer/:** Backend sponsorship signer service
- **src/index.ts:** Fastify server (port 8787)
  - GET /health: Status check
  - POST /sponsor: Validate request, sign paymaster policy digest, return paymasterAndData
- Validates selector allowlist, membership age, daily caps, target whitelist
- Returns signed policy digest for frontend to construct UserOperation

**docs/:** Documentation (currently placeholder)

## Key File Locations

**Entry Points:**
- `app/App.tsx`: Root React Native app, context provider setup, stack navigator
- `app/src/screens/Wallet/OnboardingScreen.tsx`: Initial screen shown after app launch
- `services/signer/src/index.ts`: HTTP server for sponsorship signing

**Configuration:**
- `app/package.json`: Expo app config (scripts, dependencies, jest preset)
- `app/tsconfig.json`: TypeScript strict mode, path alias `@/*` → `src/*`
- `contracts/foundry.toml`: Forge settings, solc version, RPC endpoints, remappings
- `services/signer/.env.example`: Required environment variables for signer service

**Core Logic:**
- `app/src/context/WalletContext.tsx`: Wallet creation, key management, signer instantiation
- `app/src/context/MessagingContext.tsx`: XMTP client init, DM thread management
- `app/src/context/VotingContext.tsx`: Proposal state, vote casting (mostly stubs)
- `contracts/src/OrgFactory.sol`: Org creation logic
- `contracts/src/MembershipNFT.sol`: Membership token logic
- `contracts/src/Paymaster.sol`: Sponsorship validation and policy signing

**Testing:**
- `contracts/test/MembershipNFT.t.sol`: Soulbound enforcement tests
- `contracts/test/Paymaster.t.sol`: Sponsorship logic tests
- `contracts/test/PaymasterFork.t.sol`: Integration tests against mainnet fork
- `app/package.json` (jest config): Test runner configured; no tests yet

**Utilities:**
- `app/src/utils/contracts.ts`: ethers provider and contract helpers
- `app/src/utils/crypto.ts`: Private key validation
- `app/src/utils/storage.ts`: Pinata IPFS integration

## Naming Conventions

**Files:**
- React components: PascalCase, `.tsx` suffix (e.g., `OnboardingScreen.tsx`)
- Utilities: camelCase, `.ts` suffix (e.g., `contracts.ts`)
- Smart contracts: PascalCase, `.sol` suffix (e.g., `OrgFactory.sol`)
- Test files: PascalCase, `.t.sol` suffix (e.g., `MembershipNFT.t.sol`)
- Scripts: PascalCase, `.s.sol` suffix (e.g., `Deploy.s.sol`)

**Directories:**
- Feature folders: PascalCase (e.g., `Wallet`, `Messaging`)
- Lowercase descriptive folders (e.g., `context`, `screens`, `utils`, `src`, `test`)
- No index barrels yet; each file exports directly

**Functions & Variables:**
- Wallet context: camelCase (e.g., `createWallet`, `getSigner`, `persistLocalKey`)
- Messaging context: camelCase (e.g., `initClient`, `startThread`, `sendMessage`)
- React components: hooks exported as `useWallet`, `useMessaging`, `useVoting`
- Smart contract functions: camelCase with onlyOwner/external visibility modifiers
- Smart contract events: PascalCase (e.g., `OrgCreated`, `MemberJoined`)

**Types:**
- React Context types: PascalCase suffix "Context" (e.g., `WalletContextValue`)
- Component props: PascalCase suffix "Props" (not used; using named parameters)
- Smart contract enums: PascalCase (e.g., `JoinPolicy`, `OpKind`)
- Smart contract structs: PascalCase (e.g., `OrgParams`, `Config`, `PendingRecovery`)

## Where to Add New Code

**New Feature (Feature-specific UI + Logic):**
- Primary code: Create `app/src/screens/[Feature]/` for screens; `app/src/context/[Feature]Context.tsx` for state
- Tests: Add `app/[Feature].test.tsx` (Jest) or `contracts/test/[Feature].t.sol` (Foundry)
- Export hooks: `useWallet`, `useMessaging`, etc. from context
- Wire in: Add provider to `app/App.tsx`, add screen to Stack.Navigator

**New Component/Module:**
- Implementation: `app/src/components/[Component]/[Component].tsx` (folder-per-component pattern if needed)
- Export type: Use PascalCase component name, export default component
- Usage: Import and use in screens or other components

**Utilities:**
- Shared helpers: `app/src/utils/[domain].ts` (e.g., `utils/contracts.ts`, `utils/crypto.ts`)
- Contract ABIs: Store as strings in utility files or separate `app/src/abis/` directory (future)
- IPFS/storage: Expand `app/src/utils/storage.ts` with additional pinata operations

**Smart Contracts:**
- Core infrastructure: `contracts/src/[Feature].sol`
- Tests: `contracts/test/[Feature].t.sol` (use Foundry DST for setup, assertions)
- Mocks: `contracts/test/mocks/Mock[Feature].sol` if simulating external contracts
- Deployment: Update `contracts/script/Deploy.s.sol` with new contract deployments

**Backend Services:**
- New signer endpoints: Add routes in `services/signer/src/index.ts` (POST, GET routes)
- New validation logic: Add to `evaluateSponsorship` function or create separate functions
- Export types: Use Zod for schema validation (SponsorRequest pattern)

## Special Directories

**app/src/context/:**
- Purpose: State management layer; each context is a domain
- Generated: No
- Committed: Yes
- Pattern: Each context exports Provider component and hook (useWallet, useMessaging, useVoting)

**contracts/src/:**
- Purpose: Smart contract implementations
- Generated: No
- Committed: Yes
- Note: Compiled output goes to `contracts/out/` (not committed)

**contracts/lib/:**
- Purpose: Forge dependencies (OpenZeppelin, ERC-4337)
- Generated: Yes (via `forge install`)
- Committed: Yes (added as submodules)

**contracts/test/:**
- Purpose: Foundry test suite
- Generated: No (source files)
- Committed: Yes
- Artifacts: Compiled to `contracts/out/` during `forge test`

**app/node_modules/, contracts/node_modules/, services/signer/node_modules/:**
- Purpose: npm/yarn dependencies
- Generated: Yes
- Committed: No (added to .gitignore)

**.planning/codebase/:**
- Purpose: GSD analysis documents (auto-generated)
- Generated: Yes (by GSD map-codebase)
- Committed: Yes (reference artifacts)

---

*Structure analysis: 2026-05-18*
