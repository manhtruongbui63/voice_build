import { Product, AIParsingResult, PaymentMethod } from '../types';
import { normalizeVietnamese } from './transcriptCorrection';

const CORRECTION_PHRASES = ['a khong', 'khong lay', 'nham', 'thoi bo', 'thoi khong', 'sua thanh', 'sua lai'];
const FILLER = new Set(['cho', 'lay', 'them', 'a', 'nhe', 'oi', 'va', 'voi', 'di', 'minh', 'ban', 'em', 'chi', 'anh', 'gia']);
const UNIT_WORDS = new Set(['kg', 'ky', 'ki', 'can', 'tui', 'qua', 'chai', 'lon', 'goi', 'hop', 'bao', 'lang', 'yen', 'ta']);
const MULTIPLIER: Record<string, number> = { lang: 0.1, yen: 10, ta: 100 };

const buildAliasIndex = (products: Product[]) => {
  const entries: { key: string; len: number; product: Product }[] = [];
  for (const p of products) {
    const keys = [p.name, ...(p.aliases ? p.aliases.split(',') : [])];
    for (const raw of keys) {
      const norm = normalizeVietnamese(raw);
      if (norm) entries.push({ key: norm, len: norm.split(' ').length, product: p });
    }
  }
  return entries.sort((a, b) => b.len - a.len);
};

const readQuantity = (tokens: string[], i: number): { qty: number; next: number } | null => {
  let qty: number | null = null;
  let j = i;
  const num = Number(tokens[j]);
  if (tokens[j] === 'nua') {
    qty = 0.5;
    j += 1;
  } else if (!Number.isNaN(num) && tokens[j] !== '') {
    qty = num;
    j += 1;
    if (tokens[j] === 'ruoi') {
      qty += 0.5;
      j += 1;
    }
  }
  if (qty === null) return null;
  if (UNIT_WORDS.has(tokens[j])) {
    if (MULTIPLIER[tokens[j]]) qty *= MULTIPLIER[tokens[j]];
    j += 1;
  }
  return { qty, next: j };
};

const readProduct = (
  tokens: string[],
  i: number,
  index: ReturnType<typeof buildAliasIndex>
): { product: Product; next: number } | null => {
  for (const entry of index) {
    const window = tokens.slice(i, i + entry.len).join(' ');
    if (window && window === entry.key) return { product: entry.product, next: i + entry.len };
  }
  return null;
};

const tryParse = (transcript: string, products: Product[]): AIParsingResult | null => {
  let norm = normalizeVietnamese(transcript);
  if (CORRECTION_PHRASES.some((phrase) => norm.includes(phrase))) return null;

  let paymentMethod: PaymentMethod | undefined;
  if (norm.includes('tien mat')) {
    paymentMethod = 'tiền mặt';
    norm = norm.replace(/tien mat/g, ' ');
  } else if (norm.includes('chuyen khoan')) {
    paymentMethod = 'chuyển khoản';
    norm = norm.replace(/chuyen khoan/g, ' ');
  }

  const tokens = norm.split(' ').filter(Boolean);
  const index = buildAliasIndex(products);
  const items: AIParsingResult['matched_items'] = [];
  let i = 0;
  while (i < tokens.length) {
    if (FILLER.has(tokens[i])) {
      i += 1;
      continue;
    }
    const q = readQuantity(tokens, i);
    if (!q) return null;
    const prod = readProduct(tokens, q.next, index);
    if (!prod) return null;
    items.push({
      product_id: prod.product.id,
      product_name: prod.product.name,
      quantity: q.qty,
      unit: prod.product.unit,
      confidence: 0.97,
    });
    i = prod.next;
  }
  if (items.length === 0) return null;
  return { matched_items: items, payment_method: paymentMethod, unmatched_text: [] };
};

export const localFastParse = (
  alternatives: string[],
  products: Product[]
): AIParsingResult | null => {
  for (const transcript of alternatives) {
    const result = tryParse(transcript, products);
    if (result) return result;
  }
  return null;
};
