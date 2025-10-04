import React, { useState } from 'react';
import { View, Text, Button, TextInput, FlatList } from 'react-native';
import { useMessaging } from '../../context/MessagingContext';

export default function MessagingScreen() {
  const { contacts, messages, addContact, sendMessage } = useMessaging();
  const [address, setAddress] = useState('0xRecipient');
  const [msg, setMsg] = useState('Hello Pirate!');

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Messaging</Text>

      <Text style={{ marginTop: 12 }}>Add Contact (mock pubkey)</Text>
      <TextInput value={address} onChangeText={setAddress} style={{ borderWidth: 1, padding: 8 }} />
      <Button title="Add Contact" onPress={() => {
        addContact({ address, publicKey: new Uint8Array(32) });
      }} />

      <Text style={{ marginTop: 12 }}>Send Encrypted Message</Text>
      <TextInput value={msg} onChangeText={setMsg} style={{ borderWidth: 1, padding: 8 }} />
      <Button title="Send" onPress={async () => {
        if (contacts[0]) {
          const m = await sendMessage(contacts[0], msg);
          alert('Sent, IPFS cid: ' + (m.pointer?.cid ?? 'n/a'));
        } else {
          alert('Add a contact first');
        }
      }} />

      <FlatList
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
            <Text>To: {item.to}</Text>
            <Text>Bytes: {item.ciphertext.length}</Text>
            <Text>IPFS: {item.pointer?.cid ?? '—'}</Text>
          </View>
        )}
      />
    </View>
  );
}
