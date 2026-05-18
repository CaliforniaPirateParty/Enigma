import React, { useState } from 'react';
import { View, Text, Button, TextInput, ScrollView, Alert, Modal, Clipboard, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';
import { RootStackParamList } from '../../../App';
import { useWallet } from '../../context/WalletContext';

export default function OnboardingScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Onboarding'>) {
  const { createWallet, importFromMnemonic, importFromPrivateKey, connectMetaMask, state, pendingWcUri, clearWcUri } = useWallet();
  const [mnemonic, setMnemonic] = useState('');
  const [privKey, setPrivKey] = useState('');

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Welcome to Pirate Vote</Text>
      <Text>Wallet onboarding</Text>

      <Button title="Create 12-word wallet" onPress={async () => {
        await createWallet(128);
        Alert.alert('Wallet created');
      }} />

      <Button title="Create 24-word wallet" onPress={async () => {
        await createWallet(256);
        Alert.alert('Wallet created');
      }} />

      <Text style={{ marginTop: 12, fontWeight: 'bold' }}>Import from Mnemonic</Text>
      <TextInput placeholder="Enter mnemonic"
                 value={mnemonic}
                 onChangeText={setMnemonic}
                 style={{ borderWidth: 1, padding: 8 }} />
      <Button title="Import Mnemonic" onPress={async () => {
        try {
          await importFromMnemonic(mnemonic);
          Alert.alert('Imported');
        } catch (e: any) {
          Alert.alert('Error', e.message);
        }
      }} />

      <Text style={{ marginTop: 12, fontWeight: 'bold' }}>Import from Private Key</Text>
      <TextInput placeholder="0x..."
                 value={privKey}
                 onChangeText={setPrivKey}
                 style={{ borderWidth: 1, padding: 8 }} />
      <Button title="Import Private Key" onPress={async () => {
        try {
          await importFromPrivateKey(privKey);
          Alert.alert('Imported');
        } catch (e: any) {
          Alert.alert('Error', e.message);
        }
      }} />

      <Button title="Connect MetaMask (WalletConnect v2)" onPress={async () => {
        try {
          await connectMetaMask();
          Alert.alert('Connected');
        } catch (e: any) {
          Alert.alert('Error', e.message);
        }
      }} />

      <Button title="Go to Balances" onPress={() => navigation.navigate('Balances')} />
      <Button title="Go to Voting" onPress={() => navigation.navigate('Voting')} />
      <Button title="Go to Messaging" onPress={() => navigation.navigate('ThreadList')} />

      {state.identity && (
        <Text>
          {state.connectedWith === 'walletconnect' ? 'Connected (WalletConnect): ' : 'Active: '}
          {state.identity.address}
        </Text>
      )}

      <Modal
        visible={!!pendingWcUri}
        transparent
        animationType="slide"
        onRequestClose={clearWcUri}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Scan with MetaMask</Text>
            {pendingWcUri && <QRCode value={pendingWcUri} size={240} />}
            <TouchableOpacity
              onPress={() => pendingWcUri && Clipboard.setString(pendingWcUri)}
              style={{ marginTop: 16 }}
            >
              <Text style={{ color: '#007AFF' }}>Copy link</Text>
            </TouchableOpacity>
            <Button title="Cancel" onPress={clearWcUri} />
            <Text style={{ marginTop: 12, fontSize: 12, color: '#666' }}>Waiting for wallet approval…</Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
