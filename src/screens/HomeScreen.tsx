import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getProductsFromDB } from '../services/db';
import { parseVoiceTranscript } from '../services/aiParser';
import { getGeminiApiKey } from '../services/geminiSettingsService';
import { correctTranscript } from '../services/transcriptCorrection';
import { MatchedItem, PaymentMethod } from '../types';
import { DraftInvoiceModal } from '../components/DraftInvoiceModal';
import { useVoiceInvoiceRecognition, VoiceRecognitionErrorCode } from '../hooks/useVoiceInvoiceRecognition';
import { colors, typography, fontFamily } from '../theme/tokens';

const SAFE_PARSER_MESSAGES = new Set([
  'Chưa có Gemini API Key',
  'API Key không hợp lệ hoặc đã bị thu hồi',
  'Gemini đang giới hạn lượt sử dụng',
  'Không thể kết nối Gemini',
  'Gemini trả về dữ liệu không hợp lệ',
  'Không thể xử lý yêu cầu Gemini',
]);

const getSafeParserErrorMessage = (error: unknown): string =>
  error instanceof Error && SAFE_PARSER_MESSAGES.has(error.message)
    ? error.message
    : 'Không thể xử lý yêu cầu Gemini';

const RECOGNITION_ERROR_MESSAGES: Record<VoiceRecognitionErrorCode, string> = {
  'permission-denied': 'Cần quyền Microphone và Nhận dạng giọng nói để sử dụng tính năng này.',
  unavailable: 'Nhận dạng giọng nói hiện không khả dụng trên thiết bị.',
  'no-speech': 'Không nghe thấy nội dung. Vui lòng thử lại.',
  'recognition-failed': 'Không thể nhận dạng giọng nói. Vui lòng thử lại.',
};

