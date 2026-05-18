import { Contract, ethers } from 'ethers';
import Constants from 'expo-constants';

type ExtraConfig = {
  rpcUrl: string;
  chainId: number;
  chainName: string;
  paymasterAddress?: string;
  orgFactoryAddress?: string;
  recoveryRegistryAddress?: string;
  subgraphUrl?: string;
};

export function getExtra(): ExtraConfig {
  return (Constants.expoConfig?.extra as ExtraConfig) || ({} as ExtraConfig);
}

export function getProvider(): ethers.JsonRpcProvider {
  const { rpcUrl, chainId, chainName } = getExtra();
  return new ethers.JsonRpcProvider(rpcUrl, { chainId, name: chainName });
}

export function getContract(address: string, abi: ethers.InterfaceAbi): Contract {
  return new Contract(address, abi, getProvider());
}
