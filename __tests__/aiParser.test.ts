import {
  buildGeminiSystemInstruction,
  parseAIResponse,
  parseVoiceTranscript,
  shortlistProducts,
} from '../src/services/aiParser';
import { Product } from '../src/types';
import { getDefaultPaymentMethod } from '../src/services/geminiSettingsService';

jest.mock('../src/services/geminiSettingsService', () => ({
  getDefaultPaymentMethod: jest.fn().mockResolvedValue('chuyển khoản'),
}));

describe('AI Parser Service', () => {
  const sampleProducts: Product[] = [
    { id: 1, name: 'Gạo ST25', aliases: 'ST, ST25', unit: 'kg', unit_price: 33000 },
    { id: 2, name: 'Gạo Tám Thái', aliases: 'tám thái', unit: 'kg', unit_price: 22000 },
  ];

  it('generates system instruction with catalog products', () => {
    const instruction = buildGeminiSystemInstruction(sampleProducts);
    expect(instruction).toContain('Gạo ST25');
    expect(instruction).toContain('"ST"');
    expect(instruction).toContain('"ST25"');
  });

  it('parses valid AI JSON response correctly', () => {
    const rawJson = JSON.stringify({
      matched_items: [
        { product_id: 1, product_name: 'Gạo ST25', quantity: 1, unit: 'kg', confidence: 0.95 },
        { product_id: 2, product_name: 'Gạo Tám Thái', quantity: 2.5, unit: 'kg', confidence: 0.65 },
      ],
    });

    const parsed = parseAIResponse(rawJson);
    expect(parsed.matched_items.length).toBe(2);
    expect(parsed.matched_items[0].quantity).toBe(1);
    expect(parsed.matched_items[1].confidence).toBe(0.65);
  });

  it('passes the key and structured request to the Gemini boundary', async () => {
    const generate = jest.fn().mockResolvedValue(
      JSON.stringify({ matched_items: [], unmatched_text: [] })
    );

    await parseVoiceTranscript('1kg ST', sampleProducts, 'test-key', generate);

    expect(generate).toHaveBeenCalledWith(
      'test-key',
      expect.objectContaining({
        systemInstruction: expect.stringContaining('Gạo ST25'),
        responseJsonSchema: expect.objectContaining({ type: 'object' }),
      })
    );
  });

  it('rejects semantically invalid Gemini output', async () => {
    const generate = jest.fn().mockResolvedValue('{"matched_items":"wrong"}');
    await expect(
      parseVoiceTranscript('1kg ST', sampleProducts, 'test-key', generate)
    ).rejects.toThrow('Gemini trả về dữ liệu không hợp lệ');
  });

  it('rejects a matched product ID that is absent from the catalog', async () => {
    const generate = jest.fn().mockResolvedValue(
      JSON.stringify({
        matched_items: [
          {
            product_id: 999,
            product_name: 'Sản phẩm giả',
            quantity: 1,
            unit: 'kg',
            confidence: 0.9,
          },
        ],
        unmatched_text: [],
      })
    );

    await expect(
      parseVoiceTranscript('1kg sản phẩm giả', sampleProducts, 'test-key', generate)
    ).rejects.toThrow('Gemini trả về dữ liệu không hợp lệ');
  });

  it('canonicalizes matched product names and units from the catalog', async () => {
    const generate = jest.fn().mockResolvedValue(
      JSON.stringify({
        matched_items: [
          {
            product_id: 1,
            product_name: 'Tên giả',
            quantity: 2,
            unit: 'thùng',
            confidence: 0.9,
          },
        ],
        unmatched_text: [],
      })
    );

    await expect(
      parseVoiceTranscript('2kg ST', sampleProducts, 'test-key', generate)
    ).resolves.toEqual({
      matched_items: [
        {
          product_id: 1,
          product_name: 'Gạo ST25',
          quantity: 2,
          unit: 'kg',
          confidence: 0.9,
        },
      ],
      payment_method: 'chuyển khoản',
      unmatched_text: [],
    });
  });

  it('includes few-shot examples in the system instruction', () => {
    const instruction = buildGeminiSystemInstruction([]);
    expect(instruction).toContain('VÍ DỤ MẪU (FEW-SHOT EXAMPLES):');
    expect(instruction).toContain('cho 2 cân gạo ST');
    expect(instruction).toContain('lấy 1 túi Bắc Hương, à thôi lấy 2 túi đi');
  });

  it('returns the full catalog when it is small', () => {
    const list = shortlistProducts(['gạo st'], sampleProducts, 30);
    expect(list).toHaveLength(sampleProducts.length);
  });

  it('filters to matching candidates for a large catalog', () => {
    const big: Product[] = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1, name: `SP ${i}`, aliases: '', unit: 'cái', unit_price: 1000,
    }));
    big.push({ id: 999, name: 'Gạo ST25', aliases: 'ST', unit: 'kg', unit_price: 33000 });
    const list = shortlistProducts(['2 cân gạo st'], big, 30);
    expect(list.some((p) => p.id === 999)).toBe(true);
    expect(list.length).toBeLessThan(big.length);
  });
});
