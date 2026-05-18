# Codebase Concerns

**Analysis Date:** 2026-05-18

## Security Issues

### Signer Endpoint Missing Authentication

**Risk:** The `/sponsor` endpoint in the signer service is publicly exposed without authentication.

- **Files:** `services/signer/src/index.ts` (line 176), `services/signer/README.md` (line 72)
- **Problem:** Any attacker can call `POST /sponsor` to request signatures for ERC-4337 UserOps. The on-chain paymaster has per-day limits (10 ops), but an attacker could rapidly cycle through addresses to exhaust the daily budget across many accounts.
- **Current mitigation:** On-chain daily limit (10 ops per address per UTC day) and autopause floor provide bounded damage, but off-chain verification is missing.
- **Recommendation:** Add HMAC or API-key authentication before mainnet deployment. Options:
  - HMAC-SHA256 signed requests (compute HMAC(secret, method+path+body), include in header)
  - Bearer token with rotation capability
  - Rate limiting by IP + request throttling
  - Deploy behind authenticated gateway/API management layer

---

### Hardcoded Funding Wallet Address

**Risk:** The paymaster's funding wallet is hardcoded in the contract.

- **Files:** `contracts/src/Paymaster.sol` (line 37)
- **Value:** `0xFbfA21E9931F647Bd6cC5be9E1a0dd9a41DA535e`
- **Problem:** If this address is compromised or the private key leaks, an attacker can fund the paymaster and drain it. The contract only allows deposits from this address or the owner, so compromise of the funding wallet is a direct attack vector.
- **Recommendation:** Store funding wallet as a settable parameter (add `setFundingWallet(address)` admin function) rather than constant, or use a multi-sig for the funding wallet.

---

### Private Key Management in WalletContext

**Risk:** Private key is stored in react-native-keychain, but there's a potential window of exposure in memory.

