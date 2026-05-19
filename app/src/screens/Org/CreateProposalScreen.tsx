/**
 * CreateProposalScreen.tsx
 *
 * Form for creating a new signal proposal:
 * 1. Enter title + body (validated)
 * 2. Pin { title, body, proposer, timestamp } to IPFS via pinJson → get CID
 * 3. Call OrgGovernor.propose([], [], [], cid)
 * 4. Navigate back to OrgProposalsScreen after tx confirms
 *
 * Signal-only: MVP proposals have empty targets/values/calldatas.
 * Future plans can extend the form with action-encoding.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Contract } from 'ethers';
import { useWallet } from '../../context/WalletContext';
import { pinJson } from '../../utils/storage';
import { ORG_GOVERNOR_ABI } from '../../utils/abis';

type RouteProp = {
  params: { orgId: string; governor: string };
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const TITLE_MIN = 4;
const TITLE_MAX = 80;
const BODY_MIN = 10;
const BODY_MAX = 4000;

function isTitleValid(t: string): boolean {
  const len = t.trim().length;
  return len >= TITLE_MIN && len <= TITLE_MAX;
}

function isBodyValid(b: string): boolean {
  const len = b.trim().length;
  return len >= BODY_MIN && len <= BODY_MAX;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CreateProposalScreen() {
  const route = useRoute() as RouteProp;
  const navigation = useNavigation();
  const { governor } = route.params;

  const { state, getSigner } = useWallet();
  const walletAddress = state.identity?.address;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    isTitleValid(title) && isBodyValid(body) && !submitting;

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const signer = await getSigner();
      if (!signer) throw new Error('no_signer');
      const proposer = (await signer.getAddress()).toLowerCase();
      const payload = {
        title: title.trim(),
        body: body.trim(),
        proposer,
        timestamp: Math.floor(Date.now() / 1000),
      };
      const { cid } = await pinJson(payload, payload.title);
      const c = new Contract(governor, ORG_GOVERNOR_ABI, signer);
      const tx = await c.propose([], [], [], cid);
      Alert.alert('Proposal submitted', `tx: ${tx.hash}`);
      await tx.wait();
      navigation.goBack();
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      Alert.alert(
        'Create proposal failed',
        err?.shortMessage ?? err?.message ?? String(e)
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Guard: wallet not connected
  // ---------------------------------------------------------------------------

  if (!walletAddress) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>
          Connect a local wallet to create a proposal.
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Proposal title (4–80 characters)"
          maxLength={TITLE_MAX}
          returnKeyType="next"
          testID="title-input"
        />
        {title.length > 0 && !isTitleValid(title) && (
          <Text style={styles.validationHint}>
            Title must be 4–80 characters.
          </Text>
        )}

        <Text style={[styles.label, { marginTop: 16 }]}>Body</Text>
        <TextInput
          style={[styles.input, styles.bodyInput]}
          value={body}
          onChangeText={setBody}
          placeholder="Proposal description (10–4000 characters)"
          maxLength={BODY_MAX}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          testID="body-input"
        />
        {body.length > 0 && !isBodyValid(body) && (
          <Text style={styles.validationHint}>
            Body must be 10–4000 characters.
          </Text>
        )}

        <Pressable
          testID="submit-proposal-button"
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Proposal</Text>
          )}
        </Pressable>

        <Text style={styles.footerNote}>
          The proposal body will be pinned to IPFS. This is a signal-only
          proposal — no on-chain actions will be executed automatically.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  hint: { color: '#999', fontSize: 15, textAlign: 'center' },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fafafa',
  },
  bodyInput: {
    minHeight: 120,
    paddingTop: 10,
  },
  validationHint: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  submitBtn: {
    marginTop: 24,
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#bdbdbd',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerNote: {
    marginTop: 16,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});
