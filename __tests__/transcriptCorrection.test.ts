import { normalizeVietnamese, correctTranscript } from '../src/services/transcriptCorrection';
import { Product } from '../src/types';

const products: Product[] = [
  { id: 1, name: 'Bắc Hương', aliases: 'BH', unit: 'túi', unit_price: 21000 },
  { id: 2, name: 'Gạo ST25', aliases: 'ST, ST25', unit: 'kg', unit_price: 33000 },
];

describe('transcriptCorrection', () => {
  it('normalizes Vietnamese diacritics and case', () => {
    expect(normalizeVietnamese('Gạo ST25 Đỏ')).toBe('gao st25 do');
  });

  it('fixes a mis-accented product name to the canonical name', () => {
    expect(correctTranscript('lấy 1 túi Bắc Hướng', products)).toBe('lấy 1 túi Bắc Hương');
  });

  it('leaves unrelated words untouched', () => {
    expect(correctTranscript('cho 2 cân gạo', products)).toBe('cho 2 cân gạo');
  });
});
