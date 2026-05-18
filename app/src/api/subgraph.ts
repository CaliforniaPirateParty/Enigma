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

async function querySubgraph<T>(query: string): Promise<T> {
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
      body: JSON.stringify({ query }),
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

  const data = await querySubgraph<{ orgs: Org[] }>(
    query.replace('$first: Int!, $skip: Int!', '')
      .replace('(first: $first, skip: $skip,', `(first: ${first}, skip: ${skip},`)
  );

  return data?.orgs || [];
}

/**
 * Query helper: Get orgs where user holds membership
 * IDX-03: App queries subgraph for user's orgs
 */
export async function queryUserOrgs(userAddress: string): Promise<Org[]> {
  const addressLower = userAddress.toLowerCase();
  const query = `
    query GetUserOrgs($address: String!) {
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

  const data = await querySubgraph<{ members: Array<{ org: Org }> }>(
    query.replace('$address: String!', '')
      .replace('{ address: $address,', `{ address: "${addressLower}",`)
  );

  const userOrgs = data?.members?.map(m => m.org) || [];
  // Deduplicate in case user has multiple NFTs in same org (shouldn't happen but safe)
  return Array.from(new Map(userOrgs.map(org => [org.id, org])).values());
}

/**
 * Query helper: Get proposals for an org
 * IDX-03: App queries subgraph for proposals
 */
export async function queryProposals(
  orgId: string,
  first: number = 100,
  skip: number = 0
): Promise<Proposal[]> {
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

  const data = await querySubgraph<{ proposals: Proposal[] }>(
    query.replace('$org: String!, $first: Int!, $skip: Int!', '')
      .replace('{ org: $org }', `{ org: "${orgId}" }`)
      .replace('(first: $first, skip: $skip,', `(first: ${first}, skip: ${skip},`)
  );

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
  }>(
    query.replace('$proposalId: String!', '')
      .replace('(id: $proposalId)', `(id: "${proposalId}")`)
      .replace('{ proposal: $proposalId }', `{ proposal: "${proposalId}" }`)
  );

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
  skip: number = 0
): Promise<Member[]> {
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

  const data = await querySubgraph<{ members: Member[] }>(
    query.replace('$org: String!, $first: Int!, $skip: Int!', '')
      .replace('{ org: $org, active: true }', `{ org: "${orgId}", active: true }`)
      .replace('(first: $first, skip: $skip,', `(first: ${first}, skip: ${skip},`)
  );

  return data?.members || [];
}

/**
 * Query helper: Get user's recovery delegates
 */
export async function queryRecoveryDelegates(userAddress: string): Promise<RecoveryDelegate[]> {
  const addressLower = userAddress.toLowerCase();
  const query = `
    query GetDelegates($user: String!) {
      recoveryDelegates(where: { user: $user, active: true }) {
        id
        delegate
        addedAt
      }
    }
  `;

  const data = await querySubgraph<{ recoveryDelegates: RecoveryDelegate[] }>(
    query.replace('$user: String!', '')
      .replace('{ user: $user, active: true }', `{ user: "${addressLower}", active: true }`)
  );

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
