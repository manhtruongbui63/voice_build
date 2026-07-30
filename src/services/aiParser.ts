import { Product, AIParsingResult } from '../types';
import {
  generateGeminiJson,
  GeminiJsonGenerator,
} from './geminiClient';
import { getDefaultPaymentMethod } from './geminiSettingsService';
import { normalizeVietnamese } from './transcriptCorrection';

export const shortlistProducts = (
  alternatives: string[],
  products: Product[],
  limit = 30
): Product[] => {
  if (products.length <= limit) return products;
  const haystack = normalizeVietnamese(alternatives.join(' '));
  const scored = products.filter((p) => {
    const keys = [p.name, ...(p.aliases ? p.aliases.split(',') : [])]
      .map((k) => normalizeVietnamese(k))
      .filter(Boolean);
    return keys.some((k) => k.length > 1 && haystack.includes(k));
  });
  return scored.length > 0 ? scored.slice(0, limit) : products;
};

const INVOICE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    matched_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          product_id: { type: 'integer' },
          product_name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: [
          'product_id',
          'product_name',
          'quantity',
          'unit',
          'confidence',
        ],
        additionalProperties: false,
      },
    },
    unmatched_text: {
      type: 'array',
      items: { type: 'string' },
    },
    payment_method: { type: 'string' },
  },
  required: ['matched_items', 'unmatched_text'],
  additionalProperties: false,
} as const;

export const buildGeminiSystemInstruction = (products: Product[]): string => {
  const catalogList = products.map((p) => ({
    id: p.id,
    name: p.name,
    aliases: p.aliases ? p.aliases.split(',').map((a) => a.trim()) : [],
    unit: p.unit,
  }));

  return `Bạn là trợ lý AI thông minh cho ứng dụng bán lẻ VoiceBill. Nhiệm vụ của bạn là bóc tách thông tin sản phẩm và số lượng từ văn bản giọng nói tiếng Việt của người bán hàng.

DANH SÁCH SẢN PHẨM HỢP LỆ (AVAILABLE PRODUCTS):
${JSON.stringify(catalogList, null, 2)}

QUY TẮC BẮT BUỘC:
1. BẠN CHỈ ĐƯỢC PHÉP KHỚP VỚI CÁC SẢN PHẨM TRONG DANH SÁCH CÓ SẴN Ở TRÊN (Dựa vào field 'name' hoặc 'aliases').
2. XỬ LÝ ĐÍNH CHÍNH / SỬA KHẨU LỆNH:
   - Nếu xuất hiện các từ đính chính như "à không", "thôi bỏ", "nhầm", "sửa thành", hãy cập nhật lại số lượng mới hoặc loại bỏ sản phẩm đứng trước đó.
3. QUY ĐỔI ĐẠI LƯỢNG SỐ LƯỢNG TIẾNG VIỆT:
   - "nửa cân", "nửa ký" -> 0.5
   - "lạng" -> 0.1
   - "yến" -> 10
   - "tạ" -> 100
   - "chục cân" -> 10
   - "cân", "ký", "kg", "kí", "quả", "túi" -> quy đổi ra số thực (ví dụ "2 cân rưỡi" -> 2.5).
4. CHỈ SỐ TIN CẬY (CONFIDENCE):
   - Trả về 'confidence' từ 0.0 đến 1.0 cho mỗi sản phẩm.
   - Nếu từ đọc bị lệch âm nhẹ (ví dụ "Bắc Hướng" -> "Bắc Hương"), gán confidence = 0.6.
6. PHƯƠNG THỨC THANH TOÁN (PAYMENT METHOD):
   - Nếu khách nói "tiền mặt", trả về payment_method = "tiền mặt".
   - Nếu khách nói "chuyển khoản", trả về payment_method = "chuyển khoản".
   - Nếu không nhắc gì đến thanh toán, KHÔNG TRẢ VỀ trường này (hoặc trả về null).
7. Trả về đúng định dạng JSON Schema yêu cầu.

VÍ DỤ MẪU (FEW-SHOT EXAMPLES):
- Giọng nói: "cho 2 cân gạo ST"
  JSON: {"matched_items": [{"product_id": 1, "product_name": "Gạo ST25", "quantity": 2, "unit": "kg", "confidence": 0.9}], "unmatched_text": []}

- Giọng nói: "lấy 1 túi Bắc Hương thanh toán tiền mặt"
  JSON: {"matched_items": [{"product_id": 2, "product_name": "Bắc Hương", "quantity": 1, "unit": "túi", "confidence": 0.95}], "payment_method": "tiền mặt", "unmatched_text": []}

- Giọng nói (có đính chính): "lấy 1 túi Bắc Hương, à thôi lấy 2 túi đi"
  JSON: {"matched_items": [{"product_id": 2, "product_name": "Bắc Hương", "quantity": 2, "unit": "túi", "confidence": 0.9}], "unmatched_text": []}`;
};

