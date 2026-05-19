import React from 'react';
import {
  ActivityIndicator,
  Button,
  Clipboard,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useOrgStore } from '../../state/orgStore';
import { useOrgs } from '../../hooks/useOrgs';
import { useOrgMembers } from '../../hooks/useMembers';
import { Member } from '../../types/subgraph';

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(mintedAt: string): string {
  try {
    return new Date(parseInt(mintedAt, 10) * 1000).toLocaleDateString();
  } catch {
    return mintedAt;
  }
}

export default function OrgMembersScreen() {
  const activeOrgId = useOrgStore((s) => s.activeOrgId);
  const { data: members, loading, error, refetch } = useOrgMembers(activeOrgId ?? undefined);
  const { data: orgs } = useOrgs();

  const org = activeOrgId
    ? (orgs ?? []).find((o) => o.id.toLowerCase() === activeOrgId.toLowerCase())
    : null;
  const creatorAddress = org?.creator?.toLowerCase() ?? '';

  if (!activeOrgId) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No org selected</Text>
      </View>
    );
  }

  if (loading && !members) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error.message}</Text>
        <Button title="Retry" onPress={refetch} />
      </View>
    );
  }

  const activeMembers = (members ?? []).filter((m) => m.active);

  const renderItem = ({ item }: { item: Member }) => {
    const isOwner = item.address.toLowerCase() === creatorAddress;
    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.address}>{shortAddress(item.address)}</Text>
          <Text style={styles.date}>{formatDate(item.mintedAt)}</Text>
        </View>
        {isOwner && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Owner</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <FlatList
      data={activeMembers}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshing={loading}
      onRefresh={refetch}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.empty}>No members found</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { color: '#999', fontSize: 16 },
  errorText: { color: '#c00', fontSize: 14, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowLeft: { flex: 1 },
  address: { fontSize: 14, color: '#222', fontFamily: 'monospace' },
  date: { fontSize: 12, color: '#888', marginTop: 2 },
  badge: {
    backgroundColor: '#4a90d9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
});
