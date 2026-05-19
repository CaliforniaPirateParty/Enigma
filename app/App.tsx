import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WalletProvider } from './src/context/WalletContext';
import { VotingProvider } from './src/context/VotingContext';
import { MessagingProvider } from './src/context/MessagingContext';
import OnboardingScreen from './src/screens/Wallet/OnboardingScreen';
import VotingScreen from './src/screens/Voting/VotingScreen';
import ThreadListScreen from './src/screens/Messaging/ThreadListScreen';
import MessagingScreen from './src/screens/Messaging/MessagingScreen';
import BalancesScreen from './src/screens/Wallet/BalancesScreen';
import OrgListScreen from './src/screens/OrgListScreen';
import ProposalListScreen from './src/screens/ProposalListScreen';
import OrgSwitcherScreen from './src/screens/Org/OrgSwitcherScreen';
import OrgDirectoryScreen from './src/screens/Org/OrgDirectoryScreen';
import ProposalDetailScreen from './src/screens/Org/ProposalDetailScreen';
import CreateProposalScreen from './src/screens/Org/CreateProposalScreen';
import RecoveryHomeScreen from './src/screens/Recovery/RecoveryHomeScreen';
import RecoverySetupScreen from './src/screens/Recovery/RecoverySetupScreen';
import RecoveryInitiateScreen from './src/screens/Recovery/RecoveryInitiateScreen';
import RecoveryStatusScreen from './src/screens/Recovery/RecoveryStatusScreen';
import { useOrgStore } from './src/state/orgStore';

export type RootStackParamList = {
  Onboarding: undefined;
  Balances: undefined;
  Voting: undefined;
  ThreadList: undefined;          // list of all XMTP threads
  Messaging: { peer: string };    // per-thread detail view — requires peer address
  OrgList: undefined;
  ProposalList: { orgId: string };
  OrgSwitcher: undefined;
  OrgDirectory: undefined;
  RecoveryHome: undefined;
  RecoverySetup: undefined;
  RecoveryInitiate: undefined;
  RecoveryStatus: { user: string };
  ProposalDetail: { proposalId: string; governor: string; description?: string };
  CreateProposal: { orgId: string; governor: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  // Hydrate the active-org store from AsyncStorage on mount
  useEffect(() => {
    useOrgStore.getState().hydrate();
  }, []);

  return (
    <WalletProvider>
      <VotingProvider>
        <MessagingProvider>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Onboarding">
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="OrgSwitcher" component={OrgSwitcherScreen} options={{ title: 'Organizations' }} />
              <Stack.Screen name="OrgDirectory" component={OrgDirectoryScreen} options={{ title: 'Org Directory' }} />
              <Stack.Screen name="RecoveryHome" component={RecoveryHomeScreen} options={{ title: 'Recovery' }} />
              <Stack.Screen name="RecoverySetup" component={RecoverySetupScreen} options={{ title: 'Set Recovery Delegates' }} />
              <Stack.Screen name="RecoveryInitiate" component={RecoveryInitiateScreen} options={{ title: 'Initiate Recovery' }} />
              <Stack.Screen name="RecoveryStatus" component={RecoveryStatusScreen} options={{ title: 'Recovery Status' }} />
              <Stack.Screen name="Balances" component={BalancesScreen} />
              <Stack.Screen name="Voting" component={VotingScreen} />
              <Stack.Screen name="ThreadList" component={ThreadListScreen} options={{ title: 'Messages' }} />
              <Stack.Screen name="Messaging" component={MessagingScreen} options={{ title: 'Thread' }} />
              <Stack.Screen name="OrgList" component={OrgListScreen} options={{ title: 'Organizations' }} />
              <Stack.Screen name="ProposalList" component={ProposalListScreen} options={{ title: 'Proposals' }} />
              <Stack.Screen name="ProposalDetail" component={ProposalDetailScreen} options={{ title: 'Proposal' }} />
              <Stack.Screen name="CreateProposal" component={CreateProposalScreen} options={{ title: 'New Proposal' }} />
            </Stack.Navigator>
          </NavigationContainer>
        </MessagingProvider>
      </VotingProvider>
    </WalletProvider>
  );
}

// Export screens for direct usage in tests or feature modules
export { OrgListScreen, ProposalListScreen };
