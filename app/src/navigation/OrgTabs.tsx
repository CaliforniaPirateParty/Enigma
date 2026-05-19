import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import OrgChatScreen from '../screens/Org/OrgChatScreen';
import OrgProposalsScreen from '../screens/Org/OrgProposalsScreen';
import OrgMembersScreen from '../screens/Org/OrgMembersScreen';
import OrgInfoScreen from '../screens/Org/OrgInfoScreen';

export type OrgTabsParamList = {
  ChatTab: undefined;
  ProposalsTab: undefined;
  MembersTab: undefined;
  InfoTab: undefined;
};

const Tab = createBottomTabNavigator<OrgTabsParamList>();

export function OrgTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="ChatTab"
        component={OrgChatScreen}
        options={{ title: 'Chat' }}
      />
      <Tab.Screen
        name="ProposalsTab"
        component={OrgProposalsScreen}
        options={{ title: 'Proposals' }}
      />
      <Tab.Screen
        name="MembersTab"
        component={OrgMembersScreen}
        options={{ title: 'Members' }}
      />
      <Tab.Screen
        name="InfoTab"
        component={OrgInfoScreen}
        options={{ title: 'Info' }}
      />
    </Tab.Navigator>
  );
}
