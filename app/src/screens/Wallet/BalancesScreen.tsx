import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useWallet } from '../../context/WalletContext';
import { formatEther } from 'ethers';

export default function BalancesScreen() {
  const { getBalance, state } = useWallet();
  const [eth, setEth] = useState<string>('—');

  useEffect(() => {
    (async () => {
      const b = await getBalance();
      if (b) setEth(formatEther(b));
    })();
  }, [getBalance]);

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Balances</Text>
      <Text>Address: {state.identity?.address ?? '—'}</Text>
      <Text>ETH: {eth}</Text>
      <Text>ERC-20 and NFTs listing placeholder</Text>
    </View>
  );
}
