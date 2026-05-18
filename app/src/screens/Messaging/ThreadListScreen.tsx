import React, { useEffect } from 'react';
import { ActivityIndicator, Button, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../App';
import { useMessaging } from '../../context/MessagingContext';

export default function ThreadListScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'ThreadList'>) {
  const { ready, threads, messages, initClient } = useMessaging();

  useEffect(() => {
    if (!ready) initClient().catch((e) => console.warn('XMTP init:', e));
  }, [ready, initClient]);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>Messages</Text>
      {!ready && <ActivityIndicator />}
      <Button title="New message" onPress={() => navigation.navigate('Messaging', { peer: '' })} />
      <FlatList
        data={threads}
        keyExtractor={(t) => t.peer}
        renderItem={({ item }) => {
          const msgs = messages[item.peer] ?? [];
          const last = msgs[msgs.length - 1];
          return (
            <TouchableOpacity
              onPress={() => navigation.navigate('Messaging', { peer: item.peer })}
              style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}
            >
              <Text style={{ fontWeight: '600' }}>{item.peer.slice(0, 10)}…{item.peer.slice(-6)}</Text>
              {last && (
                <Text style={{ color: '#666', marginTop: 2 }} numberOfLines={1}>
                  {(last as any).content?.() ?? String((last as any).content)}
                </Text>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
