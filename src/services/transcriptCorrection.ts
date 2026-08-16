import { Product } from '../types';

export const normalizeVietnamese = (input: string): string =>
  input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const correctTranscript = (transcript: string, products: Product[]): string => {
  let words = transcript.split(/\s+/).filter(Boolean);
  const canon = products
    .map((p) => {
      const norm = normalizeVietnamese(p.name);
      return { name: p.name, norm, len: norm.split(' ').length };
    })
    .sort((a, b) => b.len - a.len);

  for (const p of canon) {
    for (let i = 0; i + p.len <= words.length; i++) {
      const window = words.slice(i, i + p.len).join(' ');
      if (normalizeVietnamese(window) === p.norm && window !== p.name) {
        words.splice(i, p.len, ...p.name.split(' '));
      }
    }
  }
  return words.join(' ');
};
