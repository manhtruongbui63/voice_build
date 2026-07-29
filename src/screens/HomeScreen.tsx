import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getProductsFromDB } from '../services/db';
import { parseVoiceTranscript } from '../services/aiParser';
import { MatchedItem } from '../types';
import { DraftInvoiceModal } from '../components/DraftInvoiceModal';

export const HomeScreen: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [draftVisible, setDraftVisible] = useState(false);

  // Gemini API Key retrieved from process environment or settings
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

  const handleSimulatedVoiceTest = async (testVoiceString: string) => {
    setTranscript(testVoiceString);
    setLoading(true);

    try {
      const products = getProductsFromDB();
      const result = await parseVoiceTranscript(testVoiceString, products, apiKey);

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
    } catch (err: any) {
      Alert.alert('Lỗi phân tích AI', err.message || 'Không thể gọi Gemini API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VOICE BILLING</Text>
      <Text style={styles.subtitle}>Nhấn Nút Micro Để Nói Khẩu Lệnh Bán Hàng</Text>

      <TouchableOpacity
        style={[styles.micBtn, isRecording && styles.recordingActive]}
        onPress={() => {
          setIsRecording(!isRecording);
          if (!isRecording) {
            setTimeout(() => {
              setIsRecording(false);
              handleSimulatedVoiceTest('bán cho chị 1kg ST, à không lấy 2kg ST với 2 cân rưỡi Bắc Hướng');
            }, 2500);
          }
        }}
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
