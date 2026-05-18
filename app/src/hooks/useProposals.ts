import { useSubgraph, UseSubgraphResult } from './useSubgraph';
import { Proposal, Vote } from '../types/subgraph';
import { queryProposals, queryProposalDetail } from '../api/subgraph';

/**
 * IDX-03: Hook to query proposals for an org
 */
export function useProposals(orgId?: string): UseSubgraphResult<Proposal[]> {
  return useSubgraph(
    async () => {
      if (!orgId) return [];
      const proposals = await queryProposals(orgId, 100, 0);
      return proposals;
    },
    `query:proposals:${orgId || 'none'}`,
    {
      skip: !orgId,
      pollInterval: 30000 // Poll every 30 seconds
    }
  );
}

/**
 * IDX-03: Hook to query proposal detail with votes
 */
export function useProposalDetail(proposalId?: string): UseSubgraphResult<{
  proposal: Proposal | null;
  votes: Vote[];
}> {
  return useSubgraph(
    async () => {
      if (!proposalId) return { proposal: null, votes: [] };
      return await queryProposalDetail(proposalId);
    },
    `query:proposal:${proposalId || 'none'}`,
    {
      skip: !proposalId,
      pollInterval: 15000 // Poll every 15 seconds for active proposals
    }
  );
}
