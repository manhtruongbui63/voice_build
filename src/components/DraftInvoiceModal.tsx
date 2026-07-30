import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MatchedItem, Invoice, PaymentMethod } from '../types';
import { saveInvoiceToDB, calculateInvoiceTotals } from '../services/db';
import { colors, typography, fontFamily } from '../theme/tokens';

interface Props {
  visible: boolean;
  items: MatchedItem[];
  paymentMethod: PaymentMethod;
  onClose: () => void;
  onSuccess: () => void;
}

const formatVnd = (value: number) => `${Math.round(value).toLocaleString('vi-VN')}đ`;

export const DraftInvoiceModal: React.FC<Props> = ({
  visible,
  items: initialItems,
  paymentMethod: initialPaymentMethod,
  onClose,
  onSuccess,
}) => {
  const [items, setItems] = useState<MatchedItem[]>([]);
  const [customerName] = useState('');
  const [discount] = useState('0');
  const [paid, setPaid] = useState('');
  const [localPaymentMethod, setLocalPaymentMethod] = useState<PaymentMethod>(initialPaymentMethod || 'chuyển khoản');
  const [invoiceCode, setInvoiceCode] = useState('VOICE-0000');
  const [bannerVisible, setBannerVisible] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setItems(initialItems);
    setLocalPaymentMethod(initialPaymentMethod || 'chuyển khoản');
    setPaid('');
    setInvoiceCode(`VOICE-${String(Date.now()).slice(-4)}`);
  }, [initialItems, initialPaymentMethod, visible]);

  // Toast "đã xử lý": trượt vào từ phải, tự đóng sau 3s
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeToast = () => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    Animated.timing(toastAnim, { toValue: 0, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(
      () => setBannerVisible(false)
    );
  };

  useEffect(() => {
    if (!visible) return;
    setBannerVisible(true);
    toastAnim.setValue(0);
    Animated.timing(toastAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(
        () => setBannerVisible(false)
      );
    }, 3000);
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
        toastTimer.current = null;
      }
    };
  }, [visible, toastAnim]);

  // Hiệu ứng ping trên banner "đã xử lý"
  const ping = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible || !bannerVisible) return;
    const loop = Animated.loop(
      Animated.timing(ping, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [visible, bannerVisible, ping]);

  const handleQtyDelta = (index: number, delta: number) => {
    const updated = [...items];
    const quantity = Math.max(1, (updated[index].quantity || 0) + delta);
    updated[index] = { ...updated[index], quantity, amount: quantity * updated[index].unit_price };
    setItems(updated);
  };

  const totals = calculateInvoiceTotals(items, parseFloat(discount) || 0, parseFloat(paid) || undefined);
  const isCash = localPaymentMethod === 'tiền mặt';

  const handleSave = () => {
    if (items.length === 0) {
      Alert.alert('Lỗi', 'Hóa đơn không có sản phẩm nào.');
      return;
    }

    const newInvoice: Invoice = {
      invoice_code: invoiceCode,
      customer_name: customerName,
      total_quantity: totals.total_quantity,
      subtotal_amount: totals.subtotal_amount,
      discount_amount: totals.discount_amount,
      final_amount: totals.final_amount,
      paid_amount: totals.paid_amount,
      change_amount: totals.change_amount,
      payment_method: localPaymentMethod,
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

  const renderStepper = (index: number, quantity: number, warning: boolean) => (
    <View style={[styles.stepper, warning && styles.stepperWarning]}>
      <TouchableOpacity style={styles.stepBtn} onPress={() => handleQtyDelta(index, -1)}>
        <MaterialIcons name="remove" size={18} color={warning ? colors.onSurfaceVariant : colors.primaryContainer} />
      </TouchableOpacity>
      <Text style={styles.stepQty}>{quantity}</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={() => handleQtyDelta(index, 1)}>
        <MaterialIcons name="add" size={18} color={warning ? colors.onSurfaceVariant : colors.primaryContainer} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <MaterialIcons name="arrow-back-ios" size={18} color={colors.white} />
            <Text style={styles.backText}>Quay lại</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.headerLabel}>ĐƠN HÀNG TẠM TÍNH</Text>
            <Text style={styles.headerCode}>#{invoiceCode}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Payment section card */}
          <View style={styles.card}>
            {/* Item list */}
            <View style={{ gap: 12 }}>
              {items.map((item, index) => {
                const warning = item.confidence < 0.8;
                return (
                  <View key={index} style={[styles.itemCard, warning && styles.itemCardWarning]}>
                    {warning ? <View style={styles.warnBar} /> : null}
                    <View style={{ flex: 1 }}>
                      <View style={styles.itemNameRow}>
                        <Text style={styles.itemName}>{item.product_name}</Text>
                        {warning ? <MaterialIcons name="warning" size={16} color={colors.warningAmber} /> : null}
                      </View>
                      <Text style={styles.itemMeta}>
                        {warning ? 'Vui lòng xác nhận loại' : `${formatVnd(item.unit_price)} / ${item.unit}`}
                      </Text>
                    </View>
                    {renderStepper(index, item.quantity, warning)}
                  </View>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* Payment method toggle */}
            <View style={styles.toggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, isCash && styles.toggleBtnActive]}
                onPress={() => setLocalPaymentMethod('tiền mặt')}
              >
                <Text style={[styles.toggleText, isCash && styles.toggleTextActive]}>Tiền mặt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, !isCash && styles.toggleBtnActive]}
                onPress={() => setLocalPaymentMethod('chuyển khoản')}
              >
                <Text style={[styles.toggleText, !isCash && styles.toggleTextActive]}>Chuyển khoản</Text>
              </TouchableOpacity>
            </View>

            {/* Cash details */}
            {isCash ? (
              <View style={{ gap: 16 }}>
                <View style={{ gap: 8 }}>
                  <Text style={styles.fieldLabel}>KHÁCH ĐƯA</Text>
                  <View style={styles.cashInputWrap}>
                    <TextInput
                      style={styles.cashInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      value={paid}
                      onChangeText={setPaid}
                    />
                    <Text style={styles.cashSuffix}>VNĐ</Text>
                  </View>
                </View>
                <View style={styles.changeRow}>
                  <Text style={styles.changeLabel}>Tiền thừa trả khách</Text>
                  <Text style={styles.changeValue}>{formatVnd(totals.change_amount)}</Text>
                </View>
              </View>
            ) : null}

            {/* Totals */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tổng thanh toán</Text>
              <Text style={styles.totalValue}>{formatVnd(totals.final_amount)}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Toast "đã xử lý" — trượt vào từ phải, tự đóng sau 3s */}
        {bannerVisible ? (
          <Animated.View
            style={[
              styles.toast,
              {
                opacity: toastAnim,
                transform: [{ translateX: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }],
              },
            ]}
          >
            <View style={styles.bannerLeft}>
              <View style={styles.checkWrap}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.ping,
                    {
                      opacity: ping.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] }),
                      transform: [{ scale: ping.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
                    },
                  ]}
                />
                <MaterialIcons name="check-circle" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.bannerTitle}>Giọng nói đã được xử lý</Text>
                <Text style={styles.bannerSubtitle}>Tìm thấy {items.length} sản phẩm trong yêu cầu</Text>
              </View>
            </View>
            <TouchableOpacity onPress={closeToast}>
              <MaterialIcons name="close" size={20} color={colors.onPrimaryContainer} />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {/* Action button */}
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleSave} activeOpacity={0.9}>
            <MaterialIcons name="print" size={22} color={colors.white} />
            <Text style={styles.actionText}>Xác nhận & In hóa đơn</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slateBg },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryContainer,
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { ...typography.bodyMd, color: colors.white },
  headerLabel: { ...typography.labelSm, color: colors.white, opacity: 0.8, letterSpacing: 1, textTransform: 'uppercase' },
  headerCode: { ...typography.headlineMd, color: colors.white },
  // Scroll
  scroll: { paddingBottom: 24 },
  // Toast
  toast: {
    position: 'absolute',
    top: 118,
    left: 16,
    right: 16,
    zIndex: 100,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryContainerBorder,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  checkWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  ping: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: colors.mint },
  bannerTitle: { ...typography.labelMd, color: colors.onPrimaryContainer },
  bannerSubtitle: { ...typography.bodySm, color: colors.onPrimaryContainer, opacity: 0.8 },
  // Card
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
  },
  // Item
  itemCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  itemCardWarning: { backgroundColor: colors.warningSurface },
  warnBar: { position: 'absolute', top: 0, left: 0, width: 4, height: '100%', backgroundColor: colors.warningAmber },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemName: { ...typography.labelMd, color: colors.onSurface },
  itemMeta: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  // Stepper
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.slateBg, borderRadius: 9999, padding: 4 },
  stepperWarning: { backgroundColor: 'rgba(255, 255, 255, 0.6)' },
  stepBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepQty: { ...typography.labelMd, color: colors.onSurface, minWidth: 20, textAlign: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant },
  // Toggle
  toggle: { flexDirection: 'row', backgroundColor: colors.surfaceContainer, borderRadius: 8, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  toggleBtnActive: {
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: { ...typography.labelMd, color: colors.onSurfaceVariant },
  toggleTextActive: { color: colors.white },
  // Cash details
  fieldLabel: { ...typography.labelSm, color: colors.textSecondary, textTransform: 'uppercase' },
  cashInputWrap: { position: 'relative', justifyContent: 'center' },
  cashInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 20,
    color: colors.primary,
  },
  cashSuffix: { position: 'absolute', right: 16, ...typography.labelMd, color: colors.textSecondary },
  changeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  changeLabel: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  changeValue: { ...typography.headlineMd, color: colors.primaryActive },
  // Totals
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  totalLabel: { ...typography.labelMd, color: colors.onSurface },
  totalValue: { ...typography.headlineLgMobile, color: colors.onSurface },
  // Action
  actionBar: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.slateBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariantSoft,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  actionText: { ...typography.labelMd, fontSize: 18, color: colors.white },
});
