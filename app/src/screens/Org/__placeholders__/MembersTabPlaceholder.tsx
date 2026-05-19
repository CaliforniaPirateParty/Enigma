import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MembersTabPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Member directory (UI-02) — plan 04-02</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  text: { fontSize: 16, color: '#666', textAlign: 'center' },
});