type ParsedMatchedItem = AIParsingResult['matched_items'][number];

const isMatchedItem = (value: unknown): value is ParsedMatchedItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.product_id === 'number' &&
    typeof item.product_name === 'string' &&
    typeof item.quantity === 'number' &&
    typeof item.unit === 'string' &&
    typeof item.confidence === 'number' &&
    item.confidence >= 0 &&
    item.confidence <= 1
  );
};

export const parseAIResponse = (responseText: string): AIParsingResult => {
  try {
    const jsonText = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    const value: unknown = JSON.parse(jsonText);
    if (!value || typeof value !== 'object') {
      throw new Error('invalid object');
    }

    const parsed = value as Record<string, unknown>;
    if (
      !Array.isArray(parsed.matched_items) ||
      !parsed.matched_items.every(isMatchedItem) ||
      (parsed.unmatched_text !== undefined &&
        (!Array.isArray(parsed.unmatched_text) ||
          !parsed.unmatched_text.every((item) => typeof item === 'string')))
    ) {
      throw new Error('invalid schema');
    }

    return {
      matched_items: parsed.matched_items,
      payment_method: parsed.payment_method as any,
      unmatched_text: (parsed.unmatched_text as string[] | undefined) ?? [],
    };
  } catch {
    throw new Error('Gemini trả về dữ liệu không hợp lệ');
  }
};

export const parseVoiceTranscript = async (
  alternatives: string[],
  products: Product[],
  apiKey: string,
  generate: GeminiJsonGenerator = generateGeminiJson
): Promise<AIParsingResult> => {
  if (!apiKey.trim()) {
    throw new Error('Chưa có Gemini API Key');
  }

  const best = (alternatives[0] ?? '').trim();
  const others = alternatives.slice(1).filter(Boolean);
  const catalog = shortlistProducts(alternatives, products);

  const altBlock = others.length
    ? `\nCác cách nghe khác (chọn phương án khớp danh mục nhất): ${others
        .map((a) => `"${a}"`)
        .join(', ')}`
    : '';

  const responseText = await generate(apiKey, {
    prompt: `Ghi âm giọng nói người dùng: "${best}"${altBlock}`,
    systemInstruction: buildGeminiSystemInstruction(catalog),
    responseJsonSchema: INVOICE_RESPONSE_SCHEMA,
  });
  const parsed = parseAIResponse(responseText);
  const productById = new Map(products.map((product) => [product.id, product]));
  const matchedItems = parsed.matched_items.map((item) => {
    const product = productById.get(item.product_id);
    if (!product) {
      throw new Error('Gemini trả về dữ liệu không hợp lệ');
    }
    return {
      ...item,
      product_name: product.name,
      unit: product.unit,
    };
  });

  return {
    matched_items: matchedItems,
    payment_method: parsed.payment_method || (await getDefaultPaymentMethod()),
    unmatched_text: parsed.unmatched_text,
  };
};
