export interface Product {
  id: number;
  name: string;
  aliases?: string; // Comma-separated shorthand keywords (e.g. "ST, ST25")
  unit: string; // Default: 'kg'
  unit_price: number;
  created_at?: string;
}

export interface MatchedItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number; // quantity * unit_price
  confidence: number; // 0.0 to 1.0 (yellow highlight if < 0.8)
}

export interface Invoice {
  id?: number;
  invoice_code: string;
  customer_name?: string;
  total_quantity: number;
  subtotal_amount: number;
  discount_amount: number;
  final_amount: number; // subtotal_amount - discount_amount
  paid_amount?: number;
  change_amount?: number;
  created_at?: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
}

export interface AIParsingResult {
  matched_items: {
    product_id: number;
    product_name: string;
    quantity: number;
    unit: string;
    confidence: number;
  }[];
  unmatched_text?: string[];
}
