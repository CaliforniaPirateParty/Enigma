import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import * as Keychain from 'react-native-keychain';
import { Client, PublicIdentity, type Conversation, type DecodedMessage } from '@xmtp/react-native-sdk';
import { useWallet } from './WalletContext';

export type Thread = {
  peer: string;            // Ethereum address (0x…)
  conversationId: string;  // XMTP ConversationId (v3)
  conversation: Conversation;
};

export type MessagingContextValue = {
  client: Client | null;
  ready: boolean;
  threads: Thread[];
  messages: Record<string, DecodedMessage[]>;  // keyed by peer Ethereum address
  initClient: () => Promise<void>;
  startThread: (peerAddress: string) => Promise<Thread>;
  sendMessage: (peerAddress: string, text: string) => Promise<void>;
  listMessages: (peerAddress: string, limit?: number) => Promise<DecodedMessage[]>;
  isValidAddress: (addr: string) => boolean;
};

const MessagingContext = createContext<MessagingContextValue | undefined>(undefined);

const XMTP_DB_KEY_SERVICE = 'xmtp-db-encryption-key';

export function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

/** Retrieve or generate a 32-byte encryption key for the XMTP local database. */
async function getOrCreateDbKey(): Promise<Uint8Array> {
  const stored = await Keychain.getGenericPassword({ service: XMTP_DB_KEY_SERVICE });
  if (stored && stored.password) {
    const hex = stored.password;
    const arr = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return arr;
  }
  // Generate new key
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) key[i] = Math.floor(Math.random() * 256);
  const hex = Array.from(key).map((b) => b.toString(16).padStart(2, '0')).join('');
  await Keychain.setGenericPassword('xmtp-db-key', hex, { service: XMTP_DB_KEY_SERVICE });
  return key;
}

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getSigner, state: walletState } = useWallet();
  const [client, setClient] = useState<Client | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Record<string, DecodedMessage[]>>({});
  const initInFlight = useRef(false);
  // Map conversationId -> peer Ethereum address (for routing incoming stream messages)
  const convIdToPeerRef = useRef<Record<string, string>>({});

  const env = ((Constants.expoConfig?.extra as { xmtpEnv?: 'dev' | 'production' })?.xmtpEnv) || 'dev';

  const initClient = useCallback(async () => {
    if (client || initInFlight.current) return;
    initInFlight.current = true;
    try {
      const signer = await getSigner();
      if (!signer) throw new Error('Local signer required to register XMTP identity');

      const dbEncryptionKey = await getOrCreateDbKey();

      // XMTP SDK v3: Client.create requires signer + { env, dbEncryptionKey }
      const c = await Client.create(signer as any, { env: env as 'dev' | 'production', dbEncryptionKey });
      setClient(c);

      // Sync conversations from network
      await c.conversations.sync();
      const convos = await c.conversations.list();

      // Build peer address -> Thread mapping
      // v3 DMs: peerInboxId is an InboxId; we derive display key from inboxId
      // Since we can't recover Ethereum address from inboxId trivially, we use inboxId as peer key
      const newConvIdToPeer: Record<string, string> = {};
      const threadList: Thread[] = [];

      for (const conv of convos) {
        // For DMs, use peerInboxId as peer identifier
        // The Dm class has peerInboxId() method; Conversation union type may be Group or Dm
        let peer: string;
        try {
          peer = await (conv as any).peerInboxId();
        } catch {
          peer = conv.id;
        }
        newConvIdToPeer[conv.id] = peer;
        threadList.push({ peer, conversationId: conv.id, conversation: conv });
      }
      convIdToPeerRef.current = newConvIdToPeer;
      setThreads(threadList);

      // Load initial message history (last 50) for all conversations
      const msgMap: Record<string, DecodedMessage[]> = {};
      for (const conv of convos) {
        const peer = newConvIdToPeer[conv.id];
        const msgs = await conv.messages({ limit: 50 });
        msgMap[peer] = msgs as DecodedMessage[];
      }
      setMessages(msgMap);

      // Start streaming all incoming messages via callback API
      await c.conversations.streamAllMessages(async (msg) => {
        const convId = (msg as any).topic ?? (msg as any).conversationId ?? '';
        const peer = convIdToPeerRef.current[convId] ?? (msg as any).senderInboxId ?? convId;
        setMessages((prev) => ({
          ...prev,
          [peer]: [...(prev[peer] ?? []), msg as unknown as DecodedMessage],
        }));
      });
    } finally {
      initInFlight.current = false;
    }
  }, [client, env, getSigner]);

  const startThread = useCallback(
    async (peerAddress: string): Promise<Thread> => {
      if (!isValidAddress(peerAddress)) throw new Error('Invalid Ethereum address');
      if (!client) throw new Error('XMTP client not ready — call initClient() first');

      // v3: create DM by identity
      const identity = new PublicIdentity(peerAddress, 'ETHEREUM');
      const conv = await client.conversations.findOrCreateDmWithIdentity(identity);
      const peer = await (conv as any).peerInboxId();
      convIdToPeerRef.current[conv.id] = peer;
      const t: Thread = { peer, conversationId: conv.id, conversation: conv };
      setThreads((prev) => (prev.find((x) => x.conversationId === conv.id) ? prev : [...prev, t]));
      return t;
    },
    [client]
  );

  const sendMessage = useCallback(
    async (peerAddress: string, text: string) => {
      if (!isValidAddress(peerAddress)) throw new Error('Invalid Ethereum address');
      const thread = threads.find((t) => {
        // Try to match by peer identity (inboxId) or fallback address
        return t.peer.toLowerCase() === peerAddress.toLowerCase();
      }) || (await startThread(peerAddress));
      await thread.conversation.send(text);
      // Optimistically append sent message so sender sees it immediately
      const myInboxId = client?.inboxId ?? '';
      const optimisticMsg = {
        id: `optimistic-${Date.now()}`,
        senderInboxId: myInboxId,
        content: () => text,
        sentNs: Date.now() * 1_000_000,
        deliveryStatus: 'PUBLISHED',
      } as unknown as DecodedMessage;
      setMessages((prev) => ({
        ...prev,
        [thread.peer]: [...(prev[thread.peer] ?? []), optimisticMsg],
      }));
    },
    [client, threads, startThread]
  );

  const listMessages = useCallback(
    async (peerAddress: string, limit = 50): Promise<DecodedMessage[]> => {
      const thread = threads.find((t) => t.peer.toLowerCase() === peerAddress.toLowerCase());
      if (!thread) return [];
      const msgs = await thread.conversation.messages({ limit });
      setMessages((prev) => ({
        ...prev,
        [thread.peer]: msgs as DecodedMessage[],
      }));
      return msgs as DecodedMessage[];
    },
    [threads]
  );

  useEffect(() => {
    return () => {
      // Cancel all streams on unmount
      if (client) {
        client.conversations.cancelStreamAllMessages();
      }
      setClient(null);
    };
  }, [client]);

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
