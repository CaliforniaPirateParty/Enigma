/**
 * OrgProposalsScreen.tsx
 *
 * Active-org proposal list backed by useProposals.
 * FAB navigates to CreateProposal. Each row navigates to ProposalDetail.
 * Replaces ProposalsTabPlaceholder in OrgTabs.
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProposals } from '../../hooks/useProposals';
import { useOrgs, useUserOrgs } from '../../hooks/useOrgs';
import { useOrgStore } from '../../state/orgStore';
import { useWallet } from '../../context/WalletContext';
import { RootStackParamList } from '../../../App';
import { Proposal } from '../../types/subgraph';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ---------------------------------------------------------------------------
// State label helpers
// ---------------------------------------------------------------------------

const STATE_LABELS: Record<number, string> = {
  0: 'Pending',
  1: 'Active',
  2: 'Canceled',
  3: 'Defeated',
  4: 'Succeeded',
  5: 'Queued',
  6: 'Executed',
};

const STATE_COLORS: Record<number, string> = {
  0: '#bdbdbd',
  1: '#4caf50',
  2: '#9e9e9e',
  3: '#f44336',
  4: '#2196f3',
  5: '#ff9800',
  6: '#757575',
};

function getStateLabel(state: number): string {
  return STATE_LABELS[state] ?? 'Unknown';
}

function getStateColor(state: number): string {
  return STATE_COLORS[state] ?? '#bdbdbd';
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function OrgProposalsScreen() {
  const navigation = useNavigation<NavProp>();
  const activeOrgId = useOrgStore((s) => s.activeOrgId);
  const { state } = useWallet();
  const walletAddress = state.identity?.address;

  const { data: allOrgs } = useOrgs();
  const { data: userOrgs } = useUserOrgs(walletAddress ?? undefined);

  const activeOrg = allOrgs?.find((o) => o.id === activeOrgId);
  const isMember = userOrgs?.some((o) => o.id === activeOrgId) ?? false;

  const { data: proposals, loading, error, refetch } = useProposals(activeOrgId ?? undefined);

  if (!activeOrgId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Select an org from the rail.</Text>
      </View>
    );
  }

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
        <Text style={styles.errorText}>Error: {error.message}</Text>
        <Text onPress={refetch} style={styles.link}>
          Retry
        </Text>
      </View>
    );
  }

  function onPressProposal(item: Proposal) {
    if (!activeOrg) return;
    navigation.navigate('ProposalDetail', {
      proposalId: item.id,
      governor: activeOrg.governor,
      description: item.proposalBody,
    });
  }

  function onPressFab() {
    if (!activeOrg) return;
    navigation.navigate('CreateProposal', {
      orgId: activeOrgId!,
      governor: activeOrg.governor,
    });
  }

  const sortedProposals = proposals
    ? [...proposals].sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    : [];

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedProposals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.proposalRow}
            onPress={() => onPressProposal(item)}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.proposalTitle}>
                Proposal #{item.id.slice(-6)}
              </Text>
              <View
                style={[
                  styles.stateChip,
                  { backgroundColor: getStateColor(item.state) },
                ]}
              >
                <Text style={styles.stateChipText}>
                  {getStateLabel(item.state)}
                </Text>
              </View>
            </View>
            <Text style={styles.tallies}>
              For: {item.votesFor} · Against: {item.votesAgainst} · Abstain:{' '}
              {item.votesAbstain}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No proposals yet.</Text>
          </View>
        }
      />

      {activeOrgId && isMember && (
        <Pressable
          style={styles.fab}
          onPress={onPressFab}
          testID="create-proposal-fab"
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: { color: '#f44336', textAlign: 'center', marginBottom: 8 },
  link: { color: '#1976d2', marginTop: 8 },
  emptyText: { color: '#999', fontSize: 15, textAlign: 'center' },
  proposalRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  proposalTitle: { fontSize: 15, fontWeight: '600', color: '#111', flex: 1 },
  stateChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 8,
  },
  stateChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tallies: { fontSize: 12, color: '#666' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '400' },
});
