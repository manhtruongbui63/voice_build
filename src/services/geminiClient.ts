import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = 'gemini-3.5-flash-lite' as const;

export interface GeminiRequest {
  prompt: string;
  systemInstruction?: string;
  responseJsonSchema: Record<string, unknown>;
}

export type GeminiJsonGenerator = (
  apiKey: string,
  request: GeminiRequest
) => Promise<string>;

const hasInvalidApiKeyReason = (message?: string): boolean => {
  if (!message) return false;
  try {
    const body: unknown = JSON.parse(message);
    if (!body || typeof body !== 'object') return false;
    const error = (body as Record<string, unknown>).error;
    if (!error || typeof error !== 'object') return false;
    const details = (error as Record<string, unknown>).details;
    return (
      Array.isArray(details) &&
      details.some(
        (detail) =>
          !!detail &&
          typeof detail === 'object' &&
          (detail as Record<string, unknown>).reason === 'API_KEY_INVALID'
      )
    );
  } catch {
    return false;
  }
};

export const mapGeminiError = (error: unknown): Error => {
  const candidate = error as {
    status?: number;
    name?: string;
    message?: string;
  };

  if (candidate.status === 401 || candidate.status === 403) {
    return new Error('API Key không hợp lệ hoặc đã bị thu hồi');
  }
  if (
    candidate.name === 'ApiError' &&
    candidate.status === 400 &&
    hasInvalidApiKeyReason(candidate.message)
  ) {
    return new Error('API Key không hợp lệ hoặc đã bị thu hồi');
  }
  if (candidate.status === 429) {
    return new Error('Gemini đang giới hạn lượt sử dụng');
  }
  if (
    candidate.name === 'TypeError' ||
    candidate.message?.toLowerCase().includes('network')
  ) {
    return new Error('Không thể kết nối Gemini');
  }
  return new Error('Không thể xử lý yêu cầu Gemini');
};

export const generateGeminiJson: GeminiJsonGenerator = async (
  apiKey,
  request
) => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: request.prompt,
      config: {
        systemInstruction: request.systemInstruction,
        responseMimeType: 'application/json',
        responseJsonSchema: request.responseJsonSchema,
      },
    });
    if (!response.text) {
      throw new Error('empty Gemini response');
    }
    return response.text;
  } catch (error) {
    throw mapGeminiError(error);
  }
};

export const validateGeminiApiKey = async (
  apiKey: string,
  generate: GeminiJsonGenerator = generateGeminiJson
): Promise<void> => {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error('Vui lòng nhập Gemini API Key');
  }
  await generate(trimmedKey, {
    prompt: 'Trả về JSON có trường ok bằng true.',
    responseJsonSchema: {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false,
    },
  });
};
