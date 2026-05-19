import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useWallet } from '../../context/WalletContext';
import { useRecoveryDelegates, usePendingRecovery } from '../../hooks/useRecovery';
import { getContract, getExtra } from '../../utils/contracts';
import { RECOVERY_REGISTRY_ABI } from '../../utils/abis';

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function RecoveryHomeScreen() {
  const navigation = useNavigation();
  const { state, getSigner } = useWallet();
  const address = state.identity?.address;

  const { data: delegates, loading: delegatesLoading } = useRecoveryDelegates(address);
  const { data: pending, loading: pendingLoading, refetch } = usePendingRecovery(address);

  const [cancelling, setCancelling] = useState(false);

  if (!address) {
    return (
      <View style={styles.center}>
        <Text style={styles.connectText}>Connect a wallet to manage recovery</Text>
      </View>
    );
  }

  const hasDelegates = delegates && delegates.length > 0;

  const handleCancelRecovery = async () => {
    try {
      setCancelling(true);
      const signer = await getSigner();
      if (!signer) {
        Alert.alert('Error', 'No signer available.');
        return;
      }
      const { recoveryRegistryAddress } = getExtra();
      if (!recoveryRegistryAddress) return;
      const contract = getContract(recoveryRegistryAddress, RECOVERY_REGISTRY_ABI);
      const connected = contract.connect(signer as any);
      const tx = await (connected as any).cancelRecovery();
      await tx.wait();
      await refetch();
    } catch (err: any) {
      Alert.alert('Cancel failed', err?.message || 'Unknown error');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Recovery</Text>

      {/* ---- Your delegates card ---- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your delegates</Text>
        {delegatesLoading ? (
          <ActivityIndicator />
        ) : hasDelegates ? (
          <>
            {(delegates ?? []).map((d) => (
              <Text key={d.id} style={styles.mono}>{shortAddress(d.delegate)}</Text>
            ))}
            <Pressable
              onPress={() => (navigation as any).navigate('RecoverySetup')}
              style={styles.editBtn}
            >
              <Text style={styles.editBtnText}>Edit delegates</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.emptyText}>No recovery configured</Text>
            <Pressable
              onPress={() => (navigation as any).navigate('RecoverySetup')}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Set up recovery</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* ---- Pending recovery card ---- */}
      <View style={[styles.card, pending ? styles.warningCard : null]}>
        <Text style={styles.cardTitle}>Pending recovery</Text>
        {pendingLoading ? (
          <ActivityIndicator />
        ) : pending ? (
          <>
            <Text style={styles.warningText}>Pending recovery against your account</Text>
            <Text style={styles.subText}>New owner: {shortAddress(pending.newOwner)}</Text>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => (navigation as any).navigate('RecoveryStatus', { user: address })}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>View status</Text>
              </Pressable>
              {cancelling ? (
                <ActivityIndicator />
              ) : (
                <Pressable onPress={handleCancelRecovery} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel recovery</Text>
                </Pressable>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>No pending recovery against your account</Text>
        )}
      </View>

      {/* ---- Recover someone else card ---- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recover someone else</Text>
        <Text style={styles.subText}>
          If you are a delegate for another user, you can initiate a recovery on their behalf.
        </Text>
        <Pressable
          onPress={() => (navigation as any).navigate('RecoveryInitiate')}
          style={styles.editBtn}
        >
          <Text style={styles.editBtnText}>Initiate recovery for another user</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  connectText: { fontSize: 16, color: '#555', textAlign: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#fafafa',
  },
  warningCard: {
    borderColor: '#e67e22',
    backgroundColor: '#fff8f0',
  },
  cardTitle: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: '600',
  },
  mono: { fontFamily: 'monospace', fontSize: 13, marginBottom: 4 },
  emptyText: { fontSize: 14, color: '#777', marginBottom: 10 },
  warningText: { fontSize: 14, color: '#e67e22', fontWeight: '600', marginBottom: 4 },
  subText: { fontSize: 13, color: '#555', marginBottom: 10 },
  buttonRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  primaryBtn: {
    backgroundColor: '#0066cc',
    padding: 10,
    borderRadius: 7,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  editBtn: {
    borderWidth: 1,
    borderColor: '#0066cc',
    padding: 10,
    borderRadius: 7,
    alignItems: 'center',
    marginTop: 6,
  },
  editBtnText: { color: '#0066cc', fontSize: 14 },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#c00',
    padding: 10,
    borderRadius: 7,
    alignItems: 'center',
    marginTop: 6,
  },
  cancelBtnText: { color: '#c00', fontSize: 14, fontWeight: 'bold' },
});
