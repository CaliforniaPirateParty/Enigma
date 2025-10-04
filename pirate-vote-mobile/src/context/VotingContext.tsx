import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import Constants from 'expo-constants';
import { useWallet } from './WalletContext';

export type Proposal = {
  id: string;
  title: string;
  description: string;
  choices: string[];
  quorum: number;
  startBlock: number;
  endBlock: number;
};

export type VotingContextValue = {
  proposals: Proposal[];
  fetchProposals: () => Promise<void>;
  castVoteOnChain: (proposalId: string, choiceIndex: number) => Promise<void>;
  castVoteOffChain: (proposalId: string, choiceIndex: number) => Promise<string>; // returns signature
  getVotingPower: (address: string) => Promise<ethers.BigNumberish>;
};

const VotingContext = createContext<VotingContextValue | undefined>(undefined);

export const VotingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [proposals, setProposals] = useState<Proposal[]>([
    {
      id: '1',
      title: 'Adopt Pirate Party Platform 2025',
      description: 'A mock proposal for demonstration. Real ABI integration later.',
      choices: ['For', 'Against', 'Abstain'],
      quorum: 1000,
      startBlock: 0,
      endBlock: 999999
    }
  ]);

  const fetchProposals = useCallback(async () => {
    // Placeholder: integrate with The Graph or direct contract call later
    setProposals((p) => p);
  }, []);

  const castVoteOnChain = useCallback(async (proposalId: string, choiceIndex: number) => {
    // Placeholder: contract ABI interaction will be implemented later
    console.log('castVoteOnChain', { proposalId, choiceIndex });
  }, []);

  const { getSigner } = useWallet();

  const castVoteOffChain = useCallback(async (proposalId: string, choiceIndex: number) => {
    // EIP-712 typed data signature using signer
    const signer = await getSigner();
    if (!signer) throw new Error('Local signer not available');
    const domain = {
      name: 'PirateVote',
      version: '1',
      chainId: 1,
      verifyingContract: '0x0000000000000000000000000000000000000000'
    };
    const types = {
      Vote: [
        { name: 'proposalId', type: 'string' },
        { name: 'choiceIndex', type: 'uint256' }
      ]
    } as const;
    const value = { proposalId, choiceIndex } as const;
    // @ts-ignore ethers v6 signTypedData
    const signature: string = await (signer as any).signTypedData(domain, types, value);
    return signature;
  }, [getSigner]);

  const getVotingPower = useCallback(async (address: string) => {
    // Placeholder: integrate contract call to get voting power
    return 0n;
  }, []);

  const value: VotingContextValue = useMemo(() => ({ proposals, fetchProposals, castVoteOnChain, castVoteOffChain, getVotingPower }), [proposals, fetchProposals, castVoteOnChain, castVoteOffChain, getVotingPower]);

  return <VotingContext.Provider value={value}>{children}</VotingContext.Provider>;
};

export function useVoting() {
  const ctx = useContext(VotingContext);
  if (!ctx) throw new Error('useVoting must be used within VotingProvider');
  return ctx;
}
