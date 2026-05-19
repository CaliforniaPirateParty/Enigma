import React from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProposals } from '../../hooks/useProposals';
import { useOrgStore } from '../../state/orgStore';
import { useOrgs } from '../../hooks/useOrgs';
import { RootStackParamList } from '../../../App';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const STATE_LABELS = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Executed'];

export default function VotingScreen() {
  const navigation = useNavigation<NavProp>();
  const activeOrgId = useOrgStore((s) => s.activeOrgId);
  const { data: orgs } = useOrgs();
  const activeOrg = orgs?.find((o) => o.id === activeOrgId);
  const { data: proposals, loading, error, refetch } = useProposals(activeOrgId ?? undefined);

  if (!activeOrgId) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Select an organization to view its proposals.</Text>
        <Pressable onPress={() => navigation.navigate('OrgSwitcher')}>
          <Text style={styles.link}>Open Org Switcher</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading proposals…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Error: {error.message}</Text>
        <Pressable onPress={refetch}>
          <Text style={styles.link}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voting</Text>
      <FlatList
        data={proposals ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => {
              if (!activeOrg) return;
              navigation.navigate('ProposalDetail', {
                proposalId: item.id,
                governor: activeOrg.governor,
                description: item.proposalBody,
              });
            }}
          >
            <Text style={styles.rowTitle}>Proposal #{item.id.slice(-6)}</Text>
            <Text style={styles.rowMeta}>
              For: {item.votesFor} · Against: {item.votesAgainst} · Abstain: {item.votesAbstain}
            </Text>
            <Text style={styles.rowMeta}>State: {STATE_LABELS[item.state] ?? 'Unknown'}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.muted}>No proposals yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 12, color: '#666', marginTop: 4 },
  muted: { color: '#999' },
  link: { color: '#1976d2', marginTop: 12 },
  error: { color: '#f44336' },
});
