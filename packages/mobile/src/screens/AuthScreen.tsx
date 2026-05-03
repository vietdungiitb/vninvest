import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DEMO_PASSWORD, DEMO_USERNAME } from '../runtimeConfig.js';
import { useAuthStore } from '../store/authStore';
import { useLocaleStore } from '../store/localeStore';
import { colors } from '../theme/colors';

type Mode = 'login' | 'register';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [localError, setLocalError] = useState('');

  const isLoading = useAuthStore((state) => state.isLoading);
  const errorMessage = useAuthStore((state) => state.errorMessage);
  const infoMessage = useAuthStore((state) => state.infoMessage);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const clearMessages = useAuthStore((state) => state.clearMessages);
  const t = useLocaleStore((s) => s.t);
  const hasDemoCredentials = useMemo(() => Boolean(DEMO_USERNAME && DEMO_PASSWORD), []);

  const submitLabel = useMemo(() => {
    return mode === 'login' ? t('auth.login') : t('auth.register');
  }, [mode, t]);

  const fillTestAccount = () => {
    if (!hasDemoCredentials) {
      return;
    }
    setUsername(DEMO_USERNAME);
    setPassword(DEMO_PASSWORD);
    setLocalError('');
    clearMessages();
  };

  const onSubmit = async () => {
    if (isLoading) {
      return;
    }

    setLocalError('');
    clearMessages();
    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedUsername || !password.trim()) {
      setLocalError(t('auth.error_empty_fields'));
      return;
    }

    if (mode === 'login') {
      if (normalizedUsername.includes('@')) {
        setLocalError(t('auth.error_use_username'));
        return;
      }
      await login(normalizedUsername, password);
      return;
    }

    const success = await register({
      username: normalizedUsername,
      email: email.trim(),
      password,
      password_confirm: passwordConfirm,
    });
    if (success) {
      setMode('login');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>VNInvest Mobile</Text>
        <Text style={styles.subtitle}>{t('auth.app_tagline')}</Text>

        <View style={styles.switchRow}>
          <Pressable
            style={[styles.switchButton, mode === 'login' && styles.switchActive]}
            onPress={() => {
              clearMessages();
              setMode('login');
            }}
          >
            <Text style={styles.switchText}>{t('auth.login')}</Text>
          </Pressable>
          <Pressable
            style={[styles.switchButton, mode === 'register' && styles.switchActive]}
            onPress={() => {
              clearMessages();
              setMode('register');
            }}
          >
            <Text style={styles.switchText}>{t('auth.register')}</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder={t('auth.username_placeholder')}
          placeholderTextColor={colors.muted}
          value={username}
          autoCapitalize="none"
          onChangeText={setUsername}
        />

        {mode === 'login' ? <Text style={styles.hint}>{t('auth.login_hint')}</Text> : null}

        {mode === 'login' && hasDemoCredentials ? (
          <Pressable style={styles.prefillButton} onPress={fillTestAccount}>
            <Text style={styles.prefillText}>{t('auth.prefill_test')}</Text>
          </Pressable>
        ) : null}

        {mode === 'register' && (
          <TextInput
            style={styles.input}
            placeholder={t('auth.email_placeholder')}
            placeholderTextColor={colors.muted}
            value={email}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder={t('auth.password_placeholder')}
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {mode === 'register' && (
          <TextInput
            style={styles.input}
            placeholder={t('auth.confirm_password_placeholder')}
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
          />
        )}

        {localError ? <Text style={styles.error}>{localError}</Text> : null}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {infoMessage ? <Text style={styles.info}>{infoMessage}</Text> : null}

        <Pressable style={styles.submitButton} onPress={onSubmit} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.submitText}>{submitLabel}</Text>}
        </Pressable>
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
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: 6,
  },
  switchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  switchButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  switchActive: {
    borderColor: colors.primary,
    backgroundColor: '#1b2a48',
  },
  switchText: {
    color: colors.text,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: '#0f172a',
  },
  error: {
    color: '#f87171',
    fontSize: 13,
  },
  info: {
    color: '#22c55e',
    fontSize: 13,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: -2,
  },
  prefillButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#172033',
  },
  prefillText: {
    color: colors.text,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
  },
});
