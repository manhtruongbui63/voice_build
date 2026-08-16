import * as SecureStore from 'expo-secure-store';

export type CurrencyFormat = 'symbol' | 'code';

export interface StoreProfile {
  name: string;
  phone: string;
  address: string;
}

const STORE_PROFILE_STORAGE_KEY = 'voicebill.storeProfile';
const CURRENCY_FORMAT_STORAGE_KEY = 'voicebill.currencyFormat';

const DEFAULT_PROFILE: StoreProfile = { name: '', phone: '', address: '' };

export const getStoreProfile = async (): Promise<StoreProfile> => {
  try {
    const raw = await SecureStore.getItemAsync(STORE_PROFILE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw) as Partial<StoreProfile>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      address: typeof parsed.address === 'string' ? parsed.address : '',
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
};

export const saveStoreProfile = async (profile: StoreProfile): Promise<void> => {
  await SecureStore.setItemAsync(STORE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
};

export const getCurrencyFormat = async (): Promise<CurrencyFormat> => {
  try {
    const value = await SecureStore.getItemAsync(CURRENCY_FORMAT_STORAGE_KEY);
    return value === 'code' ? 'code' : 'symbol';
  } catch {
    return 'symbol';
  }
};

export const saveCurrencyFormat = async (format: CurrencyFormat): Promise<void> => {
  await SecureStore.setItemAsync(CURRENCY_FORMAT_STORAGE_KEY, format);
};

// Định dạng số tiền mẫu theo lựa chọn hiển thị.
export const formatCurrencyPreview = (value: number, format: CurrencyFormat): string =>
  format === 'code'
    ? `${value.toLocaleString('en-US')} VND`
    : `${value.toLocaleString('vi-VN')} đ`;
