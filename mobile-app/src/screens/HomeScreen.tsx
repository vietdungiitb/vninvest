import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL, WS_BASE_URL } from '../services/config';
import { colors } from '../theme/colors';

export function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>VNInvest Mobile MVP</Text>
        <Text style={styles.subtitle}>Sprint 19 foundation is ready.</Text>
        <Text style={styles.meta}>API: {API_BASE_URL}</Text>
        <Text style={styles.meta}>WS: {WS_BASE_URL}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: 8,
  },
  meta: {
    color: colors.text,
    fontSize: 13,
  },
});
