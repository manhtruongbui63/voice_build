import {
  mapGeminiError,
  validateGeminiApiKey,
} from '../src/services/geminiClient';

describe('geminiClient', () => {
  it.each([
    [{ status: 401 }, 'API Key không hợp lệ hoặc đã bị thu hồi'],
    [{ status: 403 }, 'API Key không hợp lệ hoặc đã bị thu hồi'],
    [{ status: 429 }, 'Gemini đang giới hạn lượt sử dụng'],
    [{ name: 'TypeError', message: 'Network request failed' }, 'Không thể kết nối Gemini'],
  ])('maps API failures to safe Vietnamese messages', (failure, message) => {
    expect(mapGeminiError(failure).message).toBe(message);
  });

  it('does not include an upstream message in the unknown error', () => {
    const error = mapGeminiError(new Error('request contained secret-key'));
    expect(error.message).toBe('Không thể xử lý yêu cầu Gemini');
    expect(error.message).not.toContain('secret-key');
  });

  it('validates a key with a minimal JSON request', async () => {
    const generate = jest.fn().mockResolvedValue('{"ok":true}');
    await validateGeminiApiKey('test-key', generate);
    expect(generate).toHaveBeenCalledWith(
      'test-key',
      expect.objectContaining({
        prompt: expect.stringContaining('ok'),
      })
    );
  });

  it('rejects a blank key before calling Gemini', async () => {
    const generate = jest.fn();
    await expect(validateGeminiApiKey('   ', generate)).rejects.toThrow(
      'Vui lòng nhập Gemini API Key'
    );
    expect(generate).not.toHaveBeenCalled();
  });
});
