import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useWallet } from '../../context/WalletContext';
import { usePendingRecovery, deriveThresholdFromEvents } from '../../hooks/useRecovery';
import { getContract, getExtra } from '../../utils/contracts';
import { RECOVERY_REGISTRY_ABI } from '../../utils/abis';

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return 'Ready';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export default function RecoveryStatusScreen() {
  const navigation = useNavigation();
  const route = useRoute() as any;
  const userParam: string = route?.params?.user ?? '';

  const { state, getSigner } = useWallet();
  const connectedAddress = state.identity?.address?.toLowerCase();

  const { data: pending, loading, refetch } = usePendingRecovery(userParam);

  const [now, setNow] = useState(Date.now());
  const [threshold, setThreshold] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isDelegateOf, setIsDelegateOf] = useState(false);

  // Countdown tick
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Derive threshold from events once
  useEffect(() => {
    if (userParam) {
      deriveThresholdFromEvents(userParam).then(setThreshold);
    }
  }, [userParam]);

  // Check if connected wallet is a delegate
  useEffect(() => {
    if (!connectedAddress || !userParam) return;
    const { recoveryRegistryAddress } = getExtra();
    if (!recoveryRegistryAddress) return;
    const c = getContract(recoveryRegistryAddress, RECOVERY_REGISTRY_ABI);
    c.delegatesOf(userParam)
      .then((delegates: string[]) => {
        setIsDelegateOf(delegates.map((d: string) => d.toLowerCase()).includes(connectedAddress));
      })
      .catch(() => {});
  }, [connectedAddress, userParam]);

  const isUser = connectedAddress === userParam.toLowerCase();
  const readyAt = pending?.readyAt ?? 0;
  const secondsRemaining = readyAt - now / 1000;
  const isReady = secondsRemaining <= 0;
  const canExecute = isReady && pending !== null && (threshold === null || (pending.approvals >= threshold));

  const callContract = async (method: string, args: any[] = []) => {
    try {
      setActionLoading(true);
      const signer = await getSigner();
      if (!signer) {
        Alert.alert('Error', 'No signer available.');
        return;
      }
      const { recoveryRegistryAddress } = getExtra();
      if (!recoveryRegistryAddress) return;
      const contract = getContract(recoveryRegistryAddress, RECOVERY_REGISTRY_ABI);
      const connected = contract.connect(signer as any);
      const tx = await (connected as any)[method](...args);
      await tx.wait();
      await refetch();
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      // Surface contract-specific errors to the user
      Alert.alert('Error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!pending) {
    return (
      <View style={styles.center}>
        <Text style={styles.noPendingText}>No pending recovery for this address.</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Pending Recovery</Text>
      <Text style={styles.label}>For user: <Text style={styles.mono}>{userParam}</Text></Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>New Owner</Text>
        <Text style={styles.mono}>{pending.newOwner}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Approvals</Text>
        <Text style={styles.value}>
          {pending.approvals} / {threshold !== null ? threshold : '—'} required
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ready in</Text>
        <Text style={[styles.value, isReady && styles.readyText]}>
          {isReady ? 'Ready to execute' : formatRemaining(secondsRemaining)}
        </Text>
      </View>

      {pending.orgs.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Orgs to rebind</Text>
          {pending.orgs.map((org) => (
            <Text key={org} style={styles.mono}>{org}</Text>
          ))}
        </View>
      )}

      {actionLoading ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <View style={styles.actions}>
          {isDelegateOf && (
            <Pressable
              onPress={() => callContract('approveRecovery', [userParam])}
              style={styles.approveBtn}
            >
              <Text style={styles.btnText}>Approve recovery</Text>
            </Pressable>
          )}

          {canExecute && (
            <Pressable
              onPress={() => callContract('executeRecovery', [userParam])}
              style={styles.executeBtn}
            >
              <Text style={styles.btnText}>Execute recovery</Text>
            </Pressable>
          )}

          {isUser && (
            <Pressable
              onPress={() => callContract('cancelRecovery')}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>Cancel recovery</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  label: { fontSize: 14, color: '#555', marginBottom: 8 },
  mono: { fontFamily: 'monospace', fontSize: 13 },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 12, color: '#888', marginBottom: 4, textTransform: 'uppercase' },
  value: { fontSize: 18, fontWeight: 'bold' },
  readyText: { color: '#060' },
  noPendingText: { fontSize: 16, color: '#555', marginBottom: 16, textAlign: 'center' },
  backBtn: { padding: 12, backgroundColor: '#0066cc', borderRadius: 8 },
  backBtnText: { color: '#fff', fontSize: 16 },
  loader: { marginVertical: 16 },
  actions: { gap: 10, marginTop: 8 },
  approveBtn: { backgroundColor: '#0066cc', padding: 14, borderRadius: 8, alignItems: 'center' },
  executeBtn: { backgroundColor: '#006600', padding: 14, borderRadius: 8, alignItems: 'center' },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#c00',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelBtnText: { color: '#c00', fontSize: 16, fontWeight: 'bold' },
});
