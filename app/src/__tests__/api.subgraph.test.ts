import {
  queryOrgs,
  queryUserOrgs,
  queryProposals,
  queryProposalDetail,
  queryOrgMembers,
  queryRecoveryDelegates,
} from '../api/subgraph';
import { Org, Proposal, Member, Vote } from '../types/subgraph';

// Mock fetch globally
global.fetch = jest.fn();

const mockOrgs: Org[] = [
  {
    id: '0x1234',
    creator: '0xabc',
    membership: '0x1234',
    governor: '0x5678',
    name: 'Test Org',
    symbol: 'TEST',
    metadataURI: 'QmTest',
    joinPolicy: 0,
    createdAt: '1234567890',
    memberCount: 5,
  },
];

const mockProposal: Proposal = {
  id: '0x1234-1',
  org: mockOrgs[0],
  proposer: '0xabc',
  startBlock: '100',
  endBlock: '200',
  proposalBody: 'QmProposal',
  state: 1,
  canceledAt: null,
  eta: null,
  executedAt: null,
  createdAt: '1234567890',
  votesFor: '3',
  votesAgainst: '1',
  votesAbstain: '1',
};

describe('Subgraph API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('queryOrgs', () => {
    it('should fetch orgs list', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { orgs: mockOrgs },
        }),
      });

      const result = await queryOrgs(10, 0);
      expect(result).toEqual(mockOrgs);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errors: [{ message: 'Query error' }],
        }),
      });

      await expect(queryOrgs()).rejects.toThrow('Subgraph error');
    });

    it('should return empty array on no data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { orgs: null },
        }),
      });

      const result = await queryOrgs();
      expect(result).toEqual([]);
    });
  });

  describe('queryUserOrgs', () => {
    it('should fetch user orgs', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            members: [{ org: mockOrgs[0] }],
          },
        }),
      });

      const result = await queryUserOrgs('0xabc');
      expect(result).toEqual(mockOrgs);
    });

    it('should deduplicate orgs', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            members: [{ org: mockOrgs[0] }, { org: mockOrgs[0] }],
          },
        }),
      });

      const result = await queryUserOrgs('0xabc');
      expect(result).toHaveLength(1);
    });

    it('should lowercase user address', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { members: [] },
        }),
      });

      await queryUserOrgs('0xABC');
      const callArg = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(callArg.body).toContain('0xabc');
    });
  });

  describe('queryProposals', () => {
    it('should fetch proposals for an org', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { proposals: [mockProposal] },
        }),
      });

      const result = await queryProposals('0x1234');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('0x1234-1');
    });

    it('should handle pagination', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { proposals: [] },
        }),
      });

      await queryProposals('0x1234', 50, 100);
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('queryProposalDetail', () => {
    it('should fetch proposal with votes', async () => {
      const mockVotes: Vote[] = [
        {
          id: 'vote-1',
          proposal: mockProposal,
          voter: '0xabc',
          support: 1,
          weight: '1',
          reason: null,
          blockNumber: '150',
          castAt: '1234567890',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { proposal: mockProposal, votes: mockVotes },
        }),
      });

      const result = await queryProposalDetail('0x1234-1');
      expect(result.proposal).toBeTruthy();
      expect(result.votes).toHaveLength(1);
    });

    it('should return null proposal if not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { proposal: null, votes: [] },
        }),
      });

      const result = await queryProposalDetail('0x999');
      expect(result.proposal).toBeNull();
      expect(result.votes).toEqual([]);
    });
  });

  describe('queryOrgMembers', () => {
    it('should fetch org members', async () => {
      const mockMembers: Member[] = [
        {
          id: 'member-1',
          org: mockOrgs[0],
          address: '0xabc',
          tokenId: '1',
          mintedAt: '1234567890',
          burnedAt: null,
          active: true,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { members: mockMembers },
        }),
      });

      const result = await queryOrgMembers('0x1234');
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe('0xabc');
    });
  });

  describe('queryRecoveryDelegates', () => {
    it('should fetch recovery delegates', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            recoveryDelegates: [
              {
                id: 'delegate-1',
                delegate: '0xdef',
                addedAt: '1234567890',
              },
            ],
          },
        }),
      });

      const result = await queryRecoveryDelegates('0xabc');
      expect(result).toHaveLength(1);
      expect(result[0].delegate).toBe('0xdef');
    });
  });
});
