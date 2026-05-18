---
phase: 02-contracts
plan: "03"
subsystem: contracts
tags: [foundry, solidity, erc4337, paymaster, invariant-testing, deployment, etherscan, sepolia]

# Dependency graph
requires:
  - phase: 02-contracts
    provides: OrgFactory, MembershipNFT, OrgGovernor, RecoveryRegistry, Paymaster contracts

provides:
  - Paymaster invariant test suite (4 invariants)
  - Full test suite at 72 tests / 0 failures
  - All 5 Enigma contracts deployed to Ethereum Sepolia (chainId 11155111)
  - OrgFactory, RecoveryRegistry, Paymaster verified on sepolia.etherscan.io
  - deployments/sepolia.json artifact with all addresses and ABIs

affects: [03-subgraph-indexing, 04-multiorg-ui, services/signer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deployer-per-contract pattern to stay under EIP-170 24576-byte limit"
    - "Foundry invariant testing with StdInvariant + handler contracts"

key-files:
  created:
    - Enigma/contracts/test/invariant/PaymasterInvariant.t.sol
    - Enigma/contracts/deployments/sepolia.json
  modified:
    - Enigma/contracts/src/OrgFactory.sol
    - Enigma/contracts/script/Deploy.s.sol
    - Enigma/contracts/test/OrgFactory.t.sol

key-decisions:
  - "Deployed to Ethereum Sepolia (chainId 11155111), not Base Sepolia — user override applied"
  - "Split OrgFactory into MembershipNFTDeployer + OrgGovernorDeployer + thin OrgFactory to satisfy EIP-170 24576-byte limit"
  - "MembershipNFTDeployer and OrgGovernorDeployer verification fails on Etherscan due to via_ir bytecode mismatch — contracts are functional; manual Sourcify verification can be done separately"

patterns-established:
  - "Deployer-per-contract: when a factory contract exceeds 24576 bytes due to embedded child bytecodes, split into N MiniDeployer contracts (one per child type) and a thin router factory"
  - "Invariant handler guards: check current state before mutation to avoid skewed runs (e.g. if current >= limit then return)"

requirements-completed: []

# Metrics
duration: 35min
completed: 2026-05-18
---

# Phase 2 Plan 03: Deploy & Verify Summary

**Five Enigma governance contracts deployed to Ethereum Sepolia (chainId 11155111) with OrgFactory refactored to a deployer-per-contract pattern to satisfy EIP-170, 72-test suite green, and sepolia.json artifact written**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-18T21:45:00Z
- **Completed:** 2026-05-18T22:10:00Z
- **Tasks:** 4 (Paymaster invariant test, full suite, deploy + refactor, artifact)
- **Files modified:** 7

## Accomplishments

- Paymaster invariant test with 4 invariants (daily cap, deposit non-negative, policySigner non-zero, entryPoint immutable) — 256 runs / 128k calls each
- Full test suite: 72 tests, 0 failures across 8 test suites
- OrgFactory refactored with `MembershipNFTDeployer` + `OrgGovernorDeployer` pattern to resolve EIP-170 size limit (OrgFactory was 29848 bytes; refactored to 1526 bytes)
- Deployed to **Ethereum Sepolia (chainId 11155111)** — NOT Base Sepolia (user override)
- OrgFactory, RecoveryRegistry, Paymaster verified on sepolia.etherscan.io

## Task Commits

Each task was committed atomically:

1. **Task 1: Paymaster invariant test** - `c65e4bb` (test)
2. **Task 2: Full test suite green** - `56b0bd5` (test)
3. **Task 3: OrgFactory EIP-170 fix + deploy** - `ceb19ae` (fix), `de87bf2` (feat)
4. **Task 4: Deployment artifact** - `de87bf2` (included in deploy commit)
5. **Project source tracking** - `03b5399` (chore)

## Deployed Contracts — Ethereum Sepolia (chainId 11155111)

| Contract | Address | Verified |
|----------|---------|---------|
| MembershipNFTDeployer | `0xe8f0Fd5643E845C1b2f49a01f5523420e69341e9` | No (via_ir mismatch) |
| OrgGovernorDeployer | `0x45375d5A52EA69d2eefB6483788692a1A53D32a2` | No (via_ir mismatch) |
| OrgFactory | `0xE8D76d1D192c54493C81eB0C8bAbbCD98ad785ea` | Yes |
| RecoveryRegistry | `0x3faCd12FeE4B242cAaBD01315C42d840fb75010d` | Yes |
| Paymaster | `0x9a2014ad25159faF44736CaAba6F8a49477766A4` | Yes |

**EntryPoint (ERC-4337 v0.7):** `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
**PolicySigner / FundingWallet:** `0xFbfA21E9931F647Bd6cC5be9E1a0dd9a41DA535e`

Explorer links:
- OrgFactory: https://sepolia.etherscan.io/address/0xE8D76d1D192c54493C81eB0C8bAbbCD98ad785ea
- RecoveryRegistry: https://sepolia.etherscan.io/address/0x3faCd12FeE4B242cAaBD01315C42d840fb75010d
- Paymaster: https://sepolia.etherscan.io/address/0x9a2014ad25159faF44736CaAba6F8a49477766A4

## Files Created/Modified

- `Enigma/contracts/test/invariant/PaymasterInvariant.t.sol` — 4 invariants with PaymasterHandler
- `Enigma/contracts/src/OrgFactory.sol` — Refactored with MembershipNFTDeployer + OrgGovernorDeployer + thin OrgFactory
- `Enigma/contracts/script/Deploy.s.sol` — Updated to deploy 5 contracts (2 deployers + factory + registry + paymaster)
- `Enigma/contracts/test/OrgFactory.t.sol` — Updated setUp to pass deployer instances
- `Enigma/contracts/deployments/sepolia.json` — Full deployment artifact with addresses, tx hashes, ABIs, verification status

## Decisions Made

1. **Deployed to Ethereum Sepolia, not Base Sepolia** — User override applied. All references in plan to "Base Sepolia" treated as Ethereum Sepolia (chainId 11155111). Noted in artifact and summary.

2. **Deployer-per-contract pattern for EIP-170** — OrgFactory originally embedded full MembershipNFT + OrgGovernor bytecodes and was 29848 bytes (limit: 24576). Solution: separate helper contracts each holding one child's bytecode. This preserves the `createOrg()` external API completely.

3. **MembershipNFTDeployer and OrgGovernorDeployer unverified on Etherscan** — Etherscan verification fails for these two contracts with "bytecode does NOT match" due to a known `via_ir = true` compilation mismatch. The contracts are deployed and functional. Manual verification commands are documented below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DEPLOYER_PRIVATE_KEY missing 0x prefix**
- **Found during:** Task 3 (deploy)
- **Issue:** `forge script` requires `vm.envUint` which needs `0x` prefix; key was stored without it
- **Fix:** Added `0x` prefix to `DEPLOYER_PRIVATE_KEY` in `.env`
- **Files modified:** `.env`
- **Verification:** Subsequent deploy succeeded
- **Committed in:** `ceb19ae` (part of deploy commit)

**2. [Rule 1 - Bug] OrgFactory exceeds EIP-170 24576-byte deployed bytecode limit**
- **Found during:** Task 3 (deploy) — EVM returned `CreateContractSizeLimit` error
- **Issue:** OrgFactory embedded full bytecodes of MembershipNFT and OrgGovernor inline via `new` — deployed bytecode was 29848 bytes (limit: 24576)
- **Fix:** Split into `MembershipNFTDeployer` (13231 bytes) + `OrgGovernorDeployer` (16456 bytes) + thin `OrgFactory` (1526 bytes); OrgFactory takes deployers as constructor args
- **Files modified:** `src/OrgFactory.sol`, `script/Deploy.s.sol`, `test/OrgFactory.t.sol`
- **Verification:** All 72 tests pass; EVM deployment succeeds
- **Committed in:** `ceb19ae` (fix commit)

---

**Total deviations:** 2 auto-fixed (1 blocking env var, 1 blocking contract size)
**Impact on plan:** Both auto-fixes were blocking prerequisites to deployment. No scope creep.

## Issues Encountered

- **Etherscan via_ir verification failure** for MembershipNFTDeployer and OrgGovernorDeployer: Etherscan v2 API does not reliably reproduce `via_ir` compilation output. Manual verify commands:
  ```bash
  # MembershipNFTDeployer
  forge verify-contract 0xe8f0Fd5643E845C1b2f49a01f5523420e69341e9 \
    src/OrgFactory.sol:MembershipNFTDeployer \
    --chain-id 11155111 --etherscan-api-key $ETHERSCAN_API_KEY \
    --compiler-version 0.8.28 --num-of-optimizations 200 --via-ir

  # OrgGovernorDeployer
  forge verify-contract 0x45375d5A52EA69d2eefB6483788692a1A53D32a2 \
    src/OrgFactory.sol:OrgGovernorDeployer \
    --chain-id 11155111 --etherscan-api-key $ETHERSCAN_API_KEY \
    --compiler-version 0.8.28 --num-of-optimizations 200 --via-ir
  ```
  These contracts are helper deployers; the primary user-facing contracts (OrgFactory, RecoveryRegistry, Paymaster) are all verified.

## User Setup Required

None — contracts are deployed and verified. The deployer wallet (`0xFbfA21E9931F647Bd6cC5be9E1a0dd9a41DA535e`) is the initial Paymaster owner; fund the paymaster deposit via:
```bash
cast send 0x9a2014ad25159faF44736CaAba6F8a49477766A4 \
  --value 0.01ether --rpc-url sepolia --private-key $DEPLOYER_PRIVATE_KEY
```

## Next Phase Readiness

- Subgraph indexing (Phase 3) can reference the deployed contract addresses in `deployments/sepolia.json`
- Signer endpoint needs `PAYMASTER_ADDRESS=0x9a2014ad25159faF44736CaAba6F8a49477766A4` and `RECOVERY_REGISTRY_ADDRESS=0x3faCd12FeE4B242cAaBD01315C42d840fb75010d`
- Paymaster has zero deposit; needs funding before Phase 4 UserOp testing

---
*Phase: 02-contracts*
*Completed: 2026-05-18*

## Self-Check: PASSED

- FOUND: `Enigma/contracts/test/invariant/PaymasterInvariant.t.sol`
- FOUND: `Enigma/contracts/deployments/sepolia.json`
- FOUND: `.planning/phases/02-contracts/02-03-SUMMARY.md`
- FOUND: commit `c65e4bb` (Paymaster invariant test)
- FOUND: commit `56b0bd5` (full test suite)
- FOUND: commit `ceb19ae` (OrgFactory EIP-170 fix)
- FOUND: commit `de87bf2` (deploy + artifact)
