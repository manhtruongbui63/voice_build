import { GoogleGenAI } from '@google/genai';
import { Product, AIParsingResult } from '../types';

export const buildGeminiSystemInstruction = (products: Product[]): string => {
  const catalogList = products.map((p) => ({
    id: p.id,
    name: p.name,
    aliases: p.aliases ? p.aliases.split(',').map((a) => a.trim()) : [],
    unit: p.unit,
  }));

  return `Bạn là trợ lý AI thông minh cho ứng dụng bán lẻ VoiceBill. Nhiệm vụ của bạn là bóc tách thông tin sản phẩm và số lượng từ văn bản giọng nói tiếng Việt của người bán hàng.

DANH SÁCH SẢN PHẨM HỢP LỆ (AVAILABLE PRODUCTS):
${JSON.stringify(catalogList, null, 2)}

QUY TẮC BẮT BUỘC:
1. BẠN CHỈ ĐƯỢC PHÉP KHỚP VỚI CÁC SẢN PHẨM TRONG DANH SÁCH CÓ SẴN Ở TRÊN (Dựa vào field 'name' hoặc 'aliases').
2. XỬ LÝ ĐÍNH CHÍNH / SỬA KHẨU LỆNH:
   - Nếu xuất hiện các từ đính chính như "à không", "thôi bỏ", "nhầm", "sửa thành", hãy cập nhật lại số lượng mới hoặc loại bỏ sản phẩm đứng trước đó.
3. QUY ĐỔI ĐẠI LƯỢNG SỐ LƯỢNG TIẾNG VIỆT:
   - "nửa cân", "nửa ký" -> 0.5
   - "lạng" -> 0.1
   - "yến" -> 10
   - "tạ" -> 100
   - "chục cân" -> 10
   - "cân", "ký", "kg", "kí", "quả", "túi" -> quy đổi ra số thực (ví dụ "2 cân rưỡi" -> 2.5).
4. CHỈ SỐ TIN CẬY (CONFIDENCE):
   - Trả về 'confidence' từ 0.0 đến 1.0 cho mỗi sản phẩm.
   - Nếu từ đọc bị lệch âm nhẹ (ví dụ "Bắc Hướng" -> "Bắc Hương"), gán confidence = 0.6.
5. Trả về đúng định dạng JSON Schema yêu cầu.`;
};

export const parseAIResponse = (responseText: string): AIParsingResult => {
  try {
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    return {
      matched_items: parsed.matched_items || [],
      unmatched_text: parsed.unmatched_text || [],
    };
  } catch (error) {
    console.error('Failed to parse Gemini AI JSON response:', error);
    return { matched_items: [], unmatched_text: [responseText] };
  }
};

export const parseVoiceTranscript = async (
  transcript: string,
  products: Product[],
  apiKey: string
): Promise<AIParsingResult> => {
  if (!apiKey) {
    throw new Error('Chưa cài đặt Gemini API Key trong Cài đặt.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const systemInstruction = buildGeminiSystemInstruction(products);

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: `Ghi âm giọng nói người dùng: "${transcript}"` }] }],
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
    },
  });

  return parseAIResponse(response.text || '{}');
};
