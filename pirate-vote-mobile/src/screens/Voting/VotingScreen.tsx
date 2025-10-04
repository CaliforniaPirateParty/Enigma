import React from 'react';
import { View, Text, Button, FlatList } from 'react-native';
import { useVoting } from '../../context/VotingContext';

export default function VotingScreen() {
  const { proposals, castVoteOffChain } = useVoting();

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Voting</Text>
      <FlatList
        data={proposals}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderWidth: 1, marginVertical: 8 }}>
            <Text style={{ fontWeight: 'bold' }}>{item.title}</Text>
            <Text>{item.description}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {item.choices.map((c, i) => (
                <Button key={c} title={c} onPress={async () => {
                  const sig = await castVoteOffChain(item.id, i);
                  alert('Signed vote: ' + sig.slice(0, 18) + '...');
                }} />
              ))}
            </View>
          </View>
        )}
      />
    </View>
  );
}
