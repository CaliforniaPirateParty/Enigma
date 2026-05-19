import { useSubgraph, UseSubgraphResult } from './useSubgraph';
import { queryOrgMembers } from '../api/subgraph';
import { Member } from '../types/subgraph';

/**
 * useOrgMembers
 *
 * Returns the list of active MembershipNFT holders for the given org.
 * Polls every 45 seconds. Skips fetching when orgId is undefined.
 *
 * @param orgId - The org contract address (lowercased internally)
 */
export function useOrgMembers(orgId?: string): UseSubgraphResult<Member[]> {
  const id = orgId ? orgId.toLowerCase() : undefined;
  return useSubgraph(
    async () => (id ? await queryOrgMembers(id, 100, 0) : []),
    `query:members:${id ?? 'none'}`,
    { skip: !id, pollInterval: 45000 }
  );
}
