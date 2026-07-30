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

import { PaymentMethod } from '../types';

const PAYMENT_METHOD_STORAGE_KEY = 'voicebill.defaultPaymentMethod';

export const getDefaultPaymentMethod = async (): Promise<PaymentMethod> => {
  try {
    const method = await SecureStore.getItemAsync(PAYMENT_METHOD_STORAGE_KEY);
    return (method as PaymentMethod) || 'chuyển khoản';
  } catch {
    return 'chuyển khoản';
  }
};

export const setDefaultPaymentMethod = async (method: PaymentMethod): Promise<void> => {
  await SecureStore.setItemAsync(PAYMENT_METHOD_STORAGE_KEY, method);
};
