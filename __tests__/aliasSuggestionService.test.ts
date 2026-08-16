import { generateProductAliases } from '../src/services/aliasSuggestionService';

describe('generateProductAliases', () => {
  it('returns a normalized comma-separated alias string from the AI response', async () => {
    const generate = jest.fn().mockResolvedValue(
      JSON.stringify({ aliases: ['ST25', 'st25', ' gạo st ', 'Gạo Thơm', ''] })
    );

    const result = await generateProductAliases('Gạo ST25 túi 5kg', 'test-key', { generate });

    // Bỏ trùng (không phân biệt hoa/thường), bỏ rỗng, giữ thứ tự, gộp khoảng trắng.
    expect(result).toBe('ST25, gạo st, Gạo Thơm');
    expect(generate).toHaveBeenCalledWith(
      'test-key',
      expect.objectContaining({
        prompt: expect.stringContaining('Gạo ST25 túi 5kg'),
        responseJsonSchema: expect.any(Object),
      })
    );
  });

  it('removes aliases already taken by other products and warns the AI to avoid them', async () => {
    const generate = jest.fn().mockResolvedValue(
      JSON.stringify({ aliases: ['ST25', 'gao thom', 'st 25', 'gao deo'] })
    );

    const result = await generateProductAliases('Gạo ST25', 'test-key', {
      // "ST 25" và "gạo thơm" đã thuộc sản phẩm khác -> phải bị loại (không phân biệt hoa/thường & khoảng trắng).
      takenAliases: ['Gạo thơm', 'ST 25', 'Nếp cái'],
      generate,
    });

    expect(result).toBe('gao deo');
    const [, request] = generate.mock.calls[0];
    expect(request.prompt).toContain('TUYỆT ĐỐI không tạo trùng');
    expect(request.prompt).toContain('ST 25');
    expect(request.prompt).toContain('Gạo thơm');
  });

  it('skips the AI call and returns empty for a blank product name', async () => {
    const generate = jest.fn();

    const result = await generateProductAliases('   ', 'test-key', { generate });

    expect(result).toBe('');
    expect(generate).not.toHaveBeenCalled();
  });

  it('returns empty when the AI response is not valid JSON', async () => {
    const generate = jest.fn().mockResolvedValue('not-json');

    const result = await generateProductAliases('Gạo nếp', 'test-key', { generate });

    expect(result).toBe('');
  });

  it('propagates AI errors so callers can surface them', async () => {
    const generate = jest.fn().mockRejectedValue(new Error('Không thể kết nối Gemini'));

    await expect(generateProductAliases('Gạo tẻ', 'test-key', { generate })).rejects.toThrow(
      'Không thể kết nối Gemini'
    );
  });
});
