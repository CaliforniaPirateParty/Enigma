import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ChatTabPlaceholder from '../screens/Org/__placeholders__/ChatTabPlaceholder';
import ProposalsTabPlaceholder from '../screens/Org/__placeholders__/ProposalsTabPlaceholder';
import MembersTabPlaceholder from '../screens/Org/__placeholders__/MembersTabPlaceholder';
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
        component={ChatTabPlaceholder}
        options={{ title: 'Chat' }}
      />
      <Tab.Screen
        name="ProposalsTab"
        component={ProposalsTabPlaceholder}
        options={{ title: 'Proposals' }}
      />
      <Tab.Screen
        name="MembersTab"
        component={MembersTabPlaceholder}
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
