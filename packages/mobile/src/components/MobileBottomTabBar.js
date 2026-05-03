import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MOBILE_TAB_DEFS } from '../navigation/mobileNavigation.js';

export function MobileBottomTabBar({
  activeTab,
  onTabPress,
  translateLabel,
  tabs = MOBILE_TAB_DEFS,
  theme,
}) {
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor, borderTopColor: theme.borderTopColor }]}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabPress(tab.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.icon, { color: active ? theme.primaryColor : theme.mutedColor }]}>{tab.icon}</Text>
            <Text style={[styles.label, { color: active ? theme.primaryColor : theme.mutedColor }]}>
              {translateLabel(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 4,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  icon: {
    fontSize: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});