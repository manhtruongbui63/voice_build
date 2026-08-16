import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { InvoiceDraft } from '../hooks/useInvoiceDraft';
import { MatchedItem } from '../types';
import { colors, fontFamily } from '../theme/tokens';

interface Props {
  draft: InvoiceDraft;
  onSaved?: () => void;
}

const formatVnd = (value: number) => `${Math.round(value).toLocaleString('vi-VN')}đ`;

export const TabletInvoicePanel: React.FC<Props> = ({ draft, onSaved }) => {
  const { items, paid, paymentMethod, totals, savedInvoice } = draft;
  const isCash = paymentMethod === 'tiền mặt';
  const hasItems = items.length > 0;

  const handleSave = () => {
    if (!hasItems) return;
    draft.save();
  };

  const handleNewInvoice = () => {
    draft.reset();
    onSaved?.();
  };

  const renderItem = (item: MatchedItem, index: number) => {
    const priced = item.unit_price > 0;
    return (
      <View
        key={`${item.product_id ?? 'x'}-${index}`}
        testID={`tablet-invoice-item-${index}`}
        style={[styles.itemCard, !priced && styles.itemCardWarning]}
      >
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
          <Text style={[styles.itemPrice, !priced && styles.itemPriceWarning]}>
            {priced ? `${formatVnd(item.unit_price)}/${item.unit}` : 'Chưa có giá'}
          </Text>
        </View>

        <View style={styles.stepper}>
          <TouchableOpacity
            testID={`tablet-item-${index}-minus`}
            style={styles.stepBtn}
            onPress={() => draft.changeQty(index, -1)}
          >
            <MaterialIcons name="remove" size={14} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.stepQty}>{item.quantity}</Text>
          <TouchableOpacity
            testID={`tablet-item-${index}-plus`}
            style={styles.stepBtn}
            onPress={() => draft.changeQty(index, 1)}
          >
            <MaterialIcons name="add" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.itemAmount}>{priced ? formatVnd(item.amount) : '--'}</Text>

        <TouchableOpacity
          testID={`tablet-item-${index}-remove`}
          style={styles.removeBtn}
          onPress={() => draft.removeItem(index)}
        >
          <MaterialIcons name="close" size={12} color={colors.white} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View testID="tablet-invoice-panel" style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Thông tin đơn hàng</Text>
        {hasItems ? (
          <TouchableOpacity testID="tablet-new-invoice" onPress={draft.clear} activeOpacity={0.8}>
            <Text style={styles.newInvoiceText}>Đơn mới</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {hasItems ? (
          items.map(renderItem)
        ) : (
          <View testID="tablet-invoice-empty" style={styles.empty}>
            <MaterialIcons name="mic-none" size={40} color="rgba(255,255,255,0.5)" />
            <Text style={styles.emptyText}>Nhấn micro và đọc đơn hàng để bắt đầu.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerBlock}>
          {/* Slot khách đưa / tiền thừa — luôn giữ chỗ để không xô layout khi đổi phương thức */}
          <View style={styles.cashSlot}>
            {isCash ? (
              <View style={styles.cashRows}>
                <View style={styles.cashLine}>
                  <Text style={styles.cashLabel}>Khách đưa</Text>
                  <TextInput
                    testID="tablet-paid-input"
                    style={styles.cashInput}
                    value={paid}
                    onChangeText={draft.setPaid}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.outline}
                  />
                </View>
                <View style={styles.cashLine}>
                  <Text style={styles.cashLabel}>Tiền thừa</Text>
                  <Text style={styles.changeValue}>{formatVnd(totals.change_amount)}</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.paymentToggle}>
            <TouchableOpacity
              testID="tablet-payment-cash"
              style={[styles.payBtn, isCash && styles.payBtnActive]}
              onPress={() => draft.setPaymentMethod('tiền mặt')}
            >
              <Text style={[styles.payText, isCash && styles.payTextActive]}>Tiền mặt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="tablet-payment-transfer"
              style={[styles.payBtn, !isCash && styles.payBtnActive]}
              onPress={() => draft.setPaymentMethod('chuyển khoản')}
            >
              <Text style={[styles.payText, !isCash && styles.payTextActive]}>Chuyển khoản</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.footerBlock, styles.footerBlockRight]}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text testID="tablet-total" style={styles.totalValue}>{formatVnd(totals.final_amount)}</Text>
          </View>

          <TouchableOpacity
            testID="tablet-confirm"
            style={[styles.confirmBtn, !hasItems && styles.confirmBtnDisabled]}
            onPress={handleSave}
            disabled={!hasItems}
            activeOpacity={0.9}
          >
            <Text style={styles.confirmText}>XÁC NHẬN & IN BILL</Text>
            <MaterialIcons name="print" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {savedInvoice ? (
        <View testID="tablet-success" style={styles.successOverlay}>
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={72} color={colors.white} />
          </View>
          <Text style={styles.successTitle}>Lưu hóa đơn thành công</Text>
          <Text style={styles.successCode}>{savedInvoice.invoiceCode}</Text>
          <Text style={styles.successAmount}>{formatVnd(savedInvoice.finalAmount)}</Text>
          <TouchableOpacity testID="tablet-success-new" style={styles.successBtn} onPress={handleNewInvoice}>
            <MaterialIcons name="add" size={20} color={colors.white} />
            <Text style={styles.successBtnText}>Tạo hóa đơn mới</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.white,
  },
  newInvoiceText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    color: colors.secondary,
  },
  body: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  bodyContent: {
    padding: 12,
    gap: 8,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  emptyText: {
    fontFamily: fontFamily.interRegular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    maxWidth: 220,
  },
  itemCard: {
    position: 'relative',
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(197,198,207,0.2)',
  },
  itemCardWarning: {
    borderColor: colors.warningAmber,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemName: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    color: colors.primary,
  },
  itemPrice: {
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  itemPriceWarning: {
    color: colors.warningAmber,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  stepBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(197,198,207,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepQty: {
    fontFamily: fontFamily.interBold,
    fontSize: 14,
    color: colors.primary,
    minWidth: 16,
    textAlign: 'center',
  },
  itemAmount: {
    fontFamily: fontFamily.interBold,
    fontSize: 14,
    color: colors.primary,
    minWidth: 72,
    textAlign: 'right',
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.errorCrimson,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,198,207,0.3)',
  },
  footerBlock: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 8,
  },
  footerBlockRight: {
    justifyContent: 'space-between',
  },
  cashSlot: {
    height: 62,
    justifyContent: 'center',
  },
  cashRows: {
    gap: 6,
  },
  cashLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  paymentToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(197,198,207,0.3)',
  },
  payBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  payBtnActive: {
    backgroundColor: colors.primary,
  },
  payText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 13,
    color: colors.primary,
  },
  payTextActive: {
    color: colors.white,
  },
  cashRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-end',
  },
  cashField: {
    flex: 1,
    gap: 6,
  },
  cashLabel: {
    fontFamily: fontFamily.interMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  cashInput: {
    flex: 1,
    maxWidth: 140,
    textAlign: 'right',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(197,198,207,0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontFamily: fontFamily.interBold,
    fontSize: 15,
    color: colors.primary,
  },
  changeField: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: 6,
  },
  changeValue: {
    fontFamily: fontFamily.jakartaBold,
    fontSize: 18,
    color: colors.tertiary,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,198,207,0.2)',
  },
  totalLabel: {
    fontFamily: fontFamily.interBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  totalValue: {
    fontFamily: fontFamily.jakartaBold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.primary,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontFamily: fontFamily.interBold,
    fontSize: 14,
    color: colors.white,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontFamily: fontFamily.jakartaBold,
    fontSize: 24,
    color: colors.white,
  },
  successCode: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  successAmount: {
    fontFamily: fontFamily.jakartaBold,
    fontSize: 36,
    color: colors.secondary,
    marginBottom: 16,
  },
  successBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  successBtnText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 16,
    color: colors.white,
  },
});
