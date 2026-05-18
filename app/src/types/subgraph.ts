export interface Org {
  id: string;
  creator: string;
  membership: string;
  governor: string;
  name: string;
  symbol: string;
  metadataURI: string;
  joinPolicy: number;
  createdAt: string;
  memberCount: number;
}

export interface Proposal {
  id: string;
  org: Org;
  proposer: string;
  startBlock: string;
  endBlock: string;
  proposalBody: string;
  state: number;
  canceledAt: string | null;
  eta: string | null;
  executedAt: string | null;
  createdAt: string;
  votesFor: string;
  votesAgainst: string;
  votesAbstain: string;
}

export interface Member {
  id: string;
  org: Org;
  address: string;
  tokenId: string;
  mintedAt: string;
  burnedAt: string | null;
  active: boolean;
}

export interface Vote {
  id: string;
  proposal: Proposal;
  voter: string;
  support: number;
  weight: string;
  reason: string | null;
  blockNumber: string;
  castAt: string;
}

export interface RecoveryDelegate {
  id: string;
  user: string;
  delegate: string;
  addedAt: string;
  removedAt: string | null;
  active: boolean;
}

// API response types
export interface SubgraphResponse<T> {
  data?: {
    [key: string]: T | T[];
  };
  errors?: Array<{
    message: string;
  }>;
}
