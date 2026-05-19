import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useOrgStore } from '../../state/orgStore';
import { useOrgs, useUserOrgs } from '../../hooks/useOrgs';
import { useOrgMembers } from '../../hooks/useMembers';
import { useMessaging } from '../../context/MessagingContext';
import { useWallet } from '../../context/WalletContext';

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function OrgChatScreen() {
  const navigation = useNavigation<any>();
  const activeOrgId = useOrgStore((s) => s.activeOrgId);
  const { state: walletState } = useWallet();
  const walletAddress = walletState.identity?.address;

  const { data: userOrgs } = useUserOrgs(walletAddress);
  const { data: allOrgs } = useOrgs();
  const { data: members } = useOrgMembers(activeOrgId ?? undefined);
  const messaging = useMessaging();
  const { ready, orgGroupMessages, initClient, getOrCreateOrgGroup, reconcileGroupMembers, sendGroupMessage } = messaging;

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const flatRef = useRef<FlatList>(null);

  // Determine membership
  const isMember = activeOrgId
    ? (userOrgs ?? []).some((o) => o.id.toLowerCase() === activeOrgId.toLowerCase())
    : false;

  const memberAddresses = (members ?? []).filter((m) => m.active).map((m) => m.address);
  const orgName = (allOrgs ?? []).find((o) => o.id.toLowerCase() === (activeOrgId ?? ''))?.name ?? activeOrgId ?? '';
  const orgMessages = activeOrgId ? (orgGroupMessages[activeOrgId.toLowerCase()] ?? []) : [];

  // Init XMTP client if needed (only when member)
  useEffect(() => {
    if (isMember && !ready) {
      initClient().catch((e) => console.warn('XMTP init:', e));
    }
  }, [isMember, ready, initClient]);

  // Create/reuse org group and reconcile members once client is ready
  useEffect(() => {
    if (!ready || !activeOrgId || !isMember || memberAddresses.length === 0) return;
    const orgKey = activeOrgId;
    const addrs = memberAddresses;
    getOrCreateOrgGroup(orgKey, addrs)
      .then(() => reconcileGroupMembers(orgKey, addrs))
      .catch((e) => console.warn('Group setup:', e));
  }, [ready, activeOrgId, isMember, memberAddresses.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to end when new messages arrive
  useEffect(() => {
    if (orgMessages.length > 0) {
      flatRef.current?.scrollToEnd({ animated: true });
    }
  }, [orgMessages.length]);

  // No org selected
  if (!activeOrgId) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No org selected</Text>
      </View>
    );
  }

  // Non-member gate
  if (!isMember) {
    return (
      <View style={styles.center} testID="unauthorized-banner">
        <Text style={styles.gateText}>Join this org to chat</Text>
        <Button
          title="Browse Orgs"
          onPress={() => navigation.navigate('OrgDirectory')}
        />
      </View>
    );
  }

  // Member view
  return (
    <View style={styles.container}>
      <Text style={styles.header}>{orgName}</Text>
      {!ready && <ActivityIndicator />}
      <FlatList
        testID="message-list"
        ref={flatRef}
        data={orgMessages}
        keyExtractor={(_, i) => String(i)}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.bubble}>
            <Text style={styles.sender}>{shortAddress((item as any).senderInboxId ?? '')}</Text>
            <Text>{(item as any).content?.() ?? String((item as any).content ?? '')}</Text>
          </View>
        )}
      />
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Type a message..."
        style={styles.input}
        multiline={false}
      />
      <Button
        title={busy ? 'Sending...' : 'Send'}
        disabled={!ready || !activeOrgId || draft.trim() === '' || busy}
        onPress={async () => {
          if (!activeOrgId) return;
          setBusy(true);
          try {
            await sendGroupMessage(activeOrgId, draft);
            setDraft('');
          } catch (e: any) {
            console.warn('Send failed:', e?.message ?? e);
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { color: '#999', fontSize: 16 },
  gateText: { fontSize: 18, color: '#333', marginBottom: 16, textAlign: 'center' },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  list: { flex: 1 },
  bubble: { padding: 8, borderWidth: 1, borderColor: '#eee', borderRadius: 6, marginVertical: 2 },
  sender: { fontSize: 11, color: '#888', marginBottom: 2 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8, marginTop: 8, marginBottom: 4 },
});
