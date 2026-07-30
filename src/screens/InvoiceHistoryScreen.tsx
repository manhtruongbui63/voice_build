import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Invoice } from '../types';
import { getInvoicesFromDB } from '../services/db';
import { generateExcelReport } from '../services/excelService';
import { colors } from '../theme/tokens';

export const InvoiceHistoryScreen: React.FC = () => {
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [exporting, setExporting] = useState(false);

  const loadData = () => {
    setInvoices(getInvoicesFromDB(range));
  };

  useEffect(() => {
    loadData();
  }, [range]);

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.final_amount, 0);
  const totalKg = invoices.reduce((sum, inv) => sum + inv.total_quantity, 0);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await generateExcelReport(invoices, range.toUpperCase());
    } catch (err) {
      console.error('Failed to export Excel:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabFilter}>
        {(['today', 'week', 'month', 'all'] as const).map((r) => (
          <TouchableOpacity key={r} style={[styles.tab, range === r && styles.activeTab]} onPress={() => setRange(r)}>
            <Text style={[styles.tabText, range === r && styles.activeTabText]}>
              {r === 'today' ? 'Hôm Nay' : r === 'week' ? 'Tuần Này' : r === 'month' ? 'Tháng Này' : 'Tất Cả'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statsCard}>
        <View>
          <Text style={styles.statLabel}>Doanh Thu</Text>
          <Text style={styles.statValue}>{totalRevenue.toLocaleString('vi-VN')} đ</Text>
        </View>
        <View>
          <Text style={styles.statLabel}>Tổng Kg Bán</Text>
          <Text style={styles.statValue}>{totalKg} kg</Text>
        </View>
        <TouchableOpacity style={styles.excelBtn} onPress={handleExportExcel} disabled={exporting}>
          {exporting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.excelBtnText}>📊 Xuất Excel</Text>}
        </TouchableOpacity>
      </View>

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id!.toString()}
        renderItem={({ item }) => (
          <View style={styles.invoiceCard}>
            <View style={styles.invHeader}>
              <Text style={styles.invCode}>{item.invoice_code}</Text>
              <Text style={styles.invDate}>{item.created_at}</Text>
            </View>
            <Text style={styles.custText}>Khách hàng: {item.customer_name || 'Khách lẻ'}</Text>
            {item.items.map((it, idx) => (
              <Text key={idx} style={styles.itemRow}>
                • {it.product_name}: {it.quantity} {it.unit} x {it.unit_price.toLocaleString('vi-VN')} đ = {it.amount.toLocaleString('vi-VN')} đ
              </Text>
            ))}
            <Text style={styles.totalText}>Thực thu: {item.final_amount.toLocaleString('vi-VN')} đ</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral50, padding: 16 },
  tabFilter: { flexDirection: 'row', backgroundColor: colors.neutral200, borderRadius: 8, padding: 2, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  activeTab: { backgroundColor: colors.white },
  tabText: { fontSize: 13, color: colors.neutral600, fontWeight: '600' },
  activeTabText: { color: colors.primary },
  statsCard: { backgroundColor: colors.primaryContainer, padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statLabel: { color: colors.primarySoft, fontSize: 12 },
  statValue: { color: colors.white, fontSize: 18, fontWeight: 'bold' },
  excelBtn: { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  excelBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 13 },
  invoiceCard: { backgroundColor: colors.white, padding: 14, borderRadius: 10, marginBottom: 10, elevation: 1 },
  invHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  invCode: { fontWeight: 'bold', fontSize: 15, color: colors.neutral900 },
  invDate: { fontSize: 12, color: colors.neutral400 },
  custText: { fontSize: 13, color: colors.neutral600, marginBottom: 6 },
  itemRow: { fontSize: 13, color: colors.neutral700, marginVertical: 1 },
  totalText: { fontSize: 15, fontWeight: 'bold', color: colors.primaryActive, textAlign: 'right', marginTop: 6 },
});
