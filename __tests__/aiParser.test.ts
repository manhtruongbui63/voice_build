import {
  buildGeminiSystemInstruction,
  parseAIResponse,
  parseVoiceTranscript,
} from '../src/services/aiParser';
import { Product } from '../src/types';

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
});
