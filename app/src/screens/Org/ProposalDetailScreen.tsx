/**
 * ProposalDetailScreen.tsx
 *
 * Proposal detail with:
 * - IPFS body fetch via resolveProposalBody
 * - Vote casting (castSponsoredVote → fallback to castDirectVote on SponsorshipNotAvailable)
 * - Tally display
 * - State-gated Execute button (Succeeded → OrgGovernor.execute)
 * - "You voted X" badge once user has voted
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { ethers, Contract } from 'ethers';
import { useProposalDetail } from '../../hooks/useProposals';
import { useOrgs, useUserOrgs } from '../../hooks/useOrgs';
import { useWallet } from '../../context/WalletContext';
import { useOrgStore } from '../../state/orgStore';
import {
  resolveProposalBody,
  ProposalBodyResolution,
} from '../../utils/proposalBody';
import {
  castSponsoredVote,
  castDirectVote,
  SponsorshipNotAvailable,
} from '../../utils/sponsor';
import { ORG_GOVERNOR_ABI } from '../../utils/abis';
import { RootStackParamList } from '../../../App';

type RouteProp = {
  params: { proposalId: string; governor: string; description?: string };
};

// ---------------------------------------------------------------------------
// State label helpers (mirrors OrgProposalsScreen)
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

function getStateLabel(state: number): string {
  return STATE_LABELS[state] ?? 'Unknown';
}

const VOTE_LABELS: Record<number, string> = {
  0: 'Against',
  1: 'For',
  2: 'Abstain',
};

// ---------------------------------------------------------------------------
// Vote weight display
// ---------------------------------------------------------------------------

function displayWeight(wei: string): string {
  try {
    const n = BigInt(wei);
    if (n <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(n).toString();
    return n.toString();
  } catch {
    return parseInt(wei, 10).toString();
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProposalDetailScreen() {
  const route = useRoute() as RouteProp;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { proposalId, governor, description: routeDescription } = route.params;

  const activeOrgId = useOrgStore((s) => s.activeOrgId);
  const { state, getSigner } = useWallet();
  const walletAddress = state.identity?.address;

  const { data: userOrgs } = useUserOrgs(walletAddress ?? undefined);
  const { data: allOrgs } = useOrgs();

  const isMember = userOrgs?.some((o) => o.id === activeOrgId) ?? false;

  const { data, loading, error, refetch } = useProposalDetail(proposalId);
  const proposal = data?.proposal ?? null;
  const votes = data?.votes ?? [];

  const [body, setBody] = useState<ProposalBodyResolution | null>(null);
  const [voting, setVoting] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Resolve proposal body from IPFS or plain text
  useEffect(() => {
    if (!proposal) return;
    resolveProposalBody(proposal.proposalBody).then(setBody);
  }, [proposal?.proposalBody]);

  // Compute user's prior vote
  const userVote: 0 | 1 | 2 | null = (() => {
    if (!walletAddress) return null;
    const found = votes.find(
      (v) => v.voter.toLowerCase() === walletAddress.toLowerCase()
    );
    return found != null ? (found.support as 0 | 1 | 2) : null;
  })();

  const canVote =
    proposal?.state === 1 && userVote === null && !!getSigner && isMember;

  const canExecute =
    proposal?.state === 4 && !!getSigner && isMember;

  // ---------------------------------------------------------------------------
  // Vote handler
  // ---------------------------------------------------------------------------

  async function handleVote(support: 0 | 1 | 2) {
    setVoting(true);
    try {
      const signer = await getSigner();
      if (!signer) throw new Error('no_signer');
      const sender = (await signer.getAddress()).toLowerCase();
      let tx: { hash: string; wait: () => Promise<unknown> } | undefined;
      try {
        // castSponsoredVote always throws SponsorshipNotAvailable (Option A MVP)
        // This call performs the real handshake; bundler submission is deferred
        await castSponsoredVote({
          signer,
          sender,
          governor,
          proposalId,
          support,
          membership: activeOrgId!,
        });
        // Should never reach here (castSponsoredVote always throws in MVP)
        throw new SponsorshipNotAvailable('unexpected_non_throw');
      } catch (e: unknown) {
        if (e instanceof SponsorshipNotAvailable) {
          console.warn(
            'Sponsorship unavailable, falling back to direct vote:',
            (e as Error).message
          );
          tx = await castDirectVote({ signer, governor, proposalId, support });
        } else {
          throw e;
        }
      }
      if (!tx) throw new Error('no_tx');
      Alert.alert('Vote submitted', `tx: ${tx.hash}`);
      await tx.wait();
      refetch();
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      Alert.alert('Vote failed', err?.shortMessage ?? err?.message ?? String(e));
    } finally {
      setVoting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Execute handler
  // ---------------------------------------------------------------------------

  async function handleExecute() {
    setExecuting(true);
    try {
      const signer = await getSigner();
      if (!signer) throw new Error('no_signer');
      const description = routeDescription ?? proposal?.proposalBody ?? '';
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));
      const c = new Contract(governor, ORG_GOVERNOR_ABI, signer);
      // MVP proposals are signal-only: empty targets/values/calldatas
      const tx = await c.execute([], [], [], descriptionHash);
      Alert.alert('Execute submitted', `tx: ${tx.hash}`);
      await tx.wait();
      refetch();
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      Alert.alert(
        'Execute failed',
        err?.shortMessage ?? err?.message ?? String(e)
      );
    } finally {
      setExecuting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading && !proposal) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error && !proposal) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error.message}</Text>
        <Pressable onPress={() => refetch()}>
          <Text style={styles.link}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!proposal) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Proposal not found.</Text>
      </View>
    );
  }

  // Render body
  function renderBody() {
    if (!body) return <ActivityIndicator size="small" />;
    if (body.kind === 'plain') {
      return <Text style={styles.bodyText}>{body.text}</Text>;
    }
    if (body.error) {
      return (
        <View>
          <Text style={styles.errorText}>
            IPFS fetch failed: {body.error.message}
          </Text>
          <Pressable
            onPress={() =>
              resolveProposalBody(proposal!.proposalBody).then(setBody)
            }
          >
            <Text style={styles.link}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    if (body.json != null) {
      return (
        <ScrollView horizontal>
          <Text style={styles.bodyMono}>
            {JSON.stringify(body.json, null, 2)}
          </Text>
        </ScrollView>
      );
    }
    return <Text style={styles.bodyText}>{body.text}</Text>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>
          Proposal #{proposal.id.slice(-6)}
        </Text>
        <View style={styles.stateChip}>
          <Text style={styles.stateChipText}>
            {getStateLabel(proposal.state)}
          </Text>
        </View>
      </View>
      <Text style={styles.proposerText}>
        by {proposal.proposer.slice(0, 10)}…
      </Text>

      {/* Body */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        {renderBody()}
      </View>

      {/* Tallies */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Votes</Text>
        <Text style={styles.tallies}>
          For {displayWeight(proposal.votesFor)} · Against{' '}
          {displayWeight(proposal.votesAgainst)} · Abstain{' '}
          {displayWeight(proposal.votesAbstain)}
        </Text>
      </View>

      {/* Vote section */}
      <View style={styles.section}>
        {userVote != null && (
          <View style={styles.votedBadge} testID="voted-badge">
            <Text style={styles.votedBadgeText}>
              You voted {VOTE_LABELS[userVote]}
            </Text>
          </View>
        )}

        {canVote && userVote == null && (
          <View style={styles.voteButtons}>
            <Pressable
              testID="vote-for-button"
              style={[styles.voteBtn, styles.voteFor]}
              onPress={() => handleVote(1)}
              disabled={voting}
            >
              <Text style={styles.voteBtnText}>For</Text>
            </Pressable>
            <Pressable
              testID="vote-against-button"
              style={[styles.voteBtn, styles.voteAgainst]}
              onPress={() => handleVote(0)}
              disabled={voting}
            >
              <Text style={styles.voteBtnText}>Against</Text>
            </Pressable>
            <Pressable
              testID="vote-abstain-button"
              style={[styles.voteBtn, styles.voteAbstain]}
              onPress={() => handleVote(2)}
              disabled={voting}
            >
              <Text style={styles.voteBtnText}>Abstain</Text>
            </Pressable>
          </View>
        )}

        {!canVote && userVote == null && proposal.state !== 1 && (
          <Text style={styles.votingClosed}>
            Voting closed — state: {getStateLabel(proposal.state)}
          </Text>
        )}

        {!walletAddress && (
          <Text style={styles.hint}>
            Connect a local wallet to vote.
          </Text>
        )}

        {walletAddress && !isMember && proposal.state === 1 && (
          <Text style={styles.hint}>Join this org to vote.</Text>
        )}
      </View>

      {/* Execute section */}
      {canExecute && (
        <View style={styles.section}>
          <Pressable
            testID="execute-button"
            style={[styles.voteBtn, styles.executeBtn]}
            onPress={handleExecute}
            disabled={executing}
          >
            <Text style={styles.voteBtnText}>
              {executing ? 'Executing…' : 'Execute proposal'}
            </Text>
          </Pressable>
        </View>
      )}

      {proposal.state === 6 && proposal.executedAt && (
        <View style={styles.section}>
          <Text style={styles.executedBadge}>
            Executed at block {proposal.executedAt}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    color: '#111',
  },
  stateChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#1976d2',
    marginLeft: 8,
  },
  stateChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  proposerText: { fontSize: 12, color: '#888', marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bodyText: { fontSize: 15, color: '#222', lineHeight: 22 },
  bodyMono: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  tallies: { fontSize: 14, color: '#444' },
  voteButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  voteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteFor: { backgroundColor: '#4caf50' },
  voteAgainst: { backgroundColor: '#f44336' },
  voteAbstain: { backgroundColor: '#9e9e9e' },
  executeBtn: { backgroundColor: '#1976d2' },
  voteBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  votedBadge: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  votedBadgeText: { color: '#1976d2', fontWeight: '600', fontSize: 14 },
  votingClosed: { color: '#666', fontSize: 14, fontStyle: 'italic' },
  hint: { color: '#999', fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  executedBadge: { color: '#757575', fontSize: 13 },
  errorText: { color: '#f44336', textAlign: 'center', marginBottom: 8 },
  link: { color: '#1976d2', textAlign: 'center', marginTop: 4 },
  emptyText: { color: '#999', fontSize: 15 },
});
