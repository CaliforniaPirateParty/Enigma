import { useSubgraph, UseSubgraphResult } from './useSubgraph';
import { queryRecoveryDelegates } from '../api/subgraph';
import { RecoveryDelegate } from '../types/subgraph';
import { RECOVERY_REGISTRY_ABI } from '../utils/abis';
import { getContract, getExtra } from '../utils/contracts';
import { ethers } from 'ethers';

export function useRecoveryDelegates(address?: string): UseSubgraphResult<RecoveryDelegate[]> {
  const a = address ? address.toLowerCase() : undefined;
  return useSubgraph(
    async () => (a ? await queryRecoveryDelegates(a) : []),
    `query:recovery-delegates:${a ?? 'none'}`,
    { skip: !a, pollInterval: 60000 }
  );
}

export type PendingRecoveryData = {
  newOwner: string;
  readyAt: number;
  approvals: number;
  orgs: string[];
};

export function usePendingRecovery(address?: string): UseSubgraphResult<PendingRecoveryData | null> {
  const a = address ? address.toLowerCase() : undefined;
  return useSubgraph<PendingRecoveryData | null>(
    async () => {
      if (!a) return null;
      const { recoveryRegistryAddress } = getExtra();
      if (!recoveryRegistryAddress) return null;
      const c = getContract(recoveryRegistryAddress, RECOVERY_REGISTRY_ABI);
      const [newOwner, readyAt, approvals, orgs] = await c.pendingRecovery(a);
      if (newOwner === ethers.ZeroAddress || Number(readyAt) === 0) return null;
      return {
        newOwner: String(newOwner),
        readyAt: Number(readyAt),
        approvals: Number(approvals),
        orgs: (orgs as string[]).map(String),
      };
    },
    `pending-recovery:${a ?? 'none'}`,
    { skip: !a, pollInterval: 30000 }
  );
}

export async function deriveThresholdFromEvents(user: string): Promise<number | null> {
  try {
    const { recoveryRegistryAddress } = getExtra();
    if (!recoveryRegistryAddress) return null;
    const c = getContract(recoveryRegistryAddress, RECOVERY_REGISTRY_ABI);
    const filter = c.filters.DelegatesSet(user.toLowerCase());
    const events = await c.queryFilter(filter);
    if (!events || events.length === 0) return null;
    // Latest event by blockNumber
    const latest = (events as any[]).reduce(
      (acc: any, e: any) => (e.blockNumber > acc.blockNumber ? e : acc),
      events[0]
    );
    // ethers v6 EventLog: args is positional + named; threshold is the 3rd arg (index 2)
    const threshold = (latest as any).args?.[2] ?? (latest as any).args?.threshold;
    return threshold != null ? Number(threshold) : null;
  } catch {
    return null;
  }
}
