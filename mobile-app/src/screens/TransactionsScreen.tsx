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
import { colors } from '../theme/colors';
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

const formatNumber = (value: number | string | undefined): string => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) {
    return '0';
  }
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(num);
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
      setError('Khong the tai du lieu giao dich. Vui long thu lai.');
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
      setError('Khong the tai giao dich cua tieu khoan nay.');
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
      setError('Vui long nhap ma co phieu.');
      return;
    }

    const isValidSymbol = await validateStockSymbol(symbol);
    if (!isValidSymbol) {
      setError('Ma co phieu khong hop le trong he thong.');
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
      setError('Ngay, gia va khoi luong phai hop le (> 0).');
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
      setError('Khong the luu giao dich. Vui long thu lai.');
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
      setError('Khong the xoa giao dich.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backText}>Quay lai</Text>
          </Pressable>
          <Text style={styles.title}>Transactions</Text>
          <Pressable style={styles.refreshButton} onPress={bootstrap}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Chon tieu khoan</Text>
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
          {activeSubAccount ? <Text style={styles.meta}>Dang xem: {activeSubAccount.name}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{editingId ? 'Sua giao dich' : 'Tao giao dich moi'}</Text>

          <View>
            <TextInput
              style={styles.input}
              placeholder="Symbol (VD: HPG)"
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

          <TextInput
            style={styles.input}
            placeholder="Date (YYYY-MM-DD)"
            placeholderTextColor={colors.muted}
            value={form.date}
            autoCapitalize="none"
            onChangeText={(value) => setForm((prev) => ({ ...prev, date: value }))}
          />

          <TextInput
            style={styles.input}
            placeholder="Price"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            value={form.price}
            onChangeText={(value) => setForm((prev) => ({ ...prev, price: value }))}
          />

          <TextInput
            style={styles.input}
            placeholder="Quantity"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            value={form.quantity}
            onChangeText={(value) => setForm((prev) => ({ ...prev, quantity: value }))}
          />

          <TextInput
            style={styles.input}
            placeholder="Fee"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            value={form.fee}
            onChangeText={(value) => setForm((prev) => ({ ...prev, fee: value }))}
          />

          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Notes"
            placeholderTextColor={colors.muted}
            multiline
            value={form.notes}
            onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))}
          />

          <View style={styles.rowButtons}>
            <Pressable style={styles.primaryButton} onPress={onSubmit} disabled={saving || !activeSubAccountId}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{editingId ? 'Cap nhat' : 'Luu moi'}</Text>}
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={resetForm} disabled={saving}>
              <Text style={styles.ghostText}>Reset</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Danh sach giao dich</Text>
          {loading ? <ActivityIndicator color={colors.primary} /> : null}

          {!loading && !transactions.length ? <Text style={styles.meta}>Chua co giao dich.</Text> : null}

          {transactions.map((item) => (
            <View key={item.id} style={styles.txItem}>
              <View style={styles.txTopRow}>
                <Text style={styles.txSymbol}>{item.symbol}</Text>
                <Text style={styles.txType}>{item.transaction_type}</Text>
              </View>
              <Text style={styles.txMeta}>Ngay: {item.date}</Text>
              <Text style={styles.txMeta}>Gia: {formatNumber(item.price)} | SL: {formatNumber(item.quantity)} | Phi: {formatNumber(item.fee)}</Text>
              <Text style={styles.txMeta}>Tong: {formatNumber(item.total_value || 0)}</Text>
              <View style={styles.rowButtons}>
                <Pressable style={styles.smallButton} onPress={() => onEdit(item)} disabled={saving}>
                  <Text style={styles.smallText}>Sua</Text>
                </Pressable>
                <Pressable style={[styles.smallButton, styles.deleteButton]} onPress={() => onDelete(item.id)} disabled={saving}>
                  <Text style={styles.smallText}>Xoa</Text>
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
    padding: 16,
    gap: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backText: {
    color: colors.text,
    fontWeight: '600',
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshText: {
    color: colors.muted,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: '#0f172a',
  },
  notesInput: {
    minHeight: 76,
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
    paddingVertical: 11,
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
    paddingTop: 10,
    gap: 4,
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
    fontSize: 12,
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
