import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useWallet } from '../../context/WalletContext';
import { useUserOrgs } from '../../hooks/useOrgs';
import { getContract, getExtra } from '../../utils/contracts';
import { RECOVERY_REGISTRY_ABI } from '../../utils/abis';

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

export default function RecoveryInitiateScreen() {
  const navigation = useNavigation();
  const { getSigner } = useWallet();

  const [targetUser, setTargetUser] = useState('');
  const [debouncedTarget, setDebouncedTarget] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());
  const [targetError, setTargetError] = useState<string | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce target user input by 500ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (ADDRESS_REGEX.test(targetUser)) {
        setDebouncedTarget(targetUser.toLowerCase());
        setTargetError(null);
      } else if (targetUser.length > 0) {
        setTargetError('Enter a valid 0x address');
        setDebouncedTarget('');
      } else {
        setDebouncedTarget('');
        setTargetError(null);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [targetUser]);

  const { data: targetOrgs, loading: orgsLoading } = useUserOrgs(debouncedTarget || undefined);

  const toggleOrg = (orgId: string) => {
    setSelectedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  const validate = (): string | null => {
    if (!ADDRESS_REGEX.test(targetUser)) return 'Invalid target user address';
    if (!ADDRESS_REGEX.test(newOwner)) return 'Invalid new owner address';
    if (selectedOrgs.size === 0) return 'Select at least one org to recover';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Validation error', validationError);
      return;
    }
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
      const orgsArray = Array.from(selectedOrgs);
      const tx = await (connectedContract as any).proposeRecovery(targetUser, newOwner, orgsArray);
      setTxHash(tx.hash);
      await tx.wait();
      (navigation as any).navigate('RecoveryStatus', { user: targetUser });
    } catch (err: any) {
      Alert.alert('Transaction failed', err?.message || 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = validate() === null;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Initiate Recovery</Text>
      <Text style={styles.subtitle}>
        As a delegate, you can propose recovery on behalf of another user.
      </Text>

      <Text style={styles.label}>Target user address</Text>
      <TextInput
        style={[styles.input, targetError ? styles.inputError : null]}
        placeholder="0x... (address of user to recover)"
        value={targetUser}
        onChangeText={setTargetUser}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {targetError ? <Text style={styles.errorText}>{targetError}</Text> : null}

      <Text style={styles.label}>New owner address</Text>
      <TextInput
        style={[styles.input, ownerError ? styles.inputError : null]}
        placeholder="0x... (new owner for the account)"
        value={newOwner}
        onChangeText={(v) => {
          setNewOwner(v);
          setOwnerError(ADDRESS_REGEX.test(v) || v === '' ? null : 'Invalid address');
        }}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {ownerError ? <Text style={styles.errorText}>{ownerError}</Text> : null}

      <Text style={styles.label}>Organizations to recover</Text>
      {orgsLoading ? (
        <ActivityIndicator />
      ) : !debouncedTarget ? (
        <Text style={styles.hint}>Enter a valid target address to see orgs.</Text>
      ) : !targetOrgs || targetOrgs.length === 0 ? (
        <Text style={styles.hint}>No orgs found for this user.</Text>
      ) : (
        <FlatList
          data={targetOrgs}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const selected = selectedOrgs.has(item.id);
            return (
              <Pressable
                onPress={() => toggleOrg(item.id)}
                style={[styles.orgRow, selected && styles.orgRowSelected]}
              >
                <Text style={styles.orgCheck}>{selected ? '☑' : '☐'}</Text>
                <Text style={styles.orgName}>{item.name}</Text>
                <Text style={styles.orgId}>{item.id.slice(0, 10)}...</Text>
              </Pressable>
            );
          }}
        />
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
          <Text style={styles.submitBtnText}>Propose recovery</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 16 },
  label: { fontSize: 15, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 13,
  },
  inputError: { borderColor: '#c00' },
  errorText: { color: '#c00', marginTop: 4, fontSize: 13 },
  hint: { color: '#888', fontSize: 13, marginTop: 4 },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 6,
  },
  orgRowSelected: { borderColor: '#0066cc', backgroundColor: '#e8f0fe' },
  orgCheck: { fontSize: 18, marginRight: 8 },
  orgName: { flex: 1, fontSize: 15 },
  orgId: { fontSize: 12, color: '#888', fontFamily: 'monospace' },
  txHash: { color: '#060', fontFamily: 'monospace', fontSize: 12, marginVertical: 8 },
  loader: { marginVertical: 16 },
  submitBtn: {
    backgroundColor: '#0066cc',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnDisabled: { backgroundColor: '#aaa' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
