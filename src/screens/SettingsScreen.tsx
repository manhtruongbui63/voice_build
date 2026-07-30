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
  getDefaultPaymentMethod,
  setDefaultPaymentMethod,
} from '../services/geminiSettingsService';
import { PaymentMethod } from '../types';
import { colors } from '../theme/tokens';

const SAFE_VALIDATION_MESSAGES = new Set<string>([
  'Vui lòng nhập Gemini API Key',
  'API Key không hợp lệ hoặc đã bị thu hồi',
  'Gemini đang giới hạn lượt sử dụng',
  'Không thể kết nối Gemini',
  'Không thể xử lý yêu cầu Gemini',
]);

const getSafeSaveErrorMessage = (error: unknown): string =>
  error instanceof Error && SAFE_VALIDATION_MESSAGES.has(error.message)
    ? error.message
    : 'Không thể kiểm tra hoặc lưu API Key';

export const SettingsScreen: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('chuyển khoản');
  const storageStateVersion = useRef(0);
  const operationLock = useRef(false);
  const isOperationPending = isSaving || isDeleting;

  useEffect(() => {
    let isMounted = true;

    const loadStoredKey = async () => {
      const loadVersion = storageStateVersion.current;

      try {
        const storedKey = await getGeminiApiKey();
        const storedMethod = await getDefaultPaymentMethod();
        if (!isMounted || loadVersion !== storageStateVersion.current) return;

        setHasStoredKey(Boolean(storedKey));
        setPaymentMethod(storedMethod);
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
    if (operationLock.current) return;

    const trimmedKey = apiKey.trim();
    operationLock.current = true;
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
      setMessage(getSafeSaveErrorMessage(error));
    } finally {
      operationLock.current = false;
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (operationLock.current) return;

    Alert.alert(
      'Xóa API Key',
      'VoiceBill sẽ không thể phân tích hóa đơn bằng AI cho đến khi bạn thêm key mới.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            if (operationLock.current) return;

            operationLock.current = true;
            setIsDeleting(true);
            try {
              await deleteGeminiApiKey();
              storageStateVersion.current += 1;
              setApiKey('');
              setHasStoredKey(false);
              setIsError(false);
              setMessage('Đã xóa API Key');
            } catch {
              setIsError(true);
              setMessage('Không thể xóa API Key');
            } finally {
              operationLock.current = false;
              setIsDeleting(false);
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
        disabled={isOperationPending}
        onPress={handleSave}
        style={[styles.primaryButton, isOperationPending && styles.disabledButton]}
      >
        {isSaving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryText}>Kiểm tra &amp; Lưu</Text>
        )}
      </TouchableOpacity>
      {message ? <Text style={isError ? styles.errorText : styles.successText}>{message}</Text> : null}
      {hasStoredKey ? (
        <TouchableOpacity
          disabled={isOperationPending}
          onPress={handleDelete}
          style={[styles.deleteButton, isOperationPending && styles.disabledButton]}
        >
          <Text style={styles.deleteText}>Xóa API Key</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.separator} />
      
      <Text style={styles.title}>Thanh toán mặc định</Text>
      <Text style={styles.description}>
        Sẽ được áp dụng nếu AI không nhận diện được phương thức trong câu nói.
      </Text>
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segment, paymentMethod === 'tiền mặt' && styles.segmentActive]}
          onPress={() => {
            setPaymentMethod('tiền mặt');
            setDefaultPaymentMethod('tiền mặt');
          }}
        >
          <Text style={[styles.segmentText, paymentMethod === 'tiền mặt' && styles.segmentTextActive]}>
            Tiền mặt
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, paymentMethod === 'chuyển khoản' && styles.segmentActive]}
          onPress={() => {
            setPaymentMethod('chuyển khoản');
            setDefaultPaymentMethod('chuyển khoản');
          }}
        >
          <Text style={[styles.segmentText, paymentMethod === 'chuyển khoản' && styles.segmentTextActive]}>
            Chuyển khoản
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral50,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.neutral900,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.neutral500,
    marginBottom: 24,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral300,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.neutral900,
  },
  primaryButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  successText: {
    color: colors.primaryActive,
    marginTop: 14,
    fontWeight: '600',
  },
  errorText: {
    color: colors.errorCrimson,
    marginTop: 14,
    fontWeight: '600',
  },
  deleteButton: {
    marginTop: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteText: {
    color: colors.errorCrimson,
    fontSize: 15,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: colors.neutral200,
    marginVertical: 24,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.neutral200,
    borderRadius: 8,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 15,
    color: colors.neutral500,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: colors.neutral900,
    fontWeight: 'bold',
  },
});
