import { Product, AIParsingResult, PaymentMethod } from '../types';
import { normalizeVietnamese } from './transcriptCorrection';

const CORRECTION_PHRASES = ['a khong', 'khong lay', 'nham', 'thoi bo', 'thoi khong', 'sua thanh', 'sua lai'];
const FILLER = new Set([
  'cho', 'lay', 'them', 'a', 'nhe', 'oi', 'va', 'voi', 'di', 'minh', 'ban',
  'em', 'chi', 'anh', 'gia', 'luon', 'nha', 'the', 'nay',
]);
// Cửa hàng gạo bán theo cân — chỉ dùng đơn vị khối lượng.
const UNIT_WORDS = new Set([
  'kg', 'ky', 'ki', 'kilo', 'kilogam', 'kilogram', 'can', 'lang', 'yen', 'ta',
]);
const MULTIPLIER: Record<string, number> = { lang: 0.1, yen: 10, ta: 100 };

// Số viết bằng chữ (0-9) đã bỏ dấu. 'tu'->4, 'lam'->5 (dùng trong số ghép như "hai mươi lăm").
const NUMBER_WORDS: Record<string, number> = {
  khong: 0, mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5,
  sau: 6, bay: 7, tam: 8, chin: 9,
};

// Đọc một số (chữ số hoặc số viết chữ 0-99) bắt đầu tại vị trí j.
const readNumberWord = (tokens: string[], j: number): { value: number; next: number } | null => {
  const t0 = tokens[j];
  if (t0 === undefined || t0 === '') return null;

  const digit = Number(t0);
  if (!Number.isNaN(digit)) return { value: digit, next: j + 1 };

  if (t0 === 'nua') return { value: 0.5, next: j + 1 };

  // "mười", "mười lăm", "mười một"...
  if (t0 === 'muoi') {
    const u = NUMBER_WORDS[tokens[j + 1]];
    if (u !== undefined && u >= 1 && u <= 9) return { value: 10 + u, next: j + 2 };
    return { value: 10, next: j + 1 };
  }

  const unit = NUMBER_WORDS[t0];
  if (unit === undefined) return null;

  // "hai mươi", "hai mươi lăm"...
  if (tokens[j + 1] === 'muoi') {
    let value = unit * 10;
    let next = j + 2;
    const u = NUMBER_WORDS[tokens[j + 2]];
    if (u !== undefined && u >= 1 && u <= 9) {
      value += u;
      next = j + 3;
    }
    return { value, next };
  }

  return { value: unit, next: j + 1 };
};

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
  const num = readNumberWord(tokens, i);
  if (!num) return null;

  let qty = num.value;
  let j = num.next;

  // "hai cân rưỡi" -> 2.5
  if (tokens[j] === 'ruoi') {
    qty += 0.5;
    j += 1;
  }

  if (UNIT_WORDS.has(tokens[j])) {
    if (MULTIPLIER[tokens[j]]) qty *= MULTIPLIER[tokens[j]];
    j += 1;
    // "hai cân rưỡi" khi 'rưỡi' đứng sau đơn vị
    if (tokens[j] === 'ruoi') {
      qty += 0.5;
      j += 1;
    }
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

// Khớp sản phẩm, cho phép bỏ tiền tố "gạo" thừa nếu phần còn lại là một tên sản phẩm.
// Vd alias lưu "st25" nhưng khách nói "gạo st25" (hoặc ngược lại) vẫn khớp local.
const matchProduct = (
  tokens: string[],
  i: number,
  index: ReturnType<typeof buildAliasIndex>
): { product: Product; next: number } | null => {
  const direct = readProduct(tokens, i, index);
  if (direct) return direct;
  if (tokens[i] === 'gao') return readProduct(tokens, i + 1, index);
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

    let qty = 1;
    let productStart = i;

    // Quy tắc ưu tiên (dựa trên đặc thù tiếng Việt của người bán gạo):
    // 1) Số đứng NGAY TRƯỚC đơn vị (cân/kg/ký...) hoặc "rưỡi" -> chắc chắn là SỐ LƯỢNG.
    //    Vd "tám cân đài thơm" = 8, dù "tám"/"tấm" cùng chuẩn hóa thành "tam".
    // 2) Ngược lại, nếu token hiện tại là đầu một TÊN SẢN PHẨM (vd "tám thái", "tấm",
    //    "bắc hương") -> giữ là tên hàng, số lượng mặc định 1 (không hiểu nhầm thành số).
    // 3) Còn lại: đọc số lượng (số viết chữ/chữ số) rồi tới tên sản phẩm.
    const num = readNumberWord(tokens, i);
    const numFollowedByUnit =
      !!num && (UNIT_WORDS.has(tokens[num.next]) || tokens[num.next] === 'ruoi');

    if (numFollowedByUnit) {
      const q = readQuantity(tokens, i)!;
      qty = q.qty;
      productStart = q.next;
    } else if (matchProduct(tokens, i, index)) {
      qty = 1;
      productStart = i;
    } else {
      const q = readQuantity(tokens, i);
      if (q) {
        qty = q.qty;
        productStart = q.next;
      }
    }

    const prod = matchProduct(tokens, productStart, index);
    if (!prod) return null;

    items.push({
      product_id: prod.product.id,
      product_name: prod.product.name,
      quantity: qty,
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
