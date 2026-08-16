import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Invoice, MatchedItem, PaymentMethod } from '../types';
import { calculateInvoiceTotals, saveInvoiceToDB } from '../services/db';
import { colors, fontFamily } from '../theme/tokens';
import { formatHoChiMinhInvoiceTime } from '../utils/hoChiMinhTime';

interface Props {
  visible: boolean;
  items: MatchedItem[];
  paymentMethod: PaymentMethod;
  onClose: () => void;
  onSuccess: () => void;
}

interface SavedInvoiceSummary {
  invoiceCode: string;
  savedAt: Date;
  totalQuantity: number;
  finalAmount: number;
  paymentMethod: PaymentMethod;
}

const formatVnd = (value: number) => `${Math.round(value).toLocaleString('vi-VN')}đ`;
const formatDisplayVnd = (value: number) => `${Math.round(value).toLocaleString('vi-VN')} đ`;
const formatInputVnd = (value: string) => (value ? Number(value).toLocaleString('vi-VN') : '');
const parseMoneyInput = (value: string) => value.replace(/\D/g, '');
const formatSavedAt = (value: Date) => formatHoChiMinhInvoiceTime(value);
const RETURN_DELAY_MS = 5000;

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
  const [localPaymentMethod, setLocalPaymentMethod] = useState<PaymentMethod>(
    initialPaymentMethod || 'chuyển khoản'
  );
  const [invoiceCode, setInvoiceCode] = useState('VOICE-0000');
  const [savedInvoice, setSavedInvoice] = useState<SavedInvoiceSummary | null>(null);
  const countdownProgress = useRef(new Animated.Value(1)).current;
  const returnedRef = useRef(false);

  const handleCreateNewInvoice = useCallback(() => {
    if (returnedRef.current) return;
    returnedRef.current = true;
    onSuccess();
    onClose();
  }, [onClose, onSuccess]);

  useEffect(() => {
    if (!visible) return;
    setItems(initialItems);
    setLocalPaymentMethod(initialPaymentMethod || 'chuyển khoản');
    setPaid('');
    setInvoiceCode(`VOICE-${String(Date.now()).slice(-4)}`);
    setSavedInvoice(null);
    countdownProgress.setValue(1);
    returnedRef.current = false;
  }, [countdownProgress, initialItems, initialPaymentMethod, visible]);

  useEffect(() => {
    if (!savedInvoice || !visible) return;
    countdownProgress.setValue(1);
    const animation = Animated.timing(countdownProgress, {
      toValue: 0,
      duration: RETURN_DELAY_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();
    const timer = setTimeout(handleCreateNewInvoice, RETURN_DELAY_MS);
    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [countdownProgress, handleCreateNewInvoice, savedInvoice, visible]);

  const handleQtyDelta = (index: number, delta: number) => {
    setItems((current) => {
      const updated = [...current];
      const quantity = Math.max(1, (updated[index].quantity || 0) + delta);
      updated[index] = { ...updated[index], quantity, amount: quantity * updated[index].unit_price };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const totals = calculateInvoiceTotals(
    items,
    parseFloat(discount) || 0,
    paid ? parseFloat(paid) : undefined
  );
  const isCash = localPaymentMethod === 'tiền mặt';
  const hasNoItems = items.length === 0;

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
      items: items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        amount: item.amount,
      })),
    };

    saveInvoiceToDB(newInvoice);
    setSavedInvoice({
      invoiceCode,
      savedAt: new Date(),
      totalQuantity: totals.total_quantity,
      finalAmount: totals.final_amount,
      paymentMethod: localPaymentMethod,
    });
  };

  const renderStepper = (index: number, quantity: number) => (
    <View style={styles.stepper}>
      <TouchableOpacity style={[styles.stepBtn, styles.stepBtnMuted]} onPress={() => handleQtyDelta(index, -1)}>
        <MaterialIcons name="remove" size={14} color={colors.primary} />
      </TouchableOpacity>
      <Text style={styles.stepQty}>{quantity}</Text>
      <TouchableOpacity style={[styles.stepBtn, styles.stepBtnActive]} onPress={() => handleQtyDelta(index, 1)}>
        <MaterialIcons name="add" size={14} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  if (savedInvoice) {
    const isTransfer = savedInvoice.paymentMethod === 'chuyển khoản';
    const countdownWidth = countdownProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleCreateNewInvoice}>
        <View style={styles.successContainer}>
          <SafeAreaView testID="invoice-success-header-safe" style={styles.successHeaderSafe}>
            <View style={styles.successHeader}>
              <TouchableOpacity style={styles.headerIconBtn} onPress={handleCreateNewInvoice}>
                <MaterialIcons name="arrow-back" size={24} color={colors.white} />
              </TouchableOpacity>
              <Text style={styles.successHeaderTitle}>Chi Tiết Hóa Đơn</Text>
            </View>
          </SafeAreaView>

          <View style={styles.successMain}>
            <View style={styles.successHero}>
              <View style={styles.successIconHalo}>
                <View style={styles.successPing} />
                <MaterialIcons name="check-circle" size={72} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Lưu hóa đơn thành công</Text>
              <Text style={styles.successSubtitle}>
                Hóa đơn đã được lưu vào hệ thống an toàn và chờ xử lý.
              </Text>
            </View>

            <View style={styles.successCard}>
              <View style={styles.successGlowTop} />
              <View style={styles.successGlowBottom} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Mã hóa đơn</Text>
                <Text style={styles.detailCode}>{savedInvoice.invoiceCode}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Thời gian</Text>
                <Text style={styles.detailValue}>{formatSavedAt(savedInvoice.savedAt)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Số lượng</Text>
                <Text style={styles.detailValue}>{savedInvoice.totalQuantity} sản phẩm</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tổng tiền</Text>
                <Text style={styles.detailTotal}>{formatDisplayVnd(savedInvoice.finalAmount)}</Text>
              </View>
              <View style={[styles.detailRow, styles.detailRowLast]}>
                <Text style={styles.detailLabel}>Thanh toán</Text>
                <View style={styles.paymentBadge}>
                  <MaterialIcons
                    name={isTransfer ? 'account-balance' : 'payments'}
                    size={14}
                    color="#4F5D85"
                  />
                  <Text style={styles.paymentBadgeText}>
                    {isTransfer ? 'Chuyển khoản' : 'Tiền mặt'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.countdownTrack}>
              <Animated.View
                testID="success-countdown-fill"
                style={[styles.countdownFill, { width: countdownWidth }]}
              />
            </View>

            <TouchableOpacity style={styles.newInvoiceBtn} onPress={handleCreateNewInvoice} activeOpacity={0.9}>
              <MaterialIcons name="add" size={22} color={colors.white} />
              <Text style={styles.newInvoiceText}>Tạo hóa đơn mới</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <SafeAreaView testID="draft-confirmation-header-safe" style={styles.headerSafe}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={onClose}>
              <MaterialIcons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Xác nhận bill</Text>
            <MaterialIcons name="receipt-long" size={24} color={colors.white} />
          </View>
        </SafeAreaView>

        <ScrollView
          testID="draft-confirmation-scroll"
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CHI TIẾT ĐƠN HÀNG</Text>
            <View style={styles.aiBadge}>
              <MaterialIcons name="keyboard-voice" size={14} color={colors.onSurfaceVariant} />
              <Text style={styles.aiBadgeText}>AI nhận diện</Text>
            </View>
          </View>

          <View style={styles.itemList}>
            {hasNoItems ? (
              <View testID="draft-empty-state" style={styles.emptyState}>
                <MaterialIcons name="receipt-long" size={28} color={colors.onSurfaceVariant} />
                <Text style={styles.emptyTitle}>Chưa có sản phẩm nào trong bill.</Text>
                <Text style={styles.emptySubtitle}>
                  Hãy quay lại bước bán hàng để thêm sản phẩm trước khi lưu.
                </Text>
              </View>
            ) : (
              items.map((item, index) => {
                const warning = item.confidence < 0.8;
                return (
                  <View
                    key={`${item.product_id}-${index}`}
                    testID="draft-line-item"
                    style={[styles.itemCard, warning && styles.itemCardWarning]}
                  >
                    <TouchableOpacity
                      testID="draft-remove-item"
                      style={styles.removeBtn}
                      onPress={() => handleRemoveItem(index)}
                      activeOpacity={0.85}
                    >
                      <MaterialIcons name="close" size={16} color={colors.white} />
                    </TouchableOpacity>

                    <View style={styles.itemTopRow}>
                      <View style={styles.itemTitleWrap}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.product_name}
                        </Text>
                        {warning ? (
                          <View style={styles.warningPill}>
                            <MaterialIcons name="warning" size={12} color={colors.warningAmber} />
                            <Text style={styles.warningText}>Cần kiểm tra</Text>
                          </View>
                        ) : null}
                      </View>
                      {renderStepper(index, item.quantity)}
                    </View>

                    <View style={styles.itemBottomRow}>
                      <Text style={styles.itemMeta}>{formatVnd(item.unit_price)} / {item.unit}</Text>
                      <Text style={styles.itemTotal}>{formatVnd(item.quantity * item.unit_price)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.paymentToggle}>
            <TouchableOpacity
              style={[styles.paymentBtn, isCash && styles.paymentBtnActive]}
              onPress={() => setLocalPaymentMethod('tiền mặt')}
              activeOpacity={0.9}
            >
              <MaterialIcons name="payments" size={18} color={isCash ? colors.white : colors.onSurfaceVariant} />
              <Text style={[styles.paymentText, isCash && styles.paymentTextActive]}>Tiền mặt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.paymentBtn, !isCash && styles.paymentBtnActive]}
              onPress={() => setLocalPaymentMethod('chuyển khoản')}
              activeOpacity={0.9}
            >
              <MaterialIcons name="account-balance" size={18} color={!isCash ? colors.white : colors.onSurfaceVariant} />
              <Text style={[styles.paymentText, !isCash && styles.paymentTextActive]}>Chuyển khoản</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryLines}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tạm tính ({totals.total_quantity} món)</Text>
                <Text style={styles.summaryValue}>{formatVnd(totals.subtotal_amount)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.promoLabelWrap}>
                  <Text style={styles.promoLabel}>Khuyến mãi</Text>
                  <MaterialIcons name="confirmation-number" size={16} color={colors.tertiary} />
                </View>
                <Text style={styles.promoValue}>
                  {totals.discount_amount > 0 ? `-${formatVnd(totals.discount_amount)}` : '0đ'}
                </Text>
              </View>
            </View>

            <View style={styles.dashedDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tổng cộng</Text>
              <Text style={styles.totalValue}>{formatVnd(totals.final_amount)}</Text>
            </View>

            {isCash ? (
              <View style={styles.cashPanel}>
                <View style={styles.cashInputRow}>
                  <Text style={styles.cashLabel}>Khách đưa</Text>
                  <View style={styles.cashInputBox}>
                    <TextInput
                      style={styles.cashInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.onSurfaceVariant}
                      value={formatInputVnd(paid)}
                      onChangeText={(value) => setPaid(parseMoneyInput(value))}
                    />
                    <Text style={styles.cashSuffix}>đ</Text>
                  </View>
                </View>
                <View style={styles.changeRow}>
                  <Text style={styles.changeLabel}>Tiền thừa</Text>
                  <Text style={styles.changeValue}>{formatVnd(totals.change_amount)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View testID="draft-confirmation-action" style={styles.actionBar}>
          <TouchableOpacity
            testID="draft-save-button"
            style={[styles.actionBtn, hasNoItems && styles.actionBtnDisabled]}
            onPress={handleSave}
            disabled={hasNoItems}
            accessibilityRole="button"
            accessibilityState={{ disabled: hasNoItems }}
            activeOpacity={hasNoItems ? 1 : 0.9}
          >
            <MaterialIcons
              name="check-circle-outline"
              size={24}
              color={hasNoItems ? colors.onSurfaceVariant : colors.white}
            />
            <Text style={[styles.actionText, hasNoItems && styles.actionTextDisabled]}>
              Xác Nhận & Lưu Bill
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FAFF',
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#F6FAFF',
  },
  successHeaderSafe: {
    backgroundColor: colors.primary,
  },
  successHeader: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  successHeaderTitle: {
    flex: 1,
    fontFamily: fontFamily.jakartaBold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.white,
  },
  successMain: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 34,
    paddingBottom: 24,
  },
  successHero: {
    alignItems: 'center',
    marginBottom: 34,
  },
  successIconHalo: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(167, 243, 208, 0.5)',
  },
  successPing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(52, 211, 153, 0.22)',
  },
  successTitle: {
    fontFamily: fontFamily.jakartaBold,
    fontSize: 24,
    lineHeight: 32,
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: 14,
  },
  successSubtitle: {
    maxWidth: 280,
    fontFamily: fontFamily.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  successCard: {
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.white,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 25,
    elevation: 4,
  },
  successGlowTop: {
    position: 'absolute',
    top: -48,
    right: -48,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(218, 226, 255, 0.35)',
  },
  successGlowBottom: {
    position: 'absolute',
    bottom: -64,
    left: -64,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255, 221, 176, 0.35)',
  },
  detailRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(197, 198, 207, 0.3)',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontFamily: fontFamily.interMedium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.onSurfaceVariant,
  },
  detailValue: {
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
  },
  detailCode: {
    fontFamily: fontFamily.interBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
  },
  detailTotal: {
    fontFamily: fontFamily.jakartaBold,
    fontSize: 20,
    lineHeight: 28,
    color: '#000000',
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 93, 133, 0.1)',
  },
  paymentBadgeText: {
    fontFamily: fontFamily.interMedium,
    fontSize: 12,
    lineHeight: 16,
    color: '#4F5D85',
  },
  countdownTrack: {
    width: '100%',
    maxWidth: 360,
    height: 5,
    marginTop: 'auto',
    marginBottom: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(197, 198, 207, 0.45)',
  },
  countdownFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  newInvoiceBtn: {
    width: '100%',
    maxWidth: 360,
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  newInvoiceText: {
    fontFamily: fontFamily.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  headerSafe: {
    backgroundColor: colors.primary,
  },
  headerIconBtn: {
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.jakartaBold,
    fontSize: 18,
    lineHeight: 28,
    color: colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sectionTitle: {
    fontFamily: fontFamily.interBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    color: colors.onSurfaceVariant,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#DDEEFF',
  },
  aiBadgeText: {
    fontFamily: fontFamily.interMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
  },
  itemList: {
    gap: 16,
    marginBottom: 18,
  },
  itemCard: {
    position: 'relative',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(213, 235, 255, 0.5)',
    backgroundColor: colors.white,
  },
  itemCardWarning: {
    borderColor: colors.warningAmber,
    backgroundColor: colors.warningSurface,
  },
  emptyState: {
    minHeight: 118,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C5C6CF',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  emptyTitle: {
    marginTop: 8,
    fontFamily: fontFamily.interBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 4,
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: -12,
    right: -12,
    zIndex: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorCrimson,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 2,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemTitleWrap: {
    flex: 1,
  },
  itemName: {
    fontFamily: fontFamily.jakartaBold,
    fontSize: 18,
    lineHeight: 28,
    color: colors.primary,
  },
  warningPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  warningText: {
    fontFamily: fontFamily.interMedium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.warningAmber,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLow,
  },
  stepBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnMuted: {
    backgroundColor: colors.white,
  },
  stepBtnActive: {
    backgroundColor: colors.primary,
  },
  stepQty: {
    minWidth: 10,
    textAlign: 'center',
    fontFamily: fontFamily.interBold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  itemMeta: {
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.onSurfaceVariant,
  },
  itemTotal: {
    fontFamily: fontFamily.interBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
  },
  paymentToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  paymentBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C5C6CF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.white,
  },
  paymentBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  paymentText: {
    fontFamily: fontFamily.interBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
  },
  paymentTextActive: {
    color: colors.white,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(213, 235, 255, 0.5)',
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryLines: {
    gap: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
  },
  summaryValue: {
    fontFamily: fontFamily.interMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
  },
  promoLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promoLabel: {
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.tertiary,
  },
  promoValue: {
    fontFamily: fontFamily.interMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.errorCrimson,
  },
  dashedDivider: {
    marginVertical: 14,
    borderTopWidth: 1,
    borderColor: 'rgba(197, 198, 207, 0.45)',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  totalLabel: {
    fontFamily: fontFamily.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurface,
  },
  totalValue: {
    fontFamily: fontFamily.jakartaBold,
    fontSize: 34,
    lineHeight: 42,
    color: colors.primary,
  },
  cashPanel: {
    gap: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerLow,
  },
  cashInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cashLabel: {
    fontFamily: fontFamily.interMedium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurfaceVariant,
  },
  cashInputBox: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C5C6CF',
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 1,
  },
  cashInput: {
    flex: 1,
    minWidth: 80,
    padding: 0,
    textAlign: 'right',
    fontFamily: fontFamily.interBold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.primary,
  },
  cashSuffix: {
    marginLeft: 4,
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.onSurfaceVariant,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  changeLabel: {
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
  },
  changeValue: {
    fontFamily: fontFamily.interBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.secondary,
  },
  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    backgroundColor: '#F6FAFF',
  },
  actionBtn: {
    minHeight: 60,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 12,
    elevation: 5,
  },
  actionBtnDisabled: {
    backgroundColor: 'rgba(197, 198, 207, 0.55)',
    shadowOpacity: 0,
    elevation: 0,
  },
  actionText: {
    fontFamily: fontFamily.jakartaBold,
    fontSize: 18,
    lineHeight: 28,
    color: colors.white,
  },
  actionTextDisabled: {
    color: colors.onSurfaceVariant,
  },
});
