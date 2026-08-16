import * as SecureStore from 'expo-secure-store';
import {
  deleteGeminiApiKey,
  getGeminiApiKey,
  saveGeminiApiKey,
} from '../src/services/geminiSettingsService';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('geminiSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a blank key without writing to Secure Store', async () => {
    await expect(saveGeminiApiKey('   ')).rejects.toThrow(
      'Vui lòng nhập Gemini API Key'
    );
    expect(mockedSecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('trims and stores a non-empty key', async () => {
    await saveGeminiApiKey('  test-key  ');
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'voicebill.geminiApiKey',
      'test-key'
    );
  });

  it('reads the stored key', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('stored-key');
    await expect(getGeminiApiKey()).resolves.toBe('stored-key');
  });

  it('deletes the stored key', async () => {
    await deleteGeminiApiKey();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'voicebill.geminiApiKey'
    );
  });
});
