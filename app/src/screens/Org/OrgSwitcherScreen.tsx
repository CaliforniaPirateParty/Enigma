import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUserOrgs } from '../../hooks/useOrgs';
import { useWallet } from '../../context/WalletContext';
import { useOrgStore } from '../../state/orgStore';
import { OrgTabs } from '../../navigation/OrgTabs';
import { Org } from '../../types/subgraph';
import type { RootStackParamList } from '../../../App';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function OrgSwitcherScreen() {
  const navigation = useNavigation<NavProp>();
  const { state } = useWallet();
  const walletAddress = state.identity?.address;

  const { data: userOrgs } = useUserOrgs(walletAddress);
  const orgs = userOrgs ?? [];

  const { activeOrgId, setActiveOrg } = useOrgStore((s) => ({
    activeOrgId: s.activeOrgId,
    setActiveOrg: s.setActiveOrg,
  }));

  // Auto-select first org when none is active
  useEffect(() => {
    if (!activeOrgId && orgs.length > 0) {
      setActiveOrg(orgs[0].id);
    }
  }, [activeOrgId, orgs, setActiveOrg]);

  const renderRailItem = ({ item }: { item: Org }) => {
    const isSelected = item.id.toLowerCase() === activeOrgId;
    return (
      <Pressable
        testID={`org-rail-${item.id}-${isSelected ? 'on' : 'off'}`}
        style={[styles.railItem, isSelected && styles.railItemSelected]}
        onPress={() => setActiveOrg(item.id)}
      >
        <Text style={styles.railItemText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Left rail */}
      <View style={styles.rail}>
        {/* + button to open directory */}
        <Pressable
          testID="open-directory-btn"
          style={styles.railActionBtn}
          onPress={() => navigation.navigate('OrgDirectory')}
        >
          <Text style={styles.railActionText}>+</Text>
        </Pressable>

        {orgs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              You haven't joined any orgs yet.
            </Text>
            <Text
              style={styles.emptyLink}
              onPress={() => navigation.navigate('OrgDirectory')}
            >
              Open the directory →
            </Text>
          </View>
        ) : (
          <FlatList
            data={orgs}
            keyExtractor={(item) => item.id}
            renderItem={renderRailItem}
            style={styles.railList}
          />
        )}

        {/* Gear button to recovery */}
        <Pressable
          testID="open-recovery-btn"
          style={styles.railActionBtn}
          onPress={() => navigation.navigate('RecoveryHome')}
        >
          <Text style={styles.railActionText}>&#9881;</Text>
        </Pressable>
      </View>

      {/* Main content area — per-org tabs */}
      <View style={styles.main}>
        {activeOrgId ? (
          <OrgTabs />
        ) : (
          <View style={styles.noOrgSelected}>
            <Text style={styles.noOrgText}>Select an org from the rail</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f5f5f5' },
  rail: {
    width: 64,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    paddingVertical: 8,
  },
  railList: { flex: 1 },
  railItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  railItemSelected: {
    borderColor: 'tomato',
    borderWidth: 2,
  },
  railItemText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  railActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  railActionText: {
    color: '#fff',
    fontSize: 20,
  },
  main: { flex: 1 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  emptyText: {
    color: '#ccc',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyLink: {
    color: '#6ec1e4',
    fontSize: 11,
    textAlign: 'center',
  },
  noOrgSelected: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noOrgText: { color: '#999', fontSize: 14 },
});
