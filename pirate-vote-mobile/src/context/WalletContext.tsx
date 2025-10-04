import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Keychain from 'react-native-keychain';
import { HDNodeWallet, Mnemonic, Wallet, ethers } from 'ethers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SignClient from '@walletconnect/sign-client';
import { getSignerFromPrivateKey, parseMaybeHex } from '../utils/crypto';
import Constants from 'expo-constants';

export type WalletIdentity = {
  address: string;
  chainId: number;
};

export type WalletState = {
  identity?: WalletIdentity;
  connectedWith?: 'local' | 'walletconnect';
  wcTopic?: string;
};

export type WalletContextValue = {
  state: WalletState;
  createWallet: (strength: 128 | 256) => Promise<void>; // 12 or 24 words
  importFromMnemonic: (mnemonic: string) => Promise<void>;
  importFromPrivateKey: (privateKey: string) => Promise<void>;
  connectMetaMask: () => Promise<void>;
  disconnect: () => Promise<void>;
  getSigner: () => Promise<ethers.Signer | undefined>;
  getBalance: () => Promise<ethers.BigNumberish | undefined>;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

const KEYCHAIN_SERVICE = 'pirate-vote-wallet';
const STORAGE_KEY_STATE = 'wallet_state';

function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    AsyncStorage.getItem(key).then((raw) => {
      if (raw) setValue(JSON.parse(raw) as T);
    });
  }, [key]);
  useEffect(() => {
    AsyncStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = usePersistedState<WalletState>(STORAGE_KEY_STATE, {});
  const [wcClient, setWcClient] = useState<SignClient | undefined>(undefined);

  useEffect(() => {
    // Lazy init WalletConnect client
    async function initWc() {
      const projectId = (Constants.expoConfig?.extra as any)?.walletConnectProjectId || '';
      if (!projectId) return;
      const client = await SignClient.init({ projectId, metadata: {
        name: 'Pirate Vote',
        description: 'Wallet + Voting + Messaging',
        url: 'https://pirate.party',
        icons: ['https://avatars.githubusercontent.com/u/9919?s=200&v=4']
      }});
      setWcClient(client);
    }
    initWc();
  }, []);

  const getProvider = useCallback(() => {
    const rpcUrl: string = (Constants.expoConfig?.extra as any)?.rpcUrl || 'https://ethereum.publicnode.com';
    return new ethers.JsonRpcProvider(rpcUrl);
  }, []);

  const persistLocalKey = useCallback(async (privateKeyHex: string) => {
    // Store private key in device secure storage
    await Keychain.setGenericPassword('wallet', privateKeyHex, {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      accessControl: Keychain.SECURITY_LEVEL.SECURE_HARDWARE ? Keychain.ACCESS_CONTROL.BIOMETRY_ANY : undefined
    });
    const wallet = new Wallet(privateKeyHex);
    setState({ identity: { address: await wallet.getAddress(), chainId: 1 }, connectedWith: 'local' });
  }, [setState]);

  const createWallet = useCallback(async (strength: 128 | 256) => {
    const mnemonic = Mnemonic.fromEntropy(ethers.randomBytes(strength / 8));
    const hd = HDNodeWallet.fromMnemonic(mnemonic);
    const account0 = new Wallet(hd.privateKey);
    await persistLocalKey(account0.privateKey);
  }, [persistLocalKey]);

  const importFromMnemonic = useCallback(async (mnemonicOrPhrase: string) => {
    const mnemonic = Mnemonic.fromPhrase(mnemonicOrPhrase.trim());
    const hd = HDNodeWallet.fromMnemonic(mnemonic);
    const account0 = new Wallet(hd.privateKey);
    await persistLocalKey(account0.privateKey);
  }, [persistLocalKey]);

  const importFromPrivateKey = useCallback(async (privateKey: string) => {
    const hex = parseMaybeHex(privateKey);
    await persistLocalKey(hex);
  }, [persistLocalKey]);

  const connectMetaMask = useCallback(async () => {
    if (!wcClient) throw new Error('WalletConnect not initialized');
    const { uri, approval } = await wcClient.connect({ requiredNamespaces: {
      eip155: {
        methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData', 'eth_signTypedData_v4'],
        chains: ['eip155:1'],
        events: ['accountsChanged', 'chainChanged']
      }
    }});
    if (uri) {
      // show QR or trigger deep link from UI; here we assume UI handles it
      // For scaffold, we just await approval
    }
    const session = await approval();
    const accounts = session.namespaces.eip155.accounts;
    const first = accounts[0]; // eip155:1:0xabc...
    const address = first.split(':')[2];
    setState({ identity: { address, chainId: 1 }, connectedWith: 'walletconnect', wcTopic: session.topic });
  }, [wcClient, setState]);

  const disconnect = useCallback(async () => {
    if (state.connectedWith === 'walletconnect' && wcClient && state.wcTopic) {
      await wcClient.disconnect({ topic: state.wcTopic, reason: { code: 6000, message: 'User disconnect' } });
    }
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    setState({});
  }, [state, wcClient, setState]);

  const getSigner = useCallback(async () => {
    if (state.connectedWith === 'local') {
      const creds = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
      if (!creds) return undefined;
      const wallet = new Wallet(creds.password, getProvider());
      return wallet.connect(getProvider());
    }
    // For WalletConnect, transaction/signature requests should be relayed via wc client from UI
    return undefined;
  }, [state, getProvider]);

  const getBalance = useCallback(async () => {
    if (!state.identity) return undefined;
    const provider = getProvider();
    return provider.getBalance(state.identity.address);
  }, [state, getProvider]);

  const value: WalletContextValue = useMemo(() => ({
    state,
    createWallet,
    importFromMnemonic,
    importFromPrivateKey,
    connectMetaMask,
    disconnect,
    getSigner,
    getBalance
  }), [state, createWallet, importFromMnemonic, importFromPrivateKey, connectMetaMask, disconnect, getSigner, getBalance]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
