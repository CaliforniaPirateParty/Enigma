import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, FlatList, Text, TextInput, View } from 'react-native';
import { useMessaging } from '../../context/MessagingContext';

export default function MessagingScreen() {
  const { ready, threads, initClient, sendMessage, listMessages } = useMessaging();
  const [peer, setPeer] = useState('0x');
  const [draft, setDraft] = useState('Ahoy, fellow pirate.');
  const [history, setHistory] = useState<{ from: string; content: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) initClient().catch((e) => console.warn('XMTP init failed', e));
  }, [ready, initClient]);

  const refresh = async () => {
    if (!ready || peer.length < 4) return;
    const msgs = await listMessages(peer, 50);
    setHistory(msgs.map((m: any) => ({ from: m.senderAddress, content: m.content?.() ?? String(m.content) })));
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Messaging (XMTP)</Text>
      {!ready && <ActivityIndicator style={{ marginTop: 12 }} />}

      <Text style={{ marginTop: 12 }}>Peer address</Text>
      <TextInput value={peer} onChangeText={setPeer} autoCapitalize="none" style={{ borderWidth: 1, padding: 8 }} />

      <Text style={{ marginTop: 12 }}>Message</Text>
      <TextInput value={draft} onChangeText={setDraft} style={{ borderWidth: 1, padding: 8 }} />

      <Button
        title={busy ? 'Sending…' : 'Send'}
        disabled={!ready || busy}
        onPress={async () => {
          setBusy(true);
          try {
            await sendMessage(peer, draft);
            await refresh();
          } catch (e: any) {
            alert(e?.message ?? String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button title="Refresh thread" onPress={refresh} disabled={!ready} />

      <Text style={{ marginTop: 16, fontWeight: 'bold' }}>Open threads: {threads.length}</Text>
      <FlatList
        data={history}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
            <Text style={{ fontSize: 12, opacity: 0.6 }}>{item.from}</Text>
            <Text>{item.content}</Text>
          </View>
        )}
      />
    </View>
  );
}
