import { useSubgraph, UseSubgraphResult } from './useSubgraph';
import { Org } from '../types/subgraph';
import { queryOrgs, queryUserOrgs } from '../api/subgraph';

/**
 * IDX-03: Hook to query all orgs
 */
export function useOrgs(): UseSubgraphResult<Org[]> {
  return useSubgraph(
    async () => {
      const orgs = await queryOrgs(100, 0);
      return orgs;
    },
    'query:orgs',
    { pollInterval: 60000 } // Poll every minute
  );
}

/**
 * IDX-03: Hook to query user's orgs (where they hold membership NFT)
 */
export function useUserOrgs(userAddress?: string): UseSubgraphResult<Org[]> {
  return useSubgraph(
    async () => {
      if (!userAddress) return [];
      const orgs = await queryUserOrgs(userAddress);
      return orgs;
    },
    `query:user-orgs:${userAddress || 'none'}`,
    {
      skip: !userAddress,
      pollInterval: 60000 // Poll every minute
    }
  );
}
