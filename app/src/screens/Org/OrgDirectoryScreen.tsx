import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Contract } from 'ethers';
import { useOrgs, useUserOrgs } from '../../hooks/useOrgs';
import { useWallet } from '../../context/WalletContext';
import { MEMBERSHIP_NFT_ABI } from '../../utils/abis';
import { Org } from '../../types/subgraph';

function policyLabel(joinPolicy: number): string {
  switch (joinPolicy) {
    case 0: return 'Open';
    case 1: return 'Allowlist';
    case 2: return 'Application';
    default: return 'Unknown';
  }
}

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function OrgDirectoryScreen() {
  const { data: orgs, loading, error, refetch } = useOrgs();
  const { state, getSigner } = useWallet();
  const walletAddress = state.identity?.address;
  const { data: userOrgs, refetch: refetchUserOrgs } = useUserOrgs(walletAddress);

  const joinedSet = new Set((userOrgs ?? []).map((o) => o.id.toLowerCase()));

  const onJoin = useCallback(async (org: Org) => {
    try {
      const signer = await getSigner();
      if (!signer) {
        Alert.alert('No wallet', 'Connect a local wallet to join');
        return;
      }
      const c = new Contract(org.id, MEMBERSHIP_NFT_ABI, signer);
      const tx = await c.joinOpen();
      Alert.alert('Join submitted', `tx: ${tx.hash}`);
      await tx.wait();
      await refetchUserOrgs();
      Alert.alert('Joined!', org.name);
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? String(e);
      Alert.alert('Join failed', msg);
    }
  }, [getSigner, refetchUserOrgs]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading directory...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error.message}</Text>
        <Text onPress={refetch} style={styles.link}>Retry</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: Org }) => {
    const isJoined = joinedSet.has(item.id.toLowerCase());
    const isOpen = item.joinPolicy === 0;

    return (
      <View style={styles.row}>
        <View style={styles.rowInfo}>
          <Text style={styles.orgName}>{item.name}</Text>
          <Text style={styles.orgMeta}>
            {item.symbol} • {item.memberCount} members • {shortAddress(item.id)}
          </Text>
        </View>

        {isJoined ? (
          <View
            testID={`joined-badge-${item.id}`}
            style={[styles.badge, styles.joinedBadge]}
          >
            <Text style={styles.badgeText}>Joined</Text>
          </View>
        ) : isOpen ? (
          <Pressable
            testID={`join-btn-${item.id}`}
            style={styles.joinButton}
            onPress={() => onJoin(item)}
          >
            <Text style={styles.joinButtonText}>Join</Text>
          </Pressable>
        ) : (
          <View
            testID={`policy-badge-${item.id}`}
            style={[styles.badge, styles.policyBadge]}
          >
            <Text style={styles.badgeText}>{policyLabel(item.joinPolicy)}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Org Directory</Text>
      <FlatList
        data={orgs ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No organizations found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowInfo: { flex: 1 },
  orgName: { fontSize: 16, fontWeight: 'bold' },
  orgMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  joinedBadge: { backgroundColor: '#d4edda' },
  policyBadge: { backgroundColor: '#f0f0f0' },
  badgeText: { fontSize: 12, color: '#444' },
  joinButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  joinButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  errorText: { color: 'red' },
  link: { color: 'blue', marginTop: 8 },
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { color: '#999' },
});
