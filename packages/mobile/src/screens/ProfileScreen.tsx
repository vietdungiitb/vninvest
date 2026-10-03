import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LOCALE_LABELS } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { useLocaleStore } from '../store/localeStore';
import { colors } from '../theme/colors';

export function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const t = useLocaleStore((state) => state.t);
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  const nextLocale = locale === 'vi' ? 'en' : 'vi';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('profile.title')}</Text>
          <Text style={styles.subtitle}>{t('profile.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('profile.account_section')}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t('profile.username_label')}</Text>
            <Text style={styles.value}>{user?.username || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('profile.email_label')}</Text>
            <Text style={styles.value}>{user?.email || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('profile.plan_label')}</Text>
            <Text style={styles.value}>{user?.plan || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('profile.verified_label')}</Text>
            <Text style={styles.value}>{user?.email_verified ? t('profile.verified_yes') : t('profile.verified_no')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('profile.preferences_section')}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t('profile.language_label')}</Text>
            <Text style={styles.value}>{LOCALE_LABELS[locale]}</Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={() => setLocale(nextLocale)}>
            <Text style={styles.secondaryText}>{t('profile.toggle_language', { language: LOCALE_LABELS[nextLocale] })}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('profile.app_section')}</Text>
          <Text style={styles.infoText}>{t('profile.app_status')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('profile.session_section')}</Text>
          <Pressable style={styles.dangerButton} onPress={logout}>
            <Text style={styles.dangerText}>{t('profile.logout')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
  },
  value: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  infoText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  secondaryText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  dangerButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#7f1d1d',
  },
  dangerText: {
    color: '#fee2e2',
    fontSize: 12,
    fontWeight: '700',
  },
});