- **Files:** `app/src/context/WalletContext.tsx` (lines 74–83, 136)
- **Problem:** The keychain stores encrypted keys, but `persistLocalKey` reads the raw hex string from memory and passes it to Keychain. On mobile, if the app is backgrounded or terminated unexpectedly, key material may persist in memory longer than intended.
- **Recommendation:** 
  - Add explicit zeroing of key material after use (use tweetnacl or sodium's secure memory operations if available)
  - Consider splitting key import into ephemeral + persistence phases
  - Add explicit key cleanup on app suspend
  - Use biometric unlock before key material enters memory

---

## Test Coverage Gaps

### App Contexts: No Unit Tests

**What's not tested:** Integration of voting, messaging, and wallet contexts.

- **Files:** `app/src/context/VotingContext.tsx`, `app/src/context/MessagingContext.tsx`, `app/src/context/WalletContext.tsx`
- **Risk:** Breaking changes in React Hook patterns, context value memoization, or state initialization won't surface until runtime in the app.
- **Priority:** High — these are critical UI integration points.
- **Recommendation:** Add Jest tests for:
  - `useWallet()` hook initialization and state updates
  - `useVoting()` proposal fetching and vote casting flow
  - `useMessaging()` thread initialization and message sending
  - Verify context providers render children correctly
  - Test error boundaries and fallback states

---

### Signer Service: No Tests

**What's not tested:** The `/sponsor` endpoint business logic.

- **Files:** `services/signer/src/index.ts`
- **Test framework configured:** Vitest in `package.json` but no test files exist
- **Risk:**
  - Membership age checks could regress (line 101: `Number(since) + MEMBERSHIP_AGE_SECONDS > now`)
  - Subgraph target validation could silently fail when `SUBGRAPH_URL` is absent (line 152: fallback to `true`)
  - Signature generation could be broken by ethers library updates
  - Selector allowlist could be misconfigured during deployment
- **Priority:** High — the signer is a financial attack surface.
- **Recommendation:** Add Vitest tests for:
  - `evaluateSponsorship()` function with valid/invalid inputs
  - Membership age gate enforcement
  - Selector allowlist validation
  - SUBGRAPH_URL fallback behavior (dev mode)
  - Signature verification round-trip
  - Request validation (Zod parsing)

---

### Contract Tests: Recovery Registry Not Fully Tested

**What's not tested:** The `RecoveryRegistry.executeRecovery()` function.

- **Files:** `contracts/test/` (no RecoveryRegistry test file exists)
- **Risk:** Line 108–111 in `RecoveryRegistry.sol` is a no-op (`m;` suppresses unused warning but doesn't actually rebind membership). The execution path has complex state cleanup (burn + re-mint NFTs) that isn't validated.
- **Priority:** Critical — recovery is a user-facing safety feature.
- **Recommendation:** Create `test/RecoveryRegistry.t.sol` covering:
  - `setDelegates()` validation (threshold = ceil(N/2))
  - `proposeRecovery()` with multiple delegates
  - `approveRecovery()` counter increments and duplicate detection
  - `executeRecovery()` after timelock with threshold met
  - NFT rebinding across multiple orgs (currently stubbed)
  - Cancellation of pending recovery

---

### Paymaster Fork Tests: Bundler Integration Not Covered

**What's not tested:** Real ERC-4337 bundler compatibility.

- **Files:** `contracts/test/PaymasterFork.t.sol` (covers basic EntryPoint interaction but not bundler)
- **Risk:** The paymaster works against the canonical EntryPoint on Base, but bundlers may have different expectations around:
  - Gas estimation accuracy (using `verificationGasLimit` and `postOpGasLimit`)
  - Signature format validation edge cases
  - State access during validation (paymaster state, membership contract state)
- **Recommendation:** Add Bundler-specific fork tests using Pimlico or Stackup testnet:
  - Submit a full UserOp through a bundler's simulation API
  - Verify bundler accepts the UserOp without reversion
  - Test against multiple EntryPoint versions if supporting v0.6 later

---

## Tech Debt

### Voting Context: Hardcoded Mock Proposal

**Problem:** The voting context returns a hardcoded mock proposal instead of fetching from The Graph or contracts.

- **Files:** `app/src/context/VotingContext.tsx` (lines 27–37)
- **Impact:** Developers relying on this context will see dummy data. No contract integration is wired up.
- **Fix approach:**
  - Implement `fetchProposals()` to call The Graph subgraph (set `subgraphUrl` from config)
  - Parse Governor proposal events and metadata (stored on IPFS)
  - Update types to match actual Governor contract interface

---

### Voting Context: Placeholder `castVoteOnChain()`

**Problem:** The vote casting function is a no-op console.log.

- **Files:** `app/src/context/VotingContext.tsx` (lines 44–47)
- **Impact:** Voting UI can be built, but actual on-chain voting won't work until this is implemented.
- **Fix approach:**
  - Integrate with ERC-4337 EntryPoint to submit UserOp with vote calldata
  - Call `/sponsor` endpoint to get signature and paymasterAndData
  - Submit via bundler or directly if signer has gas
  - Track UserOp status (pending, confirmed, failed)

---

### Voting Context: `getVotingPower()` Always Returns Zero

**Problem:** The function returns `0n` regardless of membership state.

- **Files:** `app/src/context/VotingContext.tsx` (lines 74–77)
- **Impact:** UI can't show user's voting power; voting button state can't be conditional.
- **Fix approach:**
  - Call `balanceOf(userAddress)` on the active org's MembershipNFT contract
  - Cache result with appropriate TTL (block-based expiry)
  - Update on wallet change or org switch

---

### WalletContext: Hardcoded RPC Fallback

**Problem:** The RPC URL falls back to Ethereum mainnet instead of configured chain.

- **Files:** `app/src/context/WalletContext.tsx` (line 70)
- **Value:** `'https://ethereum.publicnode.com'`
- **Impact:** Users on Base Sepolia/mainnet may accidentally interact with Ethereum mainnet if config is not set, causing fund loss.
- **Fix approach:**
  - Remove fallback to Ethereum
  - Require RPC_URL in app config (fail at startup if missing)
  - Validate RPC chain matches app config chainId

---

### WalletContext: Hardcoded Ethereum Mainnet Chain ID

**Problem:** `connectMetaMask()` and state initialization hardcode chainId = 1.

- **Files:** `app/src/context/WalletContext.tsx` (lines 82, 109, 121)
- **Impact:** Users connecting via MetaMask are stuck on mainnet, even if app is running on Base Sepolia or Base mainnet.
- **Fix approach:**
  - Read `chainId` from `getExtra()` config and use in all wallet operations
  - Validate WalletConnect session namespace matches configured chain
  - Add chain-switching UI if multi-chain support is needed

---

### Contracts: Missing Batch Recovery Implementation

**Problem:** `RecoveryRegistry.executeRecovery()` calculates which orgs to rebind but doesn't actually call the MembershipNFT burn/mint functions.

- **Files:** `contracts/src/RecoveryRegistry.sol` (lines 105–112)
- **Code:** Loop over `p.orgs` but NFT operations are commented out/stubbed
- **Impact:** Recovery mechanism doesn't actually rebind identity on-chain; users will be stuck without membership in their orgs after recovery is "executed".
- **Fix approach:**
  - Implement the loop to burn old NFT and mint new one for each org
  - Add access control: caller must be org owner or recovery registry owner
  - Emit events for each rebind
  - Handle orgs where user doesn't have membership (gracefully skip)

---

### SUBGRAPH_URL Optional But Critical for Production

**Problem:** The signer service skips target validation when `SUBGRAPH_URL` is missing (dev mode fallback).

- **Files:** `services/signer/src/index.ts` (lines 151–162)
- **Impact:** In production, if env var is unset or the subgraph is unavailable, ANY caller can request signatures for unknown targets, bypassing safety checks.
- **Fix approach:**
  - Change default from empty string to required (no `.optional()`)
  - Add startup health check: validate subgraph connectivity on server init
  - Fail fast if subgraph is unreachable at startup
  - Add circuit breaker: if subgraph fails, return 503 instead of silently accepting requests

---

### App Config: No Runtime Validation

**Problem:** Contract addresses and subgraph URL are read from config but never validated.

- **Files:** `app/app.config.ts` (lines 22–24)
- **Impact:** If a developer mis-pastes an address (wrong chain, typo), the app will fail at first contract call without clear error message.
- **Fix approach:**
  - Add Zod schema validation in `getExtra()` in `utils/contracts.ts`
  - Validate addresses are 0x-prefixed hex of correct length
  - Validate URLs are valid HTTP(S)
  - Fail at app startup if config is invalid

---

## Performance Bottlenecks

### Messaging Thread List Initialization

**Problem:** `MessagingContext` fetches all conversations on `initClient()` without pagination or lazy loading.

- **Files:** `app/src/context/MessagingContext.tsx` (line 40)
- **Impact:** If a user has hundreds of XMTP conversations, the initial load will block the UI.
- **Recommendation:**
  - Paginate conversation listing (limit 50, load more on scroll)
  - Cache and only update on new message/conversation
  - Add loading state and skeleton UI during fetch

---

### Fetching Voting Power Per Address

**Problem:** No caching of voting power; every UI render could trigger a new contract call.

- **Files:** `app/src/context/VotingContext.tsx` (lines 74–77)
- **Impact:** If voting power is checked during proposal detail view rendering, each re-render queries the contract.
- **Recommendation:**
  - Add SWR or React Query for caching with revalidation on block change
  - Cache key: `(membershipAddress, userAddress)`
  - Revalidate on wallet change or org switch

---

## Known Limitations

### Paymaster v1: Single Shared Paymaster

**Limitation:** All orgs share a single paymaster with a global daily rate limit (10 ops per address).

- **Files:** `contracts/src/Paymaster.sol` (line 34)
- **Impact:** If Org A and Org B both need to sponsor votes, they compete for the same op budget. A large org voting event could exhaust the paymaster for smaller orgs.
- **Post-v1 consideration:** Per-org paymasters with independent funding (v2 feature in SPEC.md, line 321).

---

### Recovery Registry: Manual NFT Rebind

**Limitation:** `executeRecovery()` prepares the rebind but doesn't execute it on-chain (currently stubbed).

- **Files:** `contracts/src/RecoveryRegistry.sol` (lines 105–112)
- **Impact:** Recovery recovery data is stored, but an admin must manually call `MembershipNFT.burn()` + `mint()` for each org.
- **Better approach:** Have the recovery registry call the NFT contract directly (requires setting it as approved burner or owner).

---

## Fragile Areas

### Signer Service: Signature Verification Round-Trip

**Files:** `services/signer/src/index.ts` (lines 110–118, 177–178)

**Why fragile:**
- Off-chain signer computes and signs `policyDigest()` using ethers library
- On-chain paymaster must recompute the same digest with `_policyDigest()` and verify signature
- If digest computation differs (field order, encoding, chainId), signature verification fails silently

**Safe modification:**
- Add integration tests that call the signer service and verify the returned paymasterAndData against on-chain validation
- Use PaymasterFork.t.sol to test the full round-trip
- Document the exact encoding in comments (both files)

---

### Membership Age Checking: Boundary Condition

**Files:** `services/signer/src/index.ts` (line 101), `contracts/src/MembershipNFT.sol` (line 63)

**Why fragile:**
- Line 101: `Number(since) + MEMBERSHIP_AGE_SECONDS > now` uses strict greater-than, so a member minted exactly 1 hour ago is rejected
- Off-by-one errors if block timestamp is not precisely synced between signer and blockchain

**Safe modification:**
- Add unit tests with exact boundary times (now = 1 hour, 1 hour + 1 second, etc.)
- Consider ≥ instead of > to be more generous (member at exactly 1 hour should pass)

---

### WalletConnect Integration: URI Not Displayed

**Files:** `app/src/context/WalletContext.tsx` (lines 106–115)

**Why fragile:**
- `connectMetaMask()` generates a WalletConnect URI but comment says "show QR or trigger deep link from UI; here we assume UI handles it"
- If UI never displays the URI, the connection never completes
- No error handling if `approval()` times out

**Safe modification:**
- Return the URI from `connectMetaMask()` so UI can render QR
- Add timeout handling with user-friendly error message
- Test with actual MetaMask on testnet before production

---

## Missing Critical Features

### Org Switcher UI Not Implemented

**Problem:** The SPEC describes multi-org UI (org switcher, per-org tabs) but the app has no UI for switching organizations.

- **Impact:** Users can only interact with one org at a time; the core multi-org feature is not functional.
- **Blocks:** Governance feature is incomplete.

---

### Subgraph Not Deployed

**Problem:** SPEC.md section 4.3 describes subgraph queries for org lists and proposals, but no subgraph repository exists.

- **Impact:** Voting/org discovery features can't be completed without subgraph deployment.
- **Blocks:** Voting and org discovery features.

---

### ERC-4337 Bundler Integration Not Implemented

**Problem:** The app has no code to submit UserOps to a bundler (Pimlico, Stackup, etc.).

- **Impact:** `castVoteOnChain()` is stubbed; votes can't actually be submitted even after signer integration is done.
- **Blocks:** On-chain voting feature.

---

## Environment Configuration Issues

### Optional Contract Addresses in Config

**Problem:** Contract addresses are optional in config (lines 22–24 in `app.config.ts`), defaulting to empty string.

- **Files:** `app/app.config.ts`
- **Impact:** If an address is missing, the app won't fail until a user tries to vote/join an org, causing a cryptic error.
- **Recommendation:** Validate at startup that all required addresses are present and valid.

---

### No .env Example for App

**Problem:** The signer service has `.env.example` but the app does not.

- **Files:** `services/signer/.env.example` (exists), `app/` (no .env template)
- **Impact:** Developers must guess which env vars to set (WALLETCONNECT_PROJECT_ID, RPC_URL, SUBGRAPH_URL, PINATA_JWT).
- **Recommendation:** Create `app/.env.example` with all required/optional vars documented.

---

## Dependency Risk

### XMTP SDK Integration Point

**Risk:** The app depends on `@xmtp/react-native-sdk`, which is a specialized mobile SDK with limited community.

- **Files:** `app/src/context/MessagingContext.tsx` (line 3)
- **Mitigation:** The SPEC locks XMTP as the messaging provider, so switching later is not an option.
- **Recommendation:** Thoroughly test XMTP on both iOS and Android before release; have a contingency plan for SDK bugs.

---

### Pinata Dependency

**Risk:** The app pins proposals and org metadata to IPFS via Pinata SDK.

- **Files:** `app/src/utils/storage.ts` (line 2)
- **Impact:** If Pinata service is down, proposal creation and org creation fail.
- **Recommendation:**
  - Add timeout handling (5–10 seconds)
  - Fall back to local file storage with manual IPFS later
  - Add user-facing error messages for Pinata failures

---

## Summary of Blockers for Production

| Issue | Severity | Phase |
|-------|----------|-------|
| Signer endpoint not authenticated | Critical | Before mainnet |
| RecoveryRegistry.executeRecovery() stubbed | Critical | Before v1 release |
| Bundler integration not implemented | Critical | Before voting feature |
| Subgraph not deployed | High | Before voting/discovery |
| Org switcher UI missing | High | Before multi-org feature |
| WalletContext chain hardcoded to mainnet | High | Before Base integration |
| App contexts have no tests | High | Before production |
| Signer service has no tests | High | Before production |
| Config addresses not validated at startup | Medium | Before deployment |
| Paymaster funding wallet hardcoded | Medium | Consider for v1.1 |

---

*Concerns audit: 2026-05-18*
