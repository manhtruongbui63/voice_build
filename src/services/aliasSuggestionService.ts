import { generateGeminiJson, type GeminiJsonGenerator } from './geminiClient';

const ALIAS_SYSTEM_INSTRUCTION = [
  'Bạn hỗ trợ một cửa hàng bán GẠO tại Việt Nam.',
  'Nhiệm vụ: từ tên sản phẩm gạo, tạo các "tên gọi tắt" (alias) mà người bán hay đọc khi bán hàng bằng giọng nói.',
  'Alias phải ngắn gọn, viết thường, không dấu câu thừa, phù hợp cách gọi dân dã (ví dụ tên loại gạo, tên rút gọn, cách phát âm gần đúng).',
  'Chỉ trả về JSON đúng schema, tối đa 5 alias, không trùng lặp, không kèm giải thích.',
].join(' ');

const ALIAS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    aliases: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
    },
  },
  required: ['aliases'],
  additionalProperties: false,
};

// Khóa so khớp trùng lặp: bỏ dấu tiếng Việt, hạ thường, bỏ mọi ký tự không phải chữ/số.
// Nhờ vậy "gạo thơm", "gao thom", "gaothom", "GẠO-THƠM" đều quy về một khóa — hợp với nhận diện giọng nói.
const toAliasKey = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Chuẩn hóa danh sách alias thành chuỗi lưu DB: "a, b, c".
// Bỏ rỗng, bỏ trùng nội bộ, và loại mọi alias đã bị chiếm bởi sản phẩm khác (takenKeys).
const normalizeAliases = (values: string[], takenKeys: Set<string>): string => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const cleaned = value.trim().replace(/\s+/g, ' ');
    if (!cleaned) return;
    const key = toAliasKey(cleaned);
    if (!key || seen.has(key) || takenKeys.has(key)) return;
    seen.add(key);
    result.push(cleaned);
  });
  return result.join(', ');
};

export interface GenerateAliasOptions {
  /** Alias/tên đã dùng bởi các sản phẩm KHÁC — kết quả sẽ không trùng với danh sách này. */
  takenAliases?: string[];
  /** Cho phép tiêm generator giả trong test. */
  generate?: GeminiJsonGenerator;
}

/**
 * Gọi AI phân tích tên sản phẩm gạo và trả về chuỗi alias gợi ý (đã chuẩn hóa).
 * Bảo đảm KHÔNG trùng với alias/tên của sản phẩm đã tồn tại (điều kiện tiên quyết cho nhận diện giọng nói):
 * danh sách "đã dùng" được đưa vào prompt để AI né, đồng thời lọc cứng lại kết quả.
 * Ném lỗi (đã map) nếu AI thất bại — caller quyết định hiển thị.
 */
export const generateProductAliases = async (
  productName: string,
  apiKey: string,
  options: GenerateAliasOptions = {}
): Promise<string> => {
  const { takenAliases = [], generate = generateGeminiJson } = options;
  const name = productName.trim();
  if (!name) return '';

  const takenKeys = new Set(takenAliases.map(toAliasKey).filter(Boolean));
  const avoidList = Array.from(
    new Set(takenAliases.map((value) => value.trim().replace(/\s+/g, ' ')).filter(Boolean))
  );

  const avoidClause = avoidList.length
    ? ` Các tên/alias sau ĐÃ được dùng cho sản phẩm khác, TUYỆT ĐỐI không tạo trùng hoặc gần trùng: ${avoidList.join('; ')}.`
    : '';

  const raw = await generate(apiKey, {
    systemInstruction: ALIAS_SYSTEM_INSTRUCTION,
    prompt: `Tên sản phẩm gạo: "${name}". Hãy tạo các tên gọi tắt (alias) phù hợp.${avoidClause}`,
    responseJsonSchema: ALIAS_SCHEMA,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return '';
  }

  const aliases = (parsed as { aliases?: unknown })?.aliases;
  if (!Array.isArray(aliases)) return '';

  return normalizeAliases(
    aliases.filter((item): item is string => typeof item === 'string'),
    takenKeys
  );
};
