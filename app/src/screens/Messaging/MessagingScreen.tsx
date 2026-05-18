import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, FlatList, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../App';
import { useMessaging } from '../../context/MessagingContext';

export default function MessagingScreen({ route }: NativeStackScreenProps<RootStackParamList, 'Messaging'>) {
  const { ready, messages, initClient, sendMessage, listMessages, isValidAddress } = useMessaging();
  const [peer, setPeer] = useState(route.params?.peer ?? '');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!ready) initClient().catch((e) => console.warn('XMTP init:', e));
  }, [ready, initClient]);

  const msgs = messages[peer] ?? [];

  useEffect(() => {
    if (msgs.length > 0) flatRef.current?.scrollToEnd({ animated: true });
  }, [msgs.length]);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {!ready && <ActivityIndicator />}
      <TextInput
        value={peer}
        onChangeText={setPeer}
        placeholder="0x peer address"
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 8, marginBottom: 8 }}
      />
      <FlatList
        ref={flatRef}
        data={msgs}
        keyExtractor={(_, i) => String(i)}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <View style={{ padding: 8, borderWidth: 1, marginVertical: 2 }}>
            <Text style={{ fontSize: 11, opacity: 0.6 }}>{(item as any).senderAddress?.slice(0, 10)}…</Text>
            <Text>{(item as any).content?.() ?? String((item as any).content)}</Text>
          </View>
        )}
      />
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Type a message…"
        style={{ borderWidth: 1, padding: 8, marginTop: 8 }}
      />
      <Button
        title={busy ? 'Sending…' : 'Send'}
        disabled={!ready || busy || !isValidAddress(peer)}
        onPress={async () => {
          setBusy(true);
          try {
            await sendMessage(peer, draft);
            setDraft('');
          } catch (e: any) {
            alert(e?.message ?? String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button
        title="Load more"
        disabled={!ready || !isValidAddress(peer)}
        onPress={async () => {
          await listMessages(peer, 100);
        }}
      />
    </View>
  );
}
