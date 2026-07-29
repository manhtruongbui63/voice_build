import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getProductsFromDB } from '../services/db';
import { parseVoiceTranscript } from '../services/aiParser';
import { getGeminiApiKey } from '../services/geminiSettingsService';
import { MatchedItem } from '../types';
import { DraftInvoiceModal } from '../components/DraftInvoiceModal';

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

export interface HomeScreenProps {
  onOpenSettings: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenSettings }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [draftVisible, setDraftVisible] = useState(false);
  const isMountedRef = useRef(true);
  const microphonePendingRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      microphonePendingRef.current = false;
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, []);

  const handleSimulatedVoiceTest = async (
    testVoiceString: string,
    apiKey: string
  ) => {
    if (!isMountedRef.current) return;

    setTranscript(testVoiceString);
    setLoading(true);

    try {
      const products = getProductsFromDB();
      const result = await parseVoiceTranscript(testVoiceString, products, apiKey);
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
      setDraftVisible(true);
    } catch (err: unknown) {
      if (isMountedRef.current) {
        Alert.alert(
          'Lỗi phân tích AI',
          getSafeParserErrorMessage(err)
        );
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleMicrophonePress = async () => {
    if (microphonePendingRef.current || isRecording || loading) return;

    microphonePendingRef.current = true;
    let recordingScheduled = false;
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

      setIsRecording(true);
      recordingTimerRef.current = setTimeout(() => {
        recordingTimerRef.current = null;
        if (!isMountedRef.current) {
          microphonePendingRef.current = false;
          return;
        }

        setIsRecording(false);
        void handleSimulatedVoiceTest(
          'bán cho chị 1kg ST, à không lấy 2kg ST với 2 cân rưỡi Bắc Hướng',
          apiKey
        ).finally(() => {
          microphonePendingRef.current = false;
        });
      }, 2500);
      recordingScheduled = true;
    } catch {
      if (isMountedRef.current) {
        Alert.alert(
          'Không thể đọc API Key',
          'Hãy mở Cài đặt và lưu lại Gemini API Key.'
        );
      }
    } finally {
      if (!recordingScheduled) {
        microphonePendingRef.current = false;
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VOICE BILLING</Text>
      <Text style={styles.subtitle}>Nhấn Nút Micro Để Nói Khẩu Lệnh Bán Hàng</Text>

      <TouchableOpacity
        testID="voice-microphone-button"
        style={[styles.micBtn, isRecording && styles.recordingActive]}
        onPress={handleMicrophonePress}
      >
        <Text style={styles.micText}>{isRecording ? '🔴 Đang Nghe...' : '🎙️'}</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 20 }} />}

      {transcript ? (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptTitle}>Văn bản vừa đọc:</Text>
          <Text style={styles.transcriptContent}>"{transcript}"</Text>
        </View>
      ) : null}

      <DraftInvoiceModal
        visible={draftVisible}
        items={matchedItems}
        onClose={() => setDraftVisible(false)}
        onSuccess={() => setTranscript('')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, marginBottom: 40 },
  micBtn: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  recordingActive: { backgroundColor: '#EF4444' },
  micText: { fontSize: 32, color: '#FFF', fontWeight: 'bold' },
  transcriptBox: { marginTop: 30, backgroundColor: '#FFF', padding: 16, borderRadius: 10, width: '100%', elevation: 2 },
  transcriptTitle: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  transcriptContent: { fontSize: 16, color: '#1F2937', marginTop: 4, fontStyle: 'italic' },
});
