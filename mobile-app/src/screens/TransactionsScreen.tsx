import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createTransaction,
  deleteTransaction,
  getSubAccounts,
  getTransactions,
  searchStocks,
  updateTransaction,
  validateStockSymbol,
} from '../services/transactionApi';
import { formatNumber as formatLocaleNumber } from '../i18n';
import { colors } from '../theme/colors';
import { useLocaleStore } from '../store/localeStore';
import type { StockSuggestion, SubAccountItem, TransactionItem, TransactionPayload, TransactionType } from '../types/transaction';

type TransactionsScreenProps = {
  onBack: () => void;
  onTransactionSaved?: () => void;
};

type FormState = {
  symbol: string;
  transaction_type: TransactionType;
  date: string;
  price: string;
  quantity: string;
  fee: string;
  notes: string;
};

const TX_TYPES: TransactionType[] = ['BUY', 'SELL', 'DIVIDEND'];

const formatNumber = (value: number | string | undefined, locale: 'vi' | 'en'): string => {
  return formatLocaleNumber(value, locale, { maximumFractionDigits: 2 });
};

const toDecimal = (raw: string): number => {
  const normalized = raw.trim().replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const todayString = (): string => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const emptyForm = (): FormState => ({
  symbol: '',
  transaction_type: 'BUY',
  date: todayString(),
  price: '',
  quantity: '',
  fee: '0',
  notes: '',
});

export function TransactionsScreen({ onBack, onTransactionSaved }: TransactionsScreenProps) {
  const t = useLocaleStore((s) => s.t);
  const locale = useLocaleStore((s) => s.locale);
  const [subAccounts, setSubAccounts] = useState<SubAccountItem[]>([]);
  const [activeSubAccountId, setActiveSubAccountId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSubAccount = useMemo(
    () => subAccounts.find((item) => item.id === activeSubAccountId) ?? null,
    [subAccounts, activeSubAccountId]
  );

  const loadTransactions = useCallback(async (subAccountId: number) => {
    const txs = await getTransactions(subAccountId);
    setTransactions(txs);
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const accounts = await getSubAccounts();
      setSubAccounts(accounts);
      if (!accounts.length) {
        setActiveSubAccountId(null);
        setTransactions([]);
        return;
      }

      const defaultId = activeSubAccountId && accounts.some((item) => item.id === activeSubAccountId)
        ? activeSubAccountId
        : accounts[0].id;

      setActiveSubAccountId(defaultId);
      await loadTransactions(defaultId);
    } catch {
      setError(useLocaleStore.getState().t('transactions.error_load'));
    } finally {
      setLoading(false);
    }
  }, [activeSubAccountId, loadTransactions]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const onPickSubAccount = async (subAccountId: number) => {
    setActiveSubAccountId(subAccountId);
    setError('');
    setLoading(true);
    try {
      await loadTransactions(subAccountId);
    } catch {
      setError(t('transactions.error_load_subaccount'));
    } finally {
      setLoading(false);
    }
  };

  // Debounced symbol autocomplete
  useEffect(() => {
    const raw = form.symbol.trim();
    if (raw.length < 1) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchStocks(raw);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [form.symbol]);

  const pickSuggestion = (item: StockSuggestion) => {
    setForm((prev) => ({ ...prev, symbol: item.symbol }));
    setSuggestions([]);
  };

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setSuggestions([]);
  };

  const onEdit = (item: TransactionItem) => {
    setEditingId(item.id);
    setForm({
      symbol: item.symbol,
      transaction_type: item.transaction_type,
      date: item.date,
      price: `${item.price ?? ''}`,
      quantity: `${item.quantity ?? ''}`,
      fee: `${item.fee ?? 0}`,
      notes: item.notes || '',
    });
    setError('');
  };

  const onSubmit = async () => {
    if (!activeSubAccountId || saving) {
      return;
    }

    setError('');

    const symbol = form.symbol.trim().toUpperCase();
    if (!symbol) {
      setError(t('transactions.error_empty_symbol'));
      return;
    }

    const isValidSymbol = await validateStockSymbol(symbol);
    if (!isValidSymbol) {
      setError(t('transactions.error_invalid_symbol'));
      return;
    }

    const payload: TransactionPayload = {
      symbol,
      transaction_type: form.transaction_type,
      date: form.date,
      price: toDecimal(form.price),
      quantity: toDecimal(form.quantity),
      fee: toDecimal(form.fee),
      notes: form.notes.trim(),
    };

    if (!payload.date || payload.price <= 0 || payload.quantity <= 0) {
      setError(t('transactions.error_invalid_fields'));
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateTransaction(editingId, payload);
      } else {
        await createTransaction(activeSubAccountId, payload);
      }
      await loadTransactions(activeSubAccountId);
      onTransactionSaved?.();
      resetForm();
    } catch {
      setError(t('transactions.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (transactionId: number) => {
    if (!activeSubAccountId || saving) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await deleteTransaction(transactionId);
      await loadTransactions(activeSubAccountId);
      onTransactionSaved?.();
      if (editingId === transactionId) {
        resetForm();
      }
    } catch {
      setError(t('transactions.error_delete'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backText}>{t('transactions.back')}</Text>
          </Pressable>
          <Text style={styles.title}>{t('transactions.title')}</Text>
          <Pressable style={styles.refreshButton} onPress={bootstrap}>
            <Text style={styles.refreshText}>{t('transactions.refresh')}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('transactions.pick_subaccount')}</Text>
          <View style={styles.chipWrap}>
            {subAccounts.map((item) => {
              const active = item.id === activeSubAccountId;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onPickSubAccount(item.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {activeSubAccount ? <Text style={styles.meta}>{t('transactions.viewing', { name: activeSubAccount.name })}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{editingId ? t('transactions.form_edit') : t('transactions.form_new')}</Text>

          <View>
            <TextInput
              style={styles.input}
              placeholder={t('transactions.symbol_placeholder')}
              placeholderTextColor={colors.muted}
              value={form.symbol}
              autoCapitalize="characters"
              onChangeText={(value) => {
                setForm((prev) => ({ ...prev, symbol: value }));
              }}
            />
            {suggestions.length > 0 ? (
              <View style={styles.suggestionBox}>
                {suggestions.map((item) => (
                  <Pressable
                    key={item.symbol}
                    style={styles.suggestionItem}
                    onPress={() => pickSuggestion(item)}
                  >
                    <Text style={styles.suggestionSymbol}>{item.symbol}</Text>
                    <Text style={styles.suggestionName} numberOfLines={1}>{item.company_name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.chipWrap}>
            {TX_TYPES.map((txType) => {
              const active = form.transaction_type === txType;
              return (
                <Pressable
                  key={txType}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setForm((prev) => ({ ...prev, transaction_type: txType }))}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{txType}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.inlineRow}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder={t('transactions.date_placeholder')}
              placeholderTextColor={colors.muted}
              value={form.date}
              autoCapitalize="none"
              onChangeText={(value) => setForm((prev) => ({ ...prev, date: value }))}
            />

            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder={t('transactions.price_placeholder')}
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={form.price}
              onChangeText={(value) => setForm((prev) => ({ ...prev, price: value }))}
            />
          </View>

          <View style={styles.inlineRow}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder={t('transactions.quantity_placeholder')}
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={form.quantity}
              onChangeText={(value) => setForm((prev) => ({ ...prev, quantity: value }))}
            />

            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder={t('transactions.fee_placeholder')}
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={form.fee}
              onChangeText={(value) => setForm((prev) => ({ ...prev, fee: value }))}
            />
          </View>

          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder={t('transactions.notes_placeholder')}
            placeholderTextColor={colors.muted}
            multiline
            value={form.notes}
            onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))}
          />

          <View style={styles.rowButtons}>
            <Pressable style={styles.primaryButton} onPress={onSubmit} disabled={saving || !activeSubAccountId}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{editingId ? t('transactions.update') : t('transactions.save_new')}</Text>}
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={resetForm} disabled={saving}>
              <Text style={styles.ghostText}>{t('transactions.reset')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('transactions.list_title')}</Text>
          {loading ? <ActivityIndicator color={colors.primary} /> : null}

          {!loading && !transactions.length ? <Text style={styles.meta}>{t('transactions.empty_list')}</Text> : null}

          {transactions.map((item) => (
            <View key={item.id} style={styles.txItem}>
              <View style={styles.txTopRow}>
                <Text style={styles.txSymbol}>{item.symbol}</Text>
                <Text style={styles.txType}>{item.transaction_type}</Text>
              </View>
              <Text style={styles.txMeta}>{t('transactions.date_label')}: {item.date}</Text>
              <Text style={styles.txMeta}>{t('transactions.price_label')}: {formatNumber(item.price, locale)} | {t('transactions.qty_label')}: {formatNumber(item.quantity, locale)} | {t('transactions.fee_label')}: {formatNumber(item.fee, locale)}</Text>
              <Text style={styles.txMeta}>{t('transactions.total_label')}: {formatNumber(item.total_value || 0, locale)}</Text>
              <View style={styles.rowButtons}>
                <Pressable style={styles.smallButton} onPress={() => onEdit(item)} disabled={saving}>
                  <Text style={styles.smallText}>{t('transactions.edit_action')}</Text>
                </Pressable>
                <Pressable style={[styles.smallButton, styles.deleteButton]} onPress={() => onDelete(item.id)} disabled={saving}>
                  <Text style={styles.smallText}>{t('transactions.delete_action')}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backText: {
    color: colors.text,
    fontWeight: '600',
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshText: {
    color: colors.muted,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: '#1b2a48',
  },
  chipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    backgroundColor: '#0f172a',
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 6,
  },
  inputHalf: {
    flex: 1,
  },
  notesInput: {
    minHeight: 56,
    textAlignVertical: 'top',
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  ghostText: {
    color: colors.muted,
    fontWeight: '600',
  },
  txItem: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    gap: 3,
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  txSymbol: {
    color: colors.text,
    fontWeight: '700',
  },
  txType: {
    color: colors.primary,
    fontWeight: '700',
  },
  txMeta: {
    color: colors.muted,
    fontSize: 11,
  },
  smallButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  deleteButton: {
    borderColor: '#ef4444',
  },
  smallText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
  },
  suggestionBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    marginTop: 2,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionSymbol: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
    minWidth: 48,
  },
  suggestionName: {
    color: colors.muted,
    fontSize: 12,
    flex: 1,
  },
});
