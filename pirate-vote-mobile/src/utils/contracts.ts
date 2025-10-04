import { Contract, ethers } from 'ethers';
import Constants from 'expo-constants';

export function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl: string = (Constants.expoConfig?.extra as any)?.rpcUrl || 'https://ethereum.publicnode.com';
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getGovernanceContract(address: string, abi: any): Contract {
  const provider = getProvider();
  return new Contract(address, abi, provider);
}
