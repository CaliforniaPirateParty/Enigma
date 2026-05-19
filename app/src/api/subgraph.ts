import { ethers } from 'ethers';
import { getExtra } from '../utils/contracts';
import {
  Org,
  Proposal,
  Member,
  Vote,
  RecoveryDelegate,
  SubgraphResponse,
} from '../types/subgraph';

const QUERY_TIMEOUT = 10000; // 10 seconds

/**
 * Lowercase + reject anything that isn't a valid 20-byte Ethereum address.
 * The subgraph stores addresses lowercased, so callers must match that case.
 */
function normalizeAddress(input: string, field: string): string {
  if (!input || typeof input !== 'string' || !ethers.isAddress(input)) {
    throw new Error(`Invalid ${field}: ${input}`);
  }
  return input.toLowerCase();
}

/**
 * Lowercase address-or-id. Org/member/proposal ids embed an address; subgraph
 * stores them lowercased. We accept either a raw address or a composite id
 * (e.g. `${orgId}-1`) and just lowercase — the subgraph rejects malformed ids.
 */
function normalizeId(input: string, field: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error(`Invalid ${field}: ${input}`);
  }
  return input.toLowerCase();
}

async function querySubgraph<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const { subgraphUrl } = getExtra();
  if (!subgraphUrl) {
    throw new Error('Subgraph URL not configured in app.config.ts');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT);

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Subgraph HTTP ${response.status}`);
    }

    const data: SubgraphResponse<T> = await response.json();

    if (data.errors) {
      throw new Error(`Subgraph error: ${data.errors[0]?.message || 'Unknown error'}`);
    }

    return data.data as T;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Query helper: Get all orgs, paginated
 * IDX-03: App queries subgraph for org list
 */
export async function queryOrgs(first: number = 100, skip: number = 0): Promise<Org[]> {
  const query = `
    query GetOrgs($first: Int!, $skip: Int!) {
      orgs(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
        id
        creator
        membership
        governor
        name
        symbol
        metadataURI
        joinPolicy
        createdAt
        memberCount
      }
    }
  `;

  const data = await querySubgraph<{ orgs: Org[] }>(query, { first, skip });
  return data?.orgs || [];
}

/**
 * Query helper: Get orgs where user holds membership
 * IDX-03: App queries subgraph for user's orgs
 */
export async function queryUserOrgs(userAddress: string): Promise<Org[]> {
  const address = normalizeAddress(userAddress, 'userAddress');
  const query = `
    query GetUserOrgs($address: Bytes!) {
      members(where: { address: $address, active: true }) {
        org {
          id
          creator
          membership
          governor
          name
          symbol
          metadataURI
          joinPolicy
          createdAt
          memberCount
        }
      }
    }
  `;

  const data = await querySubgraph<{ members: Array<{ org: Org }> }>(query, { address });
  const userOrgs = data?.members?.map((m) => m.org) || [];
  // Deduplicate in case user has multiple NFTs in same org (shouldn't happen but safe)
  return Array.from(new Map(userOrgs.map((org) => [org.id, org])).values());
}

/**
 * Query helper: Get proposals for an org
 * IDX-03: App queries subgraph for proposals
 */
export async function queryProposals(
  orgId: string,
  first: number = 100,
  skip: number = 0,
): Promise<Proposal[]> {
  const org = normalizeId(orgId, 'orgId');
  const query = `
    query GetProposals($org: String!, $first: Int!, $skip: Int!) {
      proposals(where: { org: $org }, first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
        id
        proposer
        startBlock
        endBlock
        proposalBody
        state
        canceledAt
        eta
        executedAt
        createdAt
        votesFor
        votesAgainst
        votesAbstain
      }
    }
  `;

  const data = await querySubgraph<{ proposals: Proposal[] }>(query, { org, first, skip });
  return data?.proposals || [];
}

/**
 * Query helper: Get proposal detail with votes
 * IDX-03: App queries subgraph for proposal detail
 */
export async function queryProposalDetail(proposalId: string): Promise<{
  proposal: Proposal | null;
  votes: Vote[];
}> {
  const id = normalizeId(proposalId, 'proposalId');
  const query = `
    query GetProposalDetail($proposalId: String!) {
      proposal(id: $proposalId) {
        id
        proposer
        startBlock
        endBlock
        proposalBody
        state
        canceledAt
        eta
        executedAt
        createdAt
        votesFor
        votesAgainst
        votesAbstain
        org {
          id
          name
        }
      }
      votes(where: { proposal: $proposalId }) {
        id
        voter
        support
        weight
        reason
        blockNumber
        castAt
      }
    }
  `;

  const data = await querySubgraph<{
    proposal: Proposal | null;
    votes: Vote[];
  }>(query, { proposalId: id });

  return {
    proposal: data?.proposal || null,
    votes: data?.votes || [],
  };
}

/**
 * Query helper: Get members of an org
 * IDX-03: App queries subgraph for member counts
 */
export async function queryOrgMembers(
  orgId: string,
  first: number = 100,
  skip: number = 0,
): Promise<Member[]> {
  const org = normalizeId(orgId, 'orgId');
  const query = `
    query GetMembers($org: String!, $first: Int!, $skip: Int!) {
      members(where: { org: $org, active: true }, first: $first, skip: $skip, orderBy: mintedAt, orderDirection: desc) {
        id
        address
        tokenId
        mintedAt
        active
      }
    }
  `;

  const data = await querySubgraph<{ members: Member[] }>(query, { org, first, skip });
  return data?.members || [];
}

/**
 * Query helper: Get user's recovery delegates
 */
export async function queryRecoveryDelegates(userAddress: string): Promise<RecoveryDelegate[]> {
  const user = normalizeAddress(userAddress, 'userAddress');
  const query = `
    query GetDelegates($user: Bytes!) {
      recoveryDelegates(where: { user: $user, active: true }) {
        id
        delegate
        addedAt
      }
    }
  `;

  const data = await querySubgraph<{ recoveryDelegates: RecoveryDelegate[] }>(query, { user });
  return data?.recoveryDelegates || [];
}

// IDX-04: Query helpers consume subgraph API (exported above)
export {
  queryOrgs as getOrgs,
  queryUserOrgs as getUserOrgs,
  queryProposals as getProposals,
  queryProposalDetail as getProposalDetail,
  queryOrgMembers as getMembers,
  queryRecoveryDelegates as getRecoveryDelegates,
};
