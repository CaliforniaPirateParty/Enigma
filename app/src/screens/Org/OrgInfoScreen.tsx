import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useOrgStore } from '../../state/orgStore';
import { useOrgs } from '../../hooks/useOrgs';

function policyLabel(joinPolicy: number): string {
  switch (joinPolicy) {
    case 0: return 'Open';
    case 1: return 'Allowlist';
    case 2: return 'Application';
    default: return 'Unknown';
  }
}

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function OrgInfoScreen() {
  const activeOrgId = useOrgStore((s) => s.activeOrgId);
  const { data: orgs } = useOrgs();

  if (!activeOrgId) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No org selected</Text>
      </View>
    );
  }

  const org = (orgs ?? []).find((o) => o.id.toLowerCase() === activeOrgId);

  if (!org) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Loading org info...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{org.name}</Text>
      <Text style={styles.symbol}>{org.symbol}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Members</Text>
        <Text style={styles.value}>{org.memberCount}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Join Policy</Text>
        <Text style={styles.value}>{policyLabel(org.joinPolicy)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Membership NFT</Text>
        <Text style={styles.value}>{shortAddress(org.membership)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Governor</Text>
        <Text style={styles.value}>{shortAddress(org.governor)}</Text>
      </View>

      {org.metadataURI ? (
        <View style={styles.row}>
          <Text style={styles.label}>Metadata URI</Text>
          <Text style={styles.valueSmall}>{org.metadataURI}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#999', fontSize: 16 },
  name: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  symbol: { fontSize: 14, color: '#888', marginBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: { fontSize: 14, color: '#555', fontWeight: '500' },
  value: { fontSize: 14, color: '#222' },
  valueSmall: { fontSize: 12, color: '#222', flexShrink: 1, textAlign: 'right' },
});
