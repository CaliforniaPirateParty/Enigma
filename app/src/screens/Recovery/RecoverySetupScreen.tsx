import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useWallet } from '../../context/WalletContext';
import { useRecoveryDelegates } from '../../hooks/useRecovery';
import { getContract, getExtra } from '../../utils/contracts';
import { RECOVERY_REGISTRY_ABI } from '../../utils/abis';

// ---------------------------------------------------------------------------
// Exported validation helper (for tests and submit gate)
// ---------------------------------------------------------------------------

export function validate(addresses: string[], threshold: number): string | null {
  if (addresses.length < 3 || addresses.length > 5) return 'Need 3-5 delegates';
  for (const a of addresses) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return 'Invalid address';
  }
  const dedup = new Set(addresses.map((a) => a.toLowerCase()));
  if (dedup.size !== addresses.length) return 'Duplicate delegate';
  if (threshold < 1 || threshold > addresses.length) return 'Threshold out of range';
  if (threshold * 2 <= addresses.length) return 'Threshold must be strict majority';
  return null;
}

// ---------------------------------------------------------------------------
// RecoverySetupScreen
// ---------------------------------------------------------------------------

export default function RecoverySetupScreen() {
  const navigation = useNavigation();
  const { state, getSigner } = useWallet();
  const address = state.identity?.address;

  const { data: existingDelegates, refetch } = useRecoveryDelegates(address);

  const [delegates, setDelegates] = useState<string[]>(['', '', '']);
  const [threshold, setThreshold] = useState(2);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from existing delegates
  useEffect(() => {
    if (existingDelegates && existingDelegates.length >= 3) {
      setDelegates(existingDelegates.map((d) => d.delegate));
      // Derive threshold from store not available here — user sets it
    }
  }, [existingDelegates]);

  const validationError = validate(delegates, threshold);
  const canSubmit = validationError === null;

  const addDelegate = () => {
    if (delegates.length < 5) {
      setDelegates([...delegates, '']);
    }
  };

  const removeDelegate = (index: number) => {
    if (delegates.length > 3) {
      setDelegates(delegates.filter((_, i) => i !== index));
    }
  };

  const updateDelegate = (index: number, value: string) => {
    const next = [...delegates];
    next[index] = value;
    setDelegates(next);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      const signer = await getSigner();
      if (!signer) {
        Alert.alert('Error', 'No signer available. Please connect a local wallet.');
        setSubmitting(false);
        return;
      }
      const { recoveryRegistryAddress } = getExtra();
      if (!recoveryRegistryAddress) {
        Alert.alert('Error', 'Recovery registry address not configured.');
        setSubmitting(false);
        return;
      }
      const contract = getContract(recoveryRegistryAddress, RECOVERY_REGISTRY_ABI);
      const connectedContract = contract.connect(signer as any);
      const tx = await (connectedContract as any).setDelegates(delegates, threshold);
      setTxHash(tx.hash);
      await tx.wait();
      await refetch();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Transaction failed', err?.message || 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Set Recovery Delegates</Text>
      <Text style={styles.subtitle}>
        Choose 3-5 trusted delegates who can initiate account recovery on your behalf.
        The threshold must be a strict majority (more than half).
      </Text>

      {delegates.map((addr, index) => (
        <View key={index} style={styles.row}>
          <TextInput
            style={styles.input}
            placeholder={`Delegate ${index + 1} address (0x...)`}
            value={addr}
            onChangeText={(v) => updateDelegate(index, v)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {delegates.length > 3 && (
            <Pressable onPress={() => removeDelegate(index)} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>✕</Text>
            </Pressable>
          )}
        </View>
      ))}

      {delegates.length < 5 && (
        <Pressable onPress={addDelegate} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Add delegate</Text>
        </Pressable>
      )}

      <View style={styles.thresholdRow}>
        <Text style={styles.label}>Threshold: </Text>
        <Pressable
          onPress={() => setThreshold(Math.max(1, threshold - 1))}
          style={styles.stepBtn}
        >
          <Text style={styles.stepBtnText}>-</Text>
        </Pressable>
        <Text style={styles.thresholdValue}>{threshold}</Text>
        <Pressable
          onPress={() => setThreshold(Math.min(delegates.length, threshold + 1))}
          style={styles.stepBtn}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
        <Text style={styles.thresholdHint}> of {delegates.length}</Text>
      </View>

      {validationError && (
        <Text style={styles.errorText}>{validationError}</Text>
      )}

      {txHash && (
        <Text style={styles.txHash}>Tx submitted: {txHash}</Text>
      )}

      {submitting ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <Pressable
          onPress={handleSubmit}
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          disabled={!canSubmit}
        >
          <Text style={styles.submitBtnText}>Save delegates</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 13,
  },
  removeBtn: { marginLeft: 8, padding: 8 },
  removeBtnText: { color: '#c00', fontSize: 16 },
  addBtn: { marginBottom: 16, padding: 10, alignItems: 'center' },
  addBtnText: { color: '#0066cc', fontSize: 15 },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: { fontSize: 15 },
  stepBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  stepBtnText: { fontSize: 18, fontWeight: 'bold' },
  thresholdValue: { fontSize: 20, fontWeight: 'bold', minWidth: 24, textAlign: 'center' },
  thresholdHint: { fontSize: 14, color: '#555' },
  errorText: { color: '#c00', marginBottom: 8 },
  txHash: { color: '#060', fontFamily: 'monospace', fontSize: 12, marginBottom: 8 },
  loader: { marginVertical: 16 },
  submitBtn: {
    backgroundColor: '#0066cc',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: '#aaa' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
