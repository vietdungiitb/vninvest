import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL, WS_BASE_URL } from '../runtimeConfig.js';
import { useLocaleStore } from '../store/localeStore';
import { colors } from '../theme/colors';

export function HomeScreen() {
  const t = useLocaleStore((state) => state.t);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('home.title')}</Text>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
        <Text style={styles.meta}>{t('home.api_label')}: {API_BASE_URL}</Text>
        <Text style={styles.meta}>{t('home.ws_label')}: {WS_BASE_URL}</Text>
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