import React from 'react';
import { View, FlatList, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useOrgs } from '../hooks/useOrgs';

export default function OrgListScreen() {
  const { data: orgs, loading, error, refetch } = useOrgs();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading organizations...</Text>
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Organizations</Text>
      <FlatList
        data={orgs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.orgItem}>
            <Text style={styles.orgName}>{item.name}</Text>
            <Text style={styles.orgMeta}>
              {item.memberCount} members • {item.joinPolicy === 0 ? 'Open' : 'Restricted'}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No organizations found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginVertical: 12 },
  error: { color: 'red', textAlign: 'center' },
  link: { color: 'blue', marginTop: 16, textAlign: 'center' },
  orgItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  orgName: { fontSize: 16, fontWeight: 'bold' },
  orgMeta: { fontSize: 12, color: '#666', marginTop: 4 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, color: '#999' },
});
