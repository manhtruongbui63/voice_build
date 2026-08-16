export interface TranscriptSegment {
  text: string;
  keyword: boolean;
}

// Bỏ dấu tiếng Việt + hạ thường (để so khớp không phụ thuộc dấu).
const stripTones = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();

// Khóa của một từ: bỏ dấu, bỏ mọi ký tự không phải chữ/số.
const normalizeWord = (value: string): string => stripTones(value).replace(/[^a-z0-9]/g, '');

// Số viết bằng chữ (đã bỏ dấu).
const NUMBER_WORDS = new Set([
  'khong', 'mot', 'hai', 'ba', 'bon', 'nam', 'sau', 'bay', 'tam', 'chin',
  'muoi', 'tram', 'nghin', 'ngan', 'trieu', 'ty', 'tu', 'lam', 'ruoi',
  'chuc', 'linh', 'le', 'ram',
]);

// Đơn vị bán hàng thường gặp (đã bỏ dấu).
const UNIT_WORDS = new Set([
  'kg', 'ky', 'lang', 'gam', 'gram', 'tui', 'bao', 'bich', 'ly', 'coc',
  'chai', 'thung', 'hop', 'goi', 'yen', 'ta', 'can', 'lit', 'lon',
]);

const isNumberLike = (piece: string): boolean => /\d/.test(piece);

/**
 * Cắt transcript thành các đoạn để tô màu keyword.
 * keyword = số lượng (chữ số hoặc số viết chữ), đơn vị, hoặc từ thuộc tên/alias sản phẩm.
 * `keywords`: danh sách tên + alias sản phẩm (và/hoặc matched_items) để nhận diện tên hàng.
 */
export const buildTranscriptSegments = (
  transcript: string,
  keywords: string[] = []
): TranscriptSegment[] => {
  if (!transcript) return [];

  const productWords = new Set<string>();
  keywords.forEach((phrase) => {
    phrase.split(/\s+/).forEach((word) => {
      const key = normalizeWord(word);
      if (key.length >= 2) productWords.add(key);
    });
  });

  const segments: TranscriptSegment[] = [];
  const push = (text: string, keyword: boolean) => {
    const last = segments[segments.length - 1];
    if (last && last.keyword === keyword) {
      last.text += text;
      return;
    }
    segments.push({ text, keyword });
  };

  transcript.split(/(\s+)/).forEach((piece) => {
    if (!piece) return;
    if (/^\s+$/.test(piece)) {
      push(piece, false);
      return;
    }

    const key = normalizeWord(piece);
    const keyword =
      isNumberLike(piece) ||
      (!!key && (NUMBER_WORDS.has(key) || UNIT_WORDS.has(key) || productWords.has(key)));
    push(piece, keyword);
  });

  return segments;
};
