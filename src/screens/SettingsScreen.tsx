import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  deleteGeminiApiKey,
  getGeminiApiKey,
  saveGeminiApiKey,
  validateGeminiApiKey,
} from '../services/geminiSettingsService';

export const SettingsScreen: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const storageStateVersion = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const loadStoredKey = async () => {
      const loadVersion = storageStateVersion.current;

      try {
        const storedKey = await getGeminiApiKey();
        if (!isMounted || loadVersion !== storageStateVersion.current) return;

        setHasStoredKey(Boolean(storedKey));
        if (storedKey) setMessage('Đã kết nối');
      } catch {
        if (!isMounted || loadVersion !== storageStateVersion.current) return;

        setIsError(true);
        setMessage('Không thể tải API Key đã lưu');
      }
    };

    void loadStoredKey();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async () => {
    const trimmedKey = apiKey.trim();
    setIsSaving(true);
    setIsError(false);
    setMessage('');

    try {
      await validateGeminiApiKey(trimmedKey);
      await saveGeminiApiKey(trimmedKey);
      storageStateVersion.current += 1;
      setApiKey('');
      setHasStoredKey(true);
      setMessage('Đã kết nối');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Không thể xử lý yêu cầu Gemini');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Xóa API Key',
      'VoiceBill sẽ không thể phân tích hóa đơn bằng AI cho đến khi bạn thêm key mới.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGeminiApiKey();
              storageStateVersion.current += 1;
              setApiKey('');
              setHasStoredKey(false);
              setIsError(false);
              setMessage('Đã xóa API Key');
            } catch (error) {
              setIsError(true);
              setMessage(error instanceof Error ? error.message : 'Không thể xử lý yêu cầu Gemini');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cài đặt Gemini</Text>
      <Text style={styles.description}>
        Tạo API key trong Google AI Studio rồi dán vào đây. Key chỉ được lưu trong Keychain trên thiết bị này.
      </Text>
      <TextInput
        testID="gemini-api-key-input"
        value={apiKey}
        onChangeText={setApiKey}
        placeholder={hasStoredKey ? 'Nhập key mới để thay thế' : 'Dán Gemini API Key'}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={styles.input}
      />
      <TouchableOpacity
        disabled={isSaving}
        onPress={handleSave}
        style={[styles.primaryButton, isSaving && styles.disabledButton]}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.primaryText}>Kiểm tra &amp; Lưu</Text>
        )}
      </TouchableOpacity>
      {message ? <Text style={isError ? styles.errorText : styles.successText}>{message}</Text> : null}
      {hasStoredKey ? (
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
          <Text style={styles.deleteText}>Xóa API Key</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  primaryButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  successText: {
    color: '#059669',
    marginTop: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    marginTop: 14,
    fontWeight: '600',
  },
  deleteButton: {
    marginTop: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
