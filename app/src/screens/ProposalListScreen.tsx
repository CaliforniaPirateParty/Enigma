import React, { useState, useEffect } from 'react';
import { View, FlatList, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useProposals } from '../hooks/useProposals';

interface ProposalListScreenProps {
  orgId: string;
}

export default function ProposalListScreen({ orgId }: ProposalListScreenProps) {
  const { data: proposals, loading, error, refetch } = useProposals(orgId);
  const [latency, setLatency] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setLatency(elapsed);
    }, 50);
    return () => clearInterval(timer);
  }, [startTime]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading proposals...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Error: {error.message}</Text>
        <Text onPress={refetch} style={styles.link}>
          Retry
        </Text>
      </View>
    );
  }

  const latencyStatus = latency > 500 ? 'warning' : 'ok';

  return (
    <View style={styles.container}>
      <View style={[styles.latencyBadge, styles[`latency_${latencyStatus}`]]}>
        <Text style={styles.latencyText}>Query latency: {latency}ms</Text>
        {latency > 500 && (
          <Text style={styles.latencyWarning}>Warning: exceeded 500ms target</Text>
        )}
      </View>
      <Text style={styles.title}>Proposals</Text>
      <FlatList
        data={proposals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.proposalItem}>
            <Text style={styles.proposalTitle}>Proposal #{item.id.slice(-4)}</Text>
            <Text style={styles.proposalMeta}>
              For: {item.votesFor} • Against: {item.votesAgainst} • Abstain: {item.votesAbstain}
            </Text>
            <Text style={styles.proposalState}>State: {getStateLabel(item.state)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No proposals found</Text>
          </View>
        }
      />
    </View>
  );
}

function getStateLabel(state: number): string {
  const labels = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Executed'];
  return labels[state] || 'Unknown';
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginVertical: 12 },
  error: { color: 'red', textAlign: 'center' },
  link: { color: 'blue', marginTop: 16, textAlign: 'center' },
  latencyBadge: { paddingVertical: 12, paddingHorizontal: 12, marginVertical: 8, borderRadius: 6 },
  latency_ok: { backgroundColor: '#e8f5e9' },
  latency_warning: { backgroundColor: '#fff3e0' },
  latencyText: { fontWeight: 'bold', fontSize: 12, color: '#333' },
  latencyWarning: { color: '#e65100', fontSize: 11, marginTop: 4 },
  proposalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  proposalTitle: { fontSize: 16, fontWeight: 'bold' },
  proposalMeta: { fontSize: 12, color: '#666', marginTop: 4 },
  proposalState: { fontSize: 12, color: '#666', marginTop: 4 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, color: '#999' },
});
