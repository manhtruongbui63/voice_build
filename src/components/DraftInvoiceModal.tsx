import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MatchedItem, Invoice } from '../types';
import { saveInvoiceToDB, calculateInvoiceTotals } from '../services/db';

interface Props {
  visible: boolean;
  items: MatchedItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export const DraftInvoiceModal: React.FC<Props> = ({ visible, items: initialItems, onClose, onSuccess }) => {
  const [items, setItems] = useState<MatchedItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paid, setPaid] = useState('');

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems, visible]);

  const handleUpdateItem = (index: number, key: 'quantity' | 'unit_price', value: string) => {
    const updated = [...items];
    const num = parseFloat(value) || 0;
    updated[index][key] = num;
    updated[index].amount = updated[index].quantity * updated[index].unit_price;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  const totals = calculateInvoiceTotals(items, parseFloat(discount) || 0, parseFloat(paid) || undefined);

  const handleSave = () => {
    if (items.length === 0) {
      Alert.alert('Lỗi', 'Hóa đơn không có sản phẩm nào.');
      return;
    }

    const newInvoice: Invoice = {
      invoice_code: `HD-${Date.now().toString().slice(-6)}`,
      customer_name: customerName,
      total_quantity: totals.total_quantity,
      subtotal_amount: totals.subtotal_amount,
      discount_amount: totals.discount_amount,
      final_amount: totals.final_amount,
      paid_amount: totals.paid_amount,
      change_amount: totals.change_amount,
      items: items.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        amount: it.amount,
      })),
    };

    saveInvoiceToDB(newInvoice);
    Alert.alert('Thành công', 'Hóa đơn đã được lưu vào SQLite!');
    onSuccess();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <Text style={styles.headerTitle}>HÓA ĐƠN NHÁP</Text>

        <TextInput
          style={styles.customerInput}
          placeholder="Tên / Ghi chú khách hàng (tùy chọn)"
          value={customerName}
          onChangeText={setCustomerName}
        />

        <ScrollView style={{ flex: 1 }}>
          {items.map((item, index) => {
            const isLowConfidence = item.confidence < 0.8;
            return (
              <View key={index} style={[styles.itemCard, isLowConfidence && styles.yellowWarning]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.product_name} {isLowConfidence ? '⚠️' : ''}</Text>
                  <Text style={styles.itemMeta}>Đơn giá: {item.unit_price.toLocaleString('vi-VN')} đ / {item.unit}</Text>
                </View>

                <TextInput
                  style={styles.qtyInput}
                  keyboardType="numeric"
                  value={item.quantity.toString()}
                  onChangeText={(val) => handleUpdateItem(index, 'quantity', val)}
                />

                <Text style={styles.amountText}>{item.amount.toLocaleString('vi-VN')} đ</Text>
                <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tổng thành tiền:</Text>
            <Text style={styles.summaryValue}>{totals.subtotal_amount.toLocaleString('vi-VN')} đ</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Giảm giá (VNĐ):</Text>
            <TextInput
              style={styles.calcInput}
              keyboardType="numeric"
              value={discount}
              onChangeText={setDiscount}
            />
          </View>

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { fontWeight: 'bold' }]}>Khách phải trả:</Text>
            <Text style={[styles.summaryValue, { color: '#059669', fontSize: 18 }]}>
              {totals.final_amount.toLocaleString('vi-VN')} đ
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Khách đưa:</Text>
            <TextInput
              style={styles.calcInput}
              keyboardType="numeric"
              placeholder="0"
              value={paid}
              onChangeText={setPaid}
            />
            <Text style={{ marginLeft: 10 }}>Tiền thừa: {totals.change_amount.toLocaleString('vi-VN')} đ</Text>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
              <Text style={styles.btnText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.confirmBtn]} onPress={handleSave}>
              <Text style={[styles.btnText, { color: '#FFF' }]}>Xác nhận & Lưu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 16, paddingTop: 40 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  customerInput: { borderBottomWidth: 1, borderColor: '#CCC', padding: 8, marginBottom: 15, fontSize: 15 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, marginBottom: 8 },
  yellowWarning: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' },
  itemName: { fontSize: 16, fontWeight: 'bold' },
  itemMeta: { fontSize: 13, color: '#6B7280' },
  qtyInput: { borderWidth: 1, borderColor: '#D1D5DB', width: 50, padding: 4, textAlign: 'center', borderRadius: 4, marginHorizontal: 8 },
  amountText: { fontSize: 15, fontWeight: '600', color: '#111827', width: 90, textAlign: 'right' },
  removeBtn: { fontSize: 18, color: '#EF4444', marginLeft: 10, padding: 4 },
  footer: { borderTopWidth: 1, borderColor: '#E5E7EB', paddingTop: 12, marginTop: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryLabel: { fontSize: 15, color: '#374151' },
  summaryValue: { fontSize: 16, fontWeight: '600' },
  calcInput: { borderWidth: 1, borderColor: '#CCC', width: 90, padding: 4, borderRadius: 4, textAlign: 'right' },
  btnRow: { flexDirection: 'row', marginTop: 10 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
  cancelBtn: { backgroundColor: '#9CA3AF' },
  confirmBtn: { backgroundColor: '#10B981' },
  btnText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
});
