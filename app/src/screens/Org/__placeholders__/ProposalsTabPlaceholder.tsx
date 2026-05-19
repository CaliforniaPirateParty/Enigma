import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProposalsTabPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Proposals + voting (UI-04) — plan 04-03</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  text: { fontSize: 16, color: '#666', textAlign: 'center' },
});
