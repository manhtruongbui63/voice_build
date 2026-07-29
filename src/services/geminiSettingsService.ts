import * as SecureStore from 'expo-secure-store';

const GEMINI_API_KEY_STORAGE_KEY = 'voicebill.geminiApiKey';

export const getGeminiApiKey = (): Promise<string | null> =>
  SecureStore.getItemAsync(GEMINI_API_KEY_STORAGE_KEY);

export const saveGeminiApiKey = async (apiKey: string): Promise<void> => {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error('Vui lòng nhập Gemini API Key');
  }
  await SecureStore.setItemAsync(GEMINI_API_KEY_STORAGE_KEY, trimmedKey);
};

export const deleteGeminiApiKey = (): Promise<void> =>
  SecureStore.deleteItemAsync(GEMINI_API_KEY_STORAGE_KEY);

export { validateGeminiApiKey } from './geminiClient';
