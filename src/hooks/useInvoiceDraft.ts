import { useMemo, useState } from 'react';
import { calculateInvoiceTotals, saveInvoiceToDB } from '../services/db';
import { formatHoChiMinhDateTime } from '../utils/hoChiMinhTime';
import { Invoice, MatchedItem, PaymentMethod } from '../types';

export interface SavedInvoiceSummary {
  invoiceCode: string;
  savedAt: Date;
  totalQuantity: number;
  finalAmount: number;
  paymentMethod: PaymentMethod;
}

export interface InvoiceDraft {
  items: MatchedItem[];
  paid: string;
  paymentMethod: PaymentMethod;
  totals: ReturnType<typeof calculateInvoiceTotals>;
  savedInvoice: SavedInvoiceSummary | null;
  addItems: (newItems: MatchedItem[]) => void;
  changeQty: (index: number, delta: number) => void;
  removeItem: (index: number) => void;
  setPaid: (value: string) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  clear: () => void;
  save: (now?: number) => void;
  reset: () => void;
}

const withAmount = (item: MatchedItem, quantity: number): MatchedItem => ({
  ...item,
  quantity,
  amount: quantity * item.unit_price,
});

// Cộng dồn danh sách món mới vào đơn hiện tại: món trùng product_id thì cộng số lượng.
const mergeItems = (current: MatchedItem[], incoming: MatchedItem[]): MatchedItem[] => {
  const result = [...current];
  incoming.forEach((item) => {
    const existingIndex =
      item.product_id != null
        ? result.findIndex((existing) => existing.product_id === item.product_id)
        : -1;
    if (existingIndex >= 0) {
      const merged = result[existingIndex];
      result[existingIndex] = withAmount(merged, merged.quantity + item.quantity);
    } else {
      result.push(withAmount(item, item.quantity));
    }
  });
  return result;
};

/**
 * Trạng thái + logic của một hóa đơn nháp dùng chung cho layout tablet
 * (voice + hóa đơn trên cùng một màn hình, cộng dồn khi nói nhiều lần).
 */
export const useInvoiceDraft = (
  initialPaymentMethod: PaymentMethod = 'chuyển khoản'
): InvoiceDraft => {
  const [items, setItems] = useState<MatchedItem[]>([]);
  const [paid, setPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialPaymentMethod);
  const [savedInvoice, setSavedInvoice] = useState<SavedInvoiceSummary | null>(null);

  const totals = useMemo(
    () => calculateInvoiceTotals(items, 0, paid ? parseFloat(paid) : undefined),
    [items, paid]
  );

  const addItems = (newItems: MatchedItem[]) => {
    if (newItems.length === 0) return;
    setItems((current) => mergeItems(current, newItems));
  };

  const changeQty = (index: number, delta: number) => {
    setItems((current) => {
      const updated = [...current];
      const target = updated[index];
      if (!target) return current;
      updated[index] = withAmount(target, Math.max(1, (target.quantity || 0) + delta));
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const clear = () => {
    setItems([]);
    setPaid('');
  };

  const save = (now = Date.now()) => {
    if (items.length === 0) return;
    const invoiceCode = `VOICE-${String(now).slice(-4)}`;
    const invoice: Invoice = {
      invoice_code: invoiceCode,
      customer_name: '',
      total_quantity: totals.total_quantity,
      subtotal_amount: totals.subtotal_amount,
      discount_amount: totals.discount_amount,
      final_amount: totals.final_amount,
      paid_amount: totals.paid_amount,
      change_amount: totals.change_amount,
      payment_method: paymentMethod,
      created_at: formatHoChiMinhDateTime(),
      items: items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        amount: item.amount,
      })),
    };
    saveInvoiceToDB(invoice);
    setSavedInvoice({
      invoiceCode,
      savedAt: new Date(now),
      totalQuantity: totals.total_quantity,
      finalAmount: totals.final_amount,
      paymentMethod,
    });
  };

  const reset = () => {
    setItems([]);
    setPaid('');
    setSavedInvoice(null);
  };

  return {
    items,
    paid,
    paymentMethod,
    totals,
    savedInvoice,
    addItems,
    changeQty,
    removeItem,
    setPaid,
    setPaymentMethod,
    clear,
    save,
    reset,
  };
};
