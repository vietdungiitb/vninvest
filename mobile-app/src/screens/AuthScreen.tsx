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
import { DEMO_PASSWORD, DEMO_USERNAME } from '../services/config';
import { useAuthStore } from '../store/authStore';
import { useLocaleStore } from '../store/localeStore';
import { colors } from '../theme/colors';
export { AuthScreen } from '../../../packages/mobile/src/screens/AuthScreen';
type Mode = 'login' | 'register';
