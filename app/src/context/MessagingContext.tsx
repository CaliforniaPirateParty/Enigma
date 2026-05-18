import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { Client, type Conversation, type DecodedMessage } from '@xmtp/react-native-sdk';
import { useWallet } from './WalletContext';

export type Thread = {
  peer: string;
  conversation: Conversation;
};

export type MessagingContextValue = {
  client: Client | null;
  ready: boolean;
  threads: Thread[];
  messages: Record<string, DecodedMessage[]>;
  initClient: () => Promise<void>;
  startThread: (peerAddress: string) => Promise<Thread>;
  sendMessage: (peerAddress: string, text: string) => Promise<void>;
  listMessages: (peerAddress: string, limit?: number) => Promise<DecodedMessage[]>;
  isValidAddress: (addr: string) => boolean;
};

const MessagingContext = createContext<MessagingContextValue | undefined>(undefined);

export function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getSigner } = useWallet();
  const [client, setClient] = useState<Client | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Record<string, DecodedMessage[]>>({});
  const initInFlight = useRef(false);
  const streamRef = useRef<AsyncGenerator<DecodedMessage> | null>(null);

  const env = ((Constants.expoConfig?.extra as { xmtpEnv?: 'dev' | 'production' })?.xmtpEnv) || 'dev';

  const initClient = useCallback(async () => {
    if (client || initInFlight.current) return;
    initInFlight.current = true;
    try {
      const signer = await getSigner();
      if (!signer) throw new Error('Local signer required to register XMTP identity');
      // XMTP SDK expects a Signer-shaped object: { getAddress, signMessage }.
      const c = await Client.create(signer as any, { env });
      setClient(c);

      const convos = await c.conversations.list();
      setThreads(convos.map((conversation) => ({ peer: (conversation as any).peerAddress, conversation })));

      // Load initial message history for all threads
      const msgMap: Record<string, DecodedMessage[]> = {};
      for (const conv of convos) {
        const peer = (conv as any).peerAddress;
        msgMap[peer] = await conv.messages({ limit: 50 });
      }
      setMessages(msgMap);

      // Start streaming all incoming messages
      const stream = await c.conversations.streamAllMessages();
      streamRef.current = stream as any;
      (async () => {
        try {
          for await (const msg of stream) {
            const peer = (msg as any).senderAddress;
            setMessages((prev) => ({
              ...prev,
              [peer]: [...(prev[peer] ?? []), msg],
            }));
          }
        } catch {
          // Stream ended or was cancelled — no action needed
        }
      })();
    } finally {
      initInFlight.current = false;
    }
  }, [client, env, getSigner]);

  const startThread = useCallback(
    async (peerAddress: string): Promise<Thread> => {
      if (!isValidAddress(peerAddress)) throw new Error('Invalid Ethereum address');
      if (!client) throw new Error('XMTP client not ready — call initClient() first');
      const canMessage = await client.canMessage(peerAddress);
      if (!canMessage) throw new Error(`Peer ${peerAddress} has not registered an XMTP identity`);
      const conversation = await client.conversations.newConversation(peerAddress);
      const t: Thread = { peer: peerAddress, conversation };
      setThreads((prev) => (prev.find((x) => x.peer === peerAddress) ? prev : [...prev, t]));
      return t;
    },
    [client]
  );

  const sendMessage = useCallback(
    async (peerAddress: string, text: string) => {
      if (!isValidAddress(peerAddress)) throw new Error('Invalid Ethereum address');
      const thread = threads.find((t) => t.peer === peerAddress) || (await startThread(peerAddress));
      await thread.conversation.send(text);
      // Optimistically append sent message so sender sees it immediately
      const optimisticMsg = {
        senderAddress: (client as any)?.address ?? '',
        content: text,
        id: `optimistic-${Date.now()}`,
      } as unknown as DecodedMessage;
      setMessages((prev) => ({
        ...prev,
        [peerAddress]: [...(prev[peerAddress] ?? []), optimisticMsg],
      }));
    },
    [client, threads, startThread]
  );

  const listMessages = useCallback(
    async (peerAddress: string, limit = 50): Promise<DecodedMessage[]> => {
      const thread = threads.find((t) => t.peer === peerAddress);
      if (!thread) return [];
      return thread.conversation.messages({ limit });
    },
    [threads]
  );

  useEffect(() => {
    return () => {
      // Cancel the stream and clean up on unmount
      if (streamRef.current) {
        streamRef.current.return(undefined).catch(() => {});
        streamRef.current = null;
      }
      setClient(null);
    };
  }, []);

  const value: MessagingContextValue = useMemo(
    () => ({ client, ready: !!client, threads, messages, initClient, startThread, sendMessage, listMessages, isValidAddress }),
    [client, threads, messages, initClient, startThread, sendMessage, listMessages]
  );

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
};

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error('useMessaging must be used within MessagingProvider');
  return ctx;
}
