import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getProductsFromDB } from '../services/db';
import { parseVoiceTranscript } from '../services/aiParser';
import { localFastParse } from '../services/localInvoiceParser';
import { getGeminiApiKey } from '../services/geminiSettingsService';
import { correctTranscript } from '../services/transcriptCorrection';
import { AIParsingResult, MatchedItem, PaymentMethod, Product } from '../types';
import { DraftInvoiceModal } from '../components/DraftInvoiceModal';
import { TabletInvoicePanel } from '../components/TabletInvoicePanel';
import { RunningBorder } from '../components/RunningBorder';
import { Toast } from '../components/Toast';
import { useInvoiceDraft } from '../hooks/useInvoiceDraft';
import { useVoiceInvoiceRecognition, VoiceRecognitionErrorCode } from '../hooks/useVoiceInvoiceRecognition';
import { buildTranscriptSegments } from '../utils/transcriptHighlight';
import { colors, fontFamily } from '../theme/tokens';

// Gợi ý câu lệnh hiện chưa hoạt động — tạm ẩn UI, sẽ bật lại sau.
const SHOW_COMMAND_SUGGESTIONS = false;

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
  const { width } = useWindowDimensions();
  const isTablet = width >= 1024; // Tablet ngang (iPad landscape) dùng layout gộp 1 màn.
  const draft = useInvoiceDraft();

  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('chuyển khoản');
  const [draftVisible, setDraftVisible] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
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

  const finalizeResult = useCallback(
    (result: AIParsingResult, products: Product[]) => {
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

      // Không nhận diện được sản phẩm nào → cảnh báo và ở lại màn giọng nói.
      if (mappedItems.length === 0) {
        setWarningVisible(true);
        return;
      }

      if (isTablet) {
        // Layout tablet: cộng dồn thẳng vào panel hóa đơn, không mở modal.
        draft.addItems(mappedItems);
        if (result.payment_method) draft.setPaymentMethod(result.payment_method);
        return;
      }

      setMatchedItems(mappedItems);
      setPaymentMethod(result.payment_method || 'chuyển khoản');
      setDraftVisible(true);
    },
    [isTablet, draft]
  );

  const handleFinalTranscript = useCallback(
    async (alternatives: string[]) => {
      if (!isMountedRef.current) return;

      const best = (alternatives[0] ?? '').trim();
      const apiKey = apiKeyRef.current;
      apiKeyRef.current = null;

      if (!best || !apiKey || parserPendingRef.current) return;

      const perfStart = Date.now();
      const products = getProductsFromDB();
      setTranscript(correctTranscript(best, products));

      // Đường nhanh cục bộ: chỉ dùng khi phân tích chắc chắn tuyệt đối (không gọi mạng).
      const fast = localFastParse(alternatives, products);
      if (fast) {
        console.log(`[VoiceBill][perf] fast-path (không gọi AI): ${Date.now() - perfStart}ms`);
        finalizeResult(fast, products);
        return;
      }

      setLoading(true);
      parserPendingRef.current = true;

      try {
        const result = await parseVoiceTranscript(alternatives, products, apiKey);
        console.log(`[VoiceBill][perf] Gemini xử lý: ${Date.now() - perfStart}ms`);
        if (!isMountedRef.current) return;
        finalizeResult(result, products);
      } catch (err: unknown) {
        if (isMountedRef.current) {
          Alert.alert('Lỗi phân tích AI', getSafeParserErrorMessage(err));
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          parserPendingRef.current = false;
        }
      }
    },
    [finalizeResult]
  );

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
    // Bắt đầu một hóa đơn mới: xóa transcript và kết quả của lần nhập trước.
    setTranscript('');
    setMatchedItems([]);
    setWarningVisible(false);
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

  let statusText = 'Chạm để bắt đầu bán hàng';
  if (isRequesting) statusText = 'Đang xin quyền...';
  else if (isListening) statusText = 'Đang lắng nghe...';
  else if (loading) statusText = 'Đang xử lý...';
  const listeningTranscript = visibleTranscript;
  const highlightKeywords = React.useMemo(
    () => [
      ...productContextStrings,
      ...matchedItems.map((item) => item.product_name),
      ...matchedItems.map((item) => item.unit),
    ],
    [productContextStrings, matchedItems]
  );
  const transcriptSegments = React.useMemo(
    () => buildTranscriptSegments(listeningTranscript, highlightKeywords),
    [listeningTranscript, highlightKeywords]
  );

  const renderVoiceHero = () => (
    <View style={styles.hero}>
      <View testID="voice-microphone-stage" style={styles.micStage}>
        <Animated.View
          testID="voice-pulse-ring-outer"
          pointerEvents="none"
          style={[
            styles.pulseRingOuter,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.12] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) }],
            },
          ]}
        />
        <Animated.View
          testID="voice-pulse-ring-middle"
          pointerEvents="none"
          style={[
            styles.pulseRingMid,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0.25] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.05] }) }],
            },
          ]}
        />
        <TouchableOpacity
          testID="voice-microphone-button"
          activeOpacity={0.9}
          style={[styles.micButton, isListening && styles.micButtonActive]}
          onPress={handleMicrophonePress}
        >
          <MaterialIcons
            name={isListening ? 'stop' : 'mic'}
            size={64}
            color={isListening ? colors.errorCrimson : colors.secondary}
          />
        </TouchableOpacity>
      </View>
      <Text style={styles.statusText}>{statusText.toLocaleUpperCase('vi-VN')}</Text>
      {loading && <ActivityIndicator color={colors.primaryContainer} style={{ marginTop: 8 }} />}
    </View>
  );

  const renderTranscript = () => (
    <View testID="voice-transcript-card" style={styles.transcriptCard}>
      <View style={styles.transcriptAccent} />
      <View style={styles.transcriptBody}>
        {listeningTranscript ? (
          <Text testID="voice-transcript-text" style={styles.transcriptText}>
            <Text>"</Text>
            {transcriptSegments.map((segment, index) => (
              <Text key={index} style={segment.keyword ? styles.transcriptKeyword : undefined}>
                {segment.text}
              </Text>
            ))}
            {isListening ? <Text style={styles.caret}>▌</Text> : null}
            <Text>"</Text>
          </Text>
        ) : (
          <Text style={styles.transcriptPlaceholder}>“Nhấn để bắt đầu nói...”</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {isTablet ? (
        <View testID="home-tablet-layout" style={styles.tabletRow}>
          <View style={styles.tabletVoiceCol}>
            <RunningBorder radius={16} />
            {renderVoiceHero()}
            {renderTranscript()}
          </View>
          <View style={styles.tabletInvoiceCol}>
            <TabletInvoicePanel draft={draft} onSaved={() => setTranscript('')} />
          </View>
        </View>
      ) : (
        <ScrollView
          testID="home-scroll-body"
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {renderVoiceHero()}
          {renderTranscript()}
        </ScrollView>
      )}

      <Toast
        visible={warningVisible}
        variant="warning"
        title="Không nhận diện được sản phẩm nào. Vui lòng nói lại."
        onClose={() => setWarningVisible(false)}
      />

      {!isTablet ? (
        <DraftInvoiceModal
          visible={draftVisible}
          items={matchedItems}
          paymentMethod={paymentMethod}
          onClose={() => setDraftVisible(false)}
          onSuccess={() => setTranscript('')}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6FAFF' },
  // Tablet split layout (≥1024px)
  tabletRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  tabletVoiceCol: {
    width: '40%',
    borderRadius: 16,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  tabletInvoiceCol: {
    flex: 1,
  },
  // Body
  body: { flex: 1 },
  bodyContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  // Hero
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 18,
  },
  micStage: {
    width: 256,
    height: 256,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRingOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: 'rgba(50, 139, 193, 0.14)',
  },
  pulseRingMid: {
    position: 'absolute',
    top: 36,
    left: 36,
    width: 184,
    height: 184,
    borderRadius: 92,
    backgroundColor: 'rgba(50, 139, 193, 0.2)',
  },
  micButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#001E30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#328BC1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 12,
  },
  micButtonActive: { transform: [{ scale: 0.95 }] },
  statusText: {
    fontFamily: fontFamily.interBold,
    fontSize: 14,
    letterSpacing: 3,
    lineHeight: 20,
    color: '#7583AD',
    marginTop: 4,
    marginBottom: 0,
    textAlign: 'center',
  },
  // Transcript (glass)
  transcriptCard: {
    width: '100%',
    minHeight: 188,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C5C6CF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 5,
    marginBottom: 28,
  },
  transcriptAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#328BC1',
  },
  transcriptBody: {
    minHeight: 186,
    paddingHorizontal: 32,
    paddingTop: 36,
    paddingBottom: 28,
  },
  transcriptText: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 16,
    lineHeight: 32,
    color: colors.primary,
  },
  transcriptKeyword: {
    fontFamily: fontFamily.jakartaBold,
    color: colors.secondary,
  },
  caret: {
    color: '#328BC1',
  },
  transcriptPlaceholder: {
    fontFamily: fontFamily.jakartaMedium,
    fontSize: 20,
    lineHeight: 28,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  suggestionsFooter: {
    width: '100%',
  },
  suggestionsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  suggestionsTitle: {
    fontFamily: fontFamily.interMedium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurfaceVariant,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#C5C6CF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(201, 230, 255, 0.1)',
  },
  suggestionText: {
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
  },
});
