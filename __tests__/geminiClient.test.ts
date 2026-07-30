import { GoogleGenAI } from '@google/genai';
import {
  generateGeminiJson,
  mapGeminiError,
  validateGeminiApiKey,
} from '../src/services/geminiClient';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

const mockedGoogleGenAI = GoogleGenAI as jest.MockedClass<typeof GoogleGenAI>;

describe('geminiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('maps the SDK API_KEY_INVALID response without exposing its message', () => {
    const upstreamMessage = JSON.stringify({
      error: {
        code: 400,
        message: 'API key not valid. Please pass a valid API key.',
        status: 'INVALID_ARGUMENT',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
            reason: 'API_KEY_INVALID',
            domain: 'googleapis.com',
          },
        ],
      },
    });

    const error = mapGeminiError({
      name: 'ApiError',
      status: 400,
      message: upstreamMessage,
    });

    expect(error.message).toBe('API Key không hợp lệ hoặc đã bị thu hồi');
    expect(error.message).not.toContain('API key not valid');
  });

  it('does not classify every SDK 400 response as an invalid key', () => {
    const error = mapGeminiError({
      name: 'ApiError',
      status: 400,
      message: JSON.stringify({
        error: {
          code: 400,
          message: 'Request has an invalid schema.',
          status: 'INVALID_ARGUMENT',
        },
      }),
    });

    expect(error.message).toBe('Không thể xử lý yêu cầu Gemini');
  });

  it('sends the structured request through the installed SDK contract', async () => {
    const generateContent = jest.fn().mockResolvedValue({ text: '{"ok":true}' });
    mockedGoogleGenAI.mockImplementation(
      () => ({ models: { generateContent } } as unknown as GoogleGenAI)
    );
    const responseJsonSchema = {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
    };

    await expect(
      generateGeminiJson('test-key', {
        prompt: 'Return JSON',
        systemInstruction: 'Use JSON only',
        responseJsonSchema,
      })
    ).resolves.toBe('{"ok":true}');

    expect(mockedGoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash-lite',
      contents: 'Return JSON',
      config: {
        systemInstruction: 'Use JSON only',
        responseMimeType: 'application/json',
        responseJsonSchema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
  });

  it('disables thinking to reduce latency', async () => {
    const generateContent = jest.fn().mockResolvedValue({ text: '{"ok":true}' });
    mockedGoogleGenAI.mockImplementation(
      () => ({ models: { generateContent } } as unknown as GoogleGenAI)
    );

    await generateGeminiJson('key', {
      prompt: 'x',
      responseJsonSchema: { type: 'object' },
    });

    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ thinkingConfig: { thinkingBudget: 0 } }),
      })
    );
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
