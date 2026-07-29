import { buildGeminiSystemInstruction, parseAIResponse } from '../src/services/aiParser';
import { Product } from '../src/types';

describe('AI Parser Service', () => {
  const sampleProducts: Product[] = [
    { id: 1, name: 'Gạo ST25', aliases: 'ST, ST25', unit: 'kg', unit_price: 33000 },
    { id: 2, name: 'Gạo Tám Thái', aliases: 'tám thái', unit: 'kg', unit_price: 22000 },
  ];

  it('generates system instruction with catalog products', () => {
    const instruction = buildGeminiSystemInstruction(sampleProducts);
    expect(instruction).toContain('Gạo ST25');
    expect(instruction).toContain('ST, ST25');
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
});
