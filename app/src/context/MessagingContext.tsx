import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  // Org group chat extensions
  orgGroups: Record<string, Conversation>;
  orgGroupMessages: Record<string, DecodedMessage[]>;
  initClient: () => Promise<void>;
  startThread: (peerAddress: string) => Promise<Thread>;
  sendMessage: (peerAddress: string, text: string) => Promise<void>;
  listMessages: (peerAddress: string, limit?: number) => Promise<DecodedMessage[]>;
  isValidAddress: (addr: string) => boolean;
  getOrCreateOrgGroup: (orgId: string, memberAddresses: string[]) => Promise<Conversation>;
  sendGroupMessage: (orgId: string, text: string) => Promise<void>;
  reconcileGroupMembers: (orgId: string, desiredAddresses: string[]) => Promise<void>;
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
  // Org group chat state
  const [orgGroups, setOrgGroups] = useState<Record<string, Conversation>>({});
  const [orgGroupMessages, setOrgGroupMessages] = useState<Record<string, DecodedMessage[]>>({});
  const convIdToOrgIdRef = useRef<Record<string, string>>({});

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

      // Rehydrate org group mappings from AsyncStorage
      const newConvIdToOrgId: Record<string, string> = {};
      const orgGroupsMap: Record<string, Conversation> = {};
      const orgGroupMsgsMap: Record<string, DecodedMessage[]> = {};
      try {
        const raw = await AsyncStorage.getItem('enigma:org-group-map');
        if (raw) {
          const savedMap: Record<string, string> = JSON.parse(raw);
          const convoById = new Map(convos.map((c2) => [c2.id as string, c2]));
          for (const [orgKey, groupConvId] of Object.entries(savedMap)) {
            const conv = convoById.get(groupConvId);
            if (conv) {
              orgGroupsMap[orgKey] = conv;
              newConvIdToOrgId[groupConvId] = orgKey;
              // Load last 50 messages for this group
              const msgs = await conv.messages({ limit: 50 });
              orgGroupMsgsMap[orgKey] = msgs as DecodedMessage[];
            }
          }
        }
      } catch {
        // Non-fatal: start with empty org groups
      }
      convIdToOrgIdRef.current = newConvIdToOrgId;
      setOrgGroups(orgGroupsMap);
      setOrgGroupMessages(orgGroupMsgsMap);

      // Load initial message history (last 50) for DM conversations only
      const msgMap: Record<string, DecodedMessage[]> = {};
      for (const conv of convos) {
        if (newConvIdToOrgId[conv.id]) continue; // skip org group convos
        const peer = newConvIdToPeer[conv.id];
        const msgs = await conv.messages({ limit: 50 });
        msgMap[peer] = msgs as DecodedMessage[];
      }
      setMessages(msgMap);

      // Start streaming all incoming messages via callback API
      await c.conversations.streamAllMessages(async (msg) => {
        const convId = (msg as any).topic ?? (msg as any).conversationId ?? '';
        // Route to org group messages if it's a known group conversation
        const orgId2 = convIdToOrgIdRef.current[convId];
        if (orgId2) {
          setOrgGroupMessages((prev) => ({
            ...prev,
            [orgId2]: [...(prev[orgId2] ?? []), msg as unknown as DecodedMessage],
          }));
          return;
        }
        // Otherwise route to DM messages
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

  // ---------------------------------------------------------------------------
  // Org group chat extensions
  // ---------------------------------------------------------------------------

  const getOrCreateOrgGroup = useCallback(
    async (orgId: string, memberAddresses: string[]): Promise<Conversation> => {
      const key = orgId.toLowerCase();
      const existing = orgGroups[key];
      if (existing) return existing;
      if (!client) throw new Error('XMTP client not ready — call initClient() first');
      const identities = memberAddresses
        .filter((a) => isValidAddress(a))
        .map((a) => new PublicIdentity(a, 'ETHEREUM'));
      const group = await (client.conversations as any).newGroupWithIdentities(identities);
      convIdToOrgIdRef.current[group.id] = key;
      setOrgGroups((prev) => ({ ...prev, [key]: group }));
      // Persist mapping
      try {
        const raw = await AsyncStorage.getItem('enigma:org-group-map');
        const map = raw ? JSON.parse(raw) : {};
        map[key] = group.id;
        await AsyncStorage.setItem('enigma:org-group-map', JSON.stringify(map));
      } catch {
        // Non-fatal persistence failure
      }
      // Seed message history
      const msgs = await group.messages({ limit: 50 });
      setOrgGroupMessages((prev) => ({ ...prev, [key]: msgs as DecodedMessage[] }));
      return group;
    },
    [client, orgGroups]
  );

  const sendGroupMessage = useCallback(
    async (orgId: string, text: string) => {
      const key = orgId.toLowerCase();
      const group = orgGroups[key];
      if (!group) throw new Error('No group for org — call getOrCreateOrgGroup first');
      await group.send(text);
      const optimistic = {
        id: `optimistic-${Date.now()}`,
        senderInboxId: client?.inboxId ?? '',
        content: () => text,
        sentNs: Date.now() * 1_000_000,
        deliveryStatus: 'PUBLISHED',
      } as unknown as DecodedMessage;
      setOrgGroupMessages((prev) => ({
        ...prev,
        [key]: [...(prev[key] ?? []), optimistic],
      }));
    },
    [client, orgGroups]
  );

  const reconcileGroupMembers = useCallback(
    async (orgId: string, desired: string[]) => {
      const key = orgId.toLowerCase();
      const group = orgGroups[key];
      if (!group) return; // nothing to reconcile yet
      const desiredLc = new Set(desired.map((a) => a.toLowerCase()));
      let current: any[] = [];
      try {
        current = await (group as any).members();
      } catch {
        return; // can't read members, skip
      }
      const currentEthAddrs = new Set<string>();
      for (const m of current) {
        const ids = (m as any).addresses ?? (m as any).accountIdentifiers ?? [];
        for (const id of ids) {
          const addr = typeof id === 'string' ? id : id.identifier;
          if (addr && /^0x[0-9a-fA-F]{40}$/.test(addr)) currentEthAddrs.add(addr.toLowerCase());
        }
      }
      const toAdd = [...desiredLc].filter((a) => !currentEthAddrs.has(a));
      const toRemove = [...currentEthAddrs].filter((a) => !desiredLc.has(a));
      if (toAdd.length > 0) {
        const ids = toAdd.map((a) => new PublicIdentity(a, 'ETHEREUM'));
        await (group as any)
          .addMembersByIdentities?.(ids)
          .catch(() => (group as any).addMembers?.(toAdd));
      }
      // Member removal is permissioned in XMTP MLS; attempt best-effort and swallow errors
      if (toRemove.length > 0) {
        await (group as any)
          .removeMembersByIdentities?.(toRemove.map((a) => new PublicIdentity(a, 'ETHEREUM')))
          .catch(() => {});
      }
    },
    [orgGroups]
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
    () => ({
      client,
      ready: !!client,
      threads,
      messages,
      orgGroups,
      orgGroupMessages,
      initClient,
      startThread,
      sendMessage,
      listMessages,
      isValidAddress,
      getOrCreateOrgGroup,
      sendGroupMessage,
      reconcileGroupMembers,
    }),
    [client, threads, messages, orgGroups, orgGroupMessages, initClient, startThread, sendMessage, listMessages, getOrCreateOrgGroup, sendGroupMessage, reconcileGroupMembers]
  );

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
};

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error('useMessaging must be used within MessagingProvider');
  return ctx;
}