export interface HomeScreenProps {
  onOpenSettings: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenSettings }) => {
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('chuyển khoản');
  const [draftVisible, setDraftVisible] = useState(false);
  const isMountedRef = useRef(true);
  const microphonePendingRef = useRef(false);
  const apiKeyRef = useRef<string | null>(null);
  const parserPendingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      microphonePendingRef.current = false;
      apiKeyRef.current = null;
      parserPendingRef.current = false;
    };
  }, []);

  const handleFinalTranscript = useCallback(async (alternatives: string[]) => {
    if (!isMountedRef.current) return;

    const best = (alternatives[0] ?? '').trim();
    const apiKey = apiKeyRef.current;
    apiKeyRef.current = null;

    if (!best || !apiKey || parserPendingRef.current) return;

    const products = getProductsFromDB();
    setTranscript(correctTranscript(best, products));
    setLoading(true);
    parserPendingRef.current = true;

    try {
      const result = await parseVoiceTranscript(alternatives, products, apiKey);
      if (!isMountedRef.current) return;

      const mappedItems: MatchedItem[] = result.matched_items.map((item) => {
        const prod = products.find((p) => p.id === item.product_id);
        const unit_price = prod ? prod.unit_price : 0;
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit: item.unit,
          unit_price,
          amount: item.quantity * unit_price,
          confidence: item.confidence,
        };
      });

      setMatchedItems(mappedItems);
      setPaymentMethod(result.payment_method || 'chuyển khoản');
      setDraftVisible(true);
    } catch (err: unknown) {
      if (isMountedRef.current) {
        Alert.alert(
          'Lỗi phân tích AI',
          getSafeParserErrorMessage(err)
        );
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        parserPendingRef.current = false;
      }
    }
  }, []);

  const handleRecognitionError = useCallback((code: VoiceRecognitionErrorCode) => {
    apiKeyRef.current = null;
    if (!isMountedRef.current) return;
    Alert.alert('Lỗi nhận dạng giọng nói', RECOGNITION_ERROR_MESSAGES[code]);
  }, []);

  const productContextStrings = React.useMemo(() => {
    try {
      const products = getProductsFromDB();
      return products.flatMap((p) => {
        const aliases = p.aliases
          ? p.aliases
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean)
          : [];
        return [p.name, ...aliases];
      });
    } catch {
      return [];
    }
  }, []);

  const recognition = useVoiceInvoiceRecognition({
    onFinalTranscript: handleFinalTranscript,
    onError: handleRecognitionError,
    contextualStrings: productContextStrings,
  });

  const handleMicrophonePress = async () => {
    if (loading) return;
    if (recognition.status === 'listening') {
      recognition.stop();
      return;
    }
    if (recognition.status !== 'idle' || microphonePendingRef.current) return;

    microphonePendingRef.current = true;
    try {
      const apiKey = await getGeminiApiKey();
      if (!isMountedRef.current) return;
      if (!apiKey) {
        Alert.alert(
          'Chưa có Gemini API Key',
          'Hãy thêm API Key để VoiceBill có thể phân tích hóa đơn.',
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Mở Cài đặt', onPress: onOpenSettings },
          ]
        );
        return;
      }
      apiKeyRef.current = apiKey;
      await recognition.start();
    } catch {
      if (isMountedRef.current) {
        Alert.alert(
          'Không thể đọc API Key',
          'Hãy mở Cài đặt và lưu lại Gemini API Key.'
        );
      }
    } finally {
      microphonePendingRef.current = false;
    }
  };

  const visibleTranscript = recognition.interimTranscript || transcript;
  const isListening = recognition.status === 'listening' || recognition.status === 'stopping';
  const isRequesting = recognition.status === 'requesting-permission';

  // Đồng hồ thời gian ghi âm (mm:ss)
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!isListening) {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isListening]);
  const recordingTime = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
    seconds % 60
  ).padStart(2, '0')}`;

  // Vòng sáng pulse quanh nút micro (chạy liên tục)
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const handleGuide = () => {
    Alert.alert(
      'Hướng dẫn nhanh',
      'Chạm nút micro và nói đơn hàng, ví dụ: "2 phở bò, 1 trà đá, chuyển khoản". VoiceBill sẽ tự tạo hóa đơn nháp để bạn kiểm tra.'
    );
  };

  let statusText = 'Chạm để bắt đầu bán hàng';
  if (isRequesting) statusText = 'Đang xin quyền...';
  else if (isListening) statusText = 'Đang lắng nghe...';
  else if (loading) statusText = 'Đang xử lý...';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.logoBox}>
            <MaterialIcons name="mic" size={20} color={colors.primary} />
          </View>
          <Text style={styles.brandName}>VoiceBill</Text>
        </View>
        <View style={styles.avatar}>
          <MaterialIcons name="person" size={24} color={colors.onSurfaceVariant} />
        </View>
      </View>

      <View style={styles.body}>
        {/* Status & AI Mode */}
        <View style={styles.statusRow}>
          <View style={styles.modeBadge}>
            <View style={styles.modeDot} />
            <Text style={styles.modeText}>CHẾ ĐỘ AI</Text>
          </View>
          <TouchableOpacity style={styles.guideBtn} onPress={handleGuide}>
            <MaterialIcons name="help-outline" size={20} color={colors.onSurfaceVariant} />
            <Text style={styles.guideText}>Hướng dẫn</Text>
          </TouchableOpacity>
        </View>

        {/* Immersive Hero */}
        <View style={styles.hero}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulseRing,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
              },
            ]}
          />
          <TouchableOpacity
            testID="voice-microphone-button"
            activeOpacity={0.9}
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPress={handleMicrophonePress}
          >
            <MaterialIcons name={isListening ? 'stop' : 'mic'} size={72} color={colors.white} />
          </TouchableOpacity>
          <Text style={[styles.statusText, (isListening || loading) && styles.statusTextActive]}>
            {statusText}
          </Text>
          {loading && <ActivityIndicator color={colors.primaryContainer} style={{ marginTop: 8 }} />}
        </View>

        {/* Live Transcript (glass) */}
        <View style={styles.transcriptCard}>
          <View style={styles.transcriptHeader}>
            <Text style={styles.transcriptLabel}>BẢN DỊCH TRỰC TIẾP</Text>
            {isListening ? (
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTime}>{recordingTime}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.transcriptBody}>
            {visibleTranscript ? (
              <Text style={styles.transcriptText}>{visibleTranscript}</Text>
            ) : (
              <Text style={styles.transcriptPlaceholder}>“Nhấn để bắt đầu nói...”</Text>
            )}
          </View>
        </View>
      </View>

      <DraftInvoiceModal
        visible={draftVisible}
        items={matchedItems}
        paymentMethod={paymentMethod}
        onClose={() => setDraftVisible(false)}
        onSuccess={() => setTranscript('')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slateBg },
  // Header
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariantSoft,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { ...typography.headlineMd, color: colors.primary },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  // Body
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: colors.primaryContainerFaint,
    borderWidth: 1,
    borderColor: colors.primaryContainerBorder,
  },
  modeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primaryContainer },
  modeText: { fontFamily: fontFamily.interBold, fontSize: 11, color: colors.primaryContainer, letterSpacing: 1.5 },
  guideBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  guideText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  // Hero
  hero: { alignItems: 'center', justifyContent: 'center', paddingTop: 24, paddingBottom: 8 },
  pulseRing: {
    position: 'absolute',
    top: 24,
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: colors.primaryContainer,
  },
  micButton: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 12,
  },
  micButtonActive: { transform: [{ scale: 1.06 }] },
  statusText: { ...typography.headlineLgMobile, color: colors.onSurface, marginTop: 16, textAlign: 'center' },
  statusTextActive: { color: colors.primaryContainer },
  // Transcript (glass)
  transcriptCard: {
    backgroundColor: colors.glassSurface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 2,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.primaryContainerFaint,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryContainerBorder,
  },
  transcriptLabel: { fontFamily: fontFamily.interBold, fontSize: 11, color: colors.primaryContainer, letterSpacing: 1.5 },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.errorCrimson },
  recordingTime: { fontFamily: fontFamily.interBold, fontSize: 14, color: colors.errorCrimson },
  transcriptBody: { minHeight: 160, alignItems: 'center', justifyContent: 'center', padding: 32 },
  transcriptText: { fontFamily: fontFamily.jakartaMedium, fontSize: 24, lineHeight: 32, color: colors.onSurface, textAlign: 'center' },
  transcriptPlaceholder: { fontFamily: fontFamily.jakartaMedium, fontSize: 24, lineHeight: 32, color: colors.onSurfaceVariant, textAlign: 'center' },
});
