import 'react-native-get-random-values';
import 'react-native-webcrypto';
import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import 'react-native-webcrypto';
import 'react-native-url-polyfill/auto';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WalletProvider } from './src/context/WalletContext';
import { VotingProvider } from './src/context/VotingContext';
import { MessagingProvider } from './src/context/MessagingContext';
import OnboardingScreen from './src/screens/Wallet/OnboardingScreen';
import VotingScreen from './src/screens/Voting/VotingScreen';
import MessagingScreen from './src/screens/Messaging/MessagingScreen';
import BalancesScreen from './src/screens/Wallet/BalancesScreen';

export type RootStackParamList = {
  Onboarding: undefined;
  Balances: undefined;
  Voting: undefined;
  Messaging: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <WalletProvider>
      <VotingProvider>
        <MessagingProvider>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Onboarding">
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="Balances" component={BalancesScreen} />
              <Stack.Screen name="Voting" component={VotingScreen} />
              <Stack.Screen name="Messaging" component={MessagingScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </MessagingProvider>
      </VotingProvider>
    </WalletProvider>
  );
}
