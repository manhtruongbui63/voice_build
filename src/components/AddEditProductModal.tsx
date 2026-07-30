import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Product } from '../types';
import { colors, typography, fontFamily } from '../theme/tokens';

interface Props {
  visible: boolean;
  product?: Product | null;
  onClose: () => void;
  onSave: (name: string, aliases: string, unit: string, price: number) => void;
}

const UNITS = ['kg', 'Túi', 'Bao', 'Hộp', 'Chai', 'Lon', 'Gói'];

/** Gộp "tên viết tắt" + danh sách alias thành một chuỗi aliases, khử trùng lặp. */
const mergeAliases = (shortName: string, aliasList: string) => {
  const tokens = [...shortName.split(','), ...aliasList.split(',')]
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  tokens.forEach((t) => {
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  });
  return unique.join(', ');
};

export const AddEditProductModal: React.FC<Props> = ({ visible, product, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [aliasList, setAliasList] = useState('');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');
  const [unitOpen, setUnitOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setShowSuccess(false);
    setUnitOpen(false);
    if (product) {
      const parts = (product.aliases || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      setName(product.name);
      setShortName(parts[0] || '');
      setAliasList(parts.slice(1).join(', '));
      setUnit(product.unit || 'kg');
      setPrice(product.unit_price ? product.unit_price.toString() : '');
    } else {
      setName('');
      setShortName('');
      setAliasList('');
      setUnit('kg');
      setPrice('');
    }
  }, [product, visible]);

  const handleSave = () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên sản phẩm và giá bán.');
      return;
    }
    onSave(name.trim(), mergeAliases(shortName, aliasList), unit.trim(), parseFloat(price) || 0);
    setShowSuccess(true);
  };

  const resetForm = () => {
    setName('');
    setShortName('');
    setAliasList('');
    setUnit('kg');
    setPrice('');
    setShowSuccess(false);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {showSuccess ? (
        <SuccessView onHome={onClose} onAddAnother={resetForm} />
      ) : (
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose}>
              <MaterialIcons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{product ? 'Sửa sản phẩm' : 'Sản phẩm mới'}</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Image upload (placeholder) */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.imageUpload}
              onPress={() => Alert.alert('Hình ảnh', 'Tính năng chọn ảnh sẽ sớm được bổ sung.')}
            >
              <View style={styles.imageCircle}>
                <MaterialIcons name="add-a-photo" size={40} color={colors.primary} />
              </View>
              <Text style={styles.imageTitle}>Thêm hình ảnh sản phẩm</Text>
              <Text style={styles.imageSubtitle}>Chụp ảnh hoặc chọn từ thư viện</Text>
            </TouchableOpacity>

            {/* Name + short name card */}
            <View style={styles.fieldCard}>
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <MaterialIcons name="inventory-2" size={20} color={colors.primary} />
                  <Text style={styles.fieldLabel}>Tên sản phẩm</Text>
                </View>
                <TextInput
                  style={styles.fieldInputLg}
                  placeholder="Ví dụ: Gạo ST25"
                  placeholderTextColor={colors.outlineVariant}
                  value={name}
                  onChangeText={setName}
                />
              </View>
              <View style={styles.fieldDivider} />
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <MaterialIcons name="label" size={20} color={colors.primary} />
                  <Text style={styles.fieldLabel}>Tên viết tắt</Text>
                </View>
                <TextInput
                  style={styles.fieldInputMd}
                  placeholder="Ví dụ: ST25"
                  placeholderTextColor={colors.outlineVariant}
                  value={shortName}
                  onChangeText={setShortName}
                />
              </View>
            </View>

            {/* Price + unit row */}
            <View style={styles.priceRow}>
              <View style={[styles.fieldCard, { flex: 6 }]}>
                <View style={styles.fieldLabelRow}>
                  <MaterialIcons name="payments" size={20} color={colors.primary} />
                  <Text style={styles.fieldLabel}>Giá bán (đ)</Text>
                </View>
                <View style={styles.priceInputRow}>
                  <TextInput
                    style={styles.priceInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.outlineVariant}
                    value={price}
                    onChangeText={setPrice}
                  />
                  <Text style={styles.priceSuffix}>VNĐ</Text>
                </View>
              </View>
              <View style={[styles.fieldCard, { flex: 4, zIndex: 20 }]}>
                <Text style={styles.fieldLabel}>Đơn vị tính</Text>
                <TouchableOpacity style={styles.unitSelect} onPress={() => setUnitOpen((o) => !o)}>
                  <Text style={styles.unitValue}>{unit}</Text>
                  <MaterialIcons
                    name={unitOpen ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={colors.outlineVariant}
                  />
                </TouchableOpacity>
                {unitOpen ? (
                  <View style={styles.unitDropdown}>
                    {UNITS.map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={styles.unitOption}
                        onPress={() => { setUnit(u); setUnitOpen(false); }}
                      >
                        <Text style={[styles.unitOptionText, u === unit && styles.unitOptionActive]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>

            {/* AI helper */}
            <View style={styles.aiCard}>
              <View style={styles.aiHeader}>
                <View style={styles.fieldLabelRow}>
                  <MaterialIcons name="psychology" size={20} color={colors.primary} />
                  <Text style={styles.aiLabel}>Từ viết tắt / Alias</Text>
                </View>
                <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
              </View>
              <TextInput
                style={styles.aiInput}
                placeholder="ST, ST25, Gạo sóc..."
                placeholderTextColor={colors.textSecondary}
                value={aliasList}
                onChangeText={setAliasList}
              />
              <View style={styles.aiHintRow}>
                <MaterialIcons name="lightbulb" size={16} color={colors.primary} />
                <Text style={styles.aiHint}>
                  Giúp AI nhận diện giọng nói chính xác hơn khi bạn đọc tên tắt.
                </Text>
              </View>
            </View>

            {/* Info note */}
            <View style={styles.infoNote}>
              <MaterialIcons name="info" size={18} color={colors.textSecondary} />
              <Text style={styles.infoText}>Sản phẩm sẽ tự động đồng bộ lên báo cáo tháng.</Text>
            </View>

            {/* Save */}
            <TouchableOpacity style={styles.saveBtn} activeOpacity={0.9} onPress={handleSave}>
              <Text style={styles.saveText}>Lưu sản phẩm</Text>
              <MaterialIcons name="check-circle" size={22} color={colors.white} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </Modal>
  );
};

const FIREWORK_COLORS = ['#10B981', '#059669', '#34D399', '#6EE7B7', '#F59E0B', '#FBBF24'];

// Một chùm pháo hoa: các hạt nổ tỏa tròn từ một điểm, rơi nhẹ theo trọng lực rồi mờ dần.
const Burst: React.FC<{ originX: string; originY: string; count: number; delay: number }> = ({
  originX,
  originY,
  count,
  delay,
}) => {
  const progress = useRef(new Animated.Value(0)).current;
  const particles = useRef(
    Array.from({ length: count }, (_, i) => ({
      angle: (Math.PI * 2 * i) / count + Math.random() * 0.4,
      dist: 90 + Math.random() * 150,
      size: 6 + Math.random() * 6,
      color: FIREWORK_COLORS[i % FIREWORK_COLORS.length],
    }))
  ).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(700 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, delay]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
      {particles.map((p, i) => {
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * p.dist] });
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(p.angle) * p.dist + 70],
        });
        const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
        const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: originX,
              top: originY,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateX }, { translateY }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
};

const Fireworks: React.FC = () => (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Burst originX="50%" originY="34%" count={16} delay={0} />
    <Burst originX="26%" originY="26%" count={14} delay={350} />
    <Burst originX="74%" originY="30%" count={14} delay={650} />
  </View>
);

const SuccessView: React.FC<{ onHome: () => void; onAddAnother: () => void }> = ({ onHome, onAddAnother }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const countdown = useRef(new Animated.Value(1)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    Animated.timing(countdown, { toValue: 0, duration: 3000, easing: Easing.linear, useNativeDriver: false }).start();
    timer.current = setTimeout(() => onHome(), 3000);
    return () => {
      loop.stop();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pulse, countdown, onHome]);

  const stopTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return (
    <View style={styles.successContainer}>
      <Fireworks />
      <View style={styles.successCenter}>
        <View style={styles.iconWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulseRing,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
              },
            ]}
          />
          <View style={styles.iconCircle}>
            <MaterialIcons name="check-circle" size={80} color={colors.white} />
          </View>
        </View>
        <Text style={styles.successTitle}>Tạo sản phẩm thành công!</Text>
        <Text style={styles.successSubtitle}>Sản phẩm đã được thêm vào cửa hàng của bạn.</Text>
        <View style={styles.countdownTrack}>
          <Animated.View
            style={[
              styles.countdownBar,
              { width: countdown.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
      </View>

      <View style={styles.successActions}>
        <TouchableOpacity
          style={styles.homeBtn}
          activeOpacity={0.9}
          onPress={() => { stopTimer(); onHome(); }}
        >
          <MaterialIcons name="home" size={22} color={colors.white} />
          <Text style={styles.homeBtnText}>Quay về trang chủ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addMoreBtn}
          activeOpacity={0.9}
          onPress={() => { stopTimer(); onAddAnother(); }}
        >
          <MaterialIcons name="add-circle" size={22} color={colors.primary} />
          <Text style={styles.addMoreText}>Tiếp tục thêm sản phẩm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slateBg },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryContainer,
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.headlineMd, color: colors.white },
  body: { padding: 16, gap: 16, paddingBottom: 48 },
  // Image upload
  imageUpload: {
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  imageCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageTitle: { ...typography.headlineMd, color: colors.onSurface },
  imageSubtitle: { ...typography.bodySm, color: colors.textSecondary },
  // Field cards
  fieldCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariantSoft,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  fieldGroup: { gap: 8 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldLabel: { ...typography.labelMd, color: colors.primary },
  fieldInputLg: { ...typography.headlineMd, color: colors.onSurface, padding: 0 },
  fieldInputMd: { ...typography.bodyLg, color: colors.onSurface, padding: 0 },
  fieldDivider: { height: 1, backgroundColor: colors.outlineVariantSoft },
  // Price + unit
  priceRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  priceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceInput: { ...typography.headlineLgMobile, color: colors.onSurface, padding: 0, flex: 1 },
  priceSuffix: { ...typography.headlineMd, color: colors.outlineVariant },
  unitSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitValue: { ...typography.bodyLg, color: colors.onSurface },
  unitDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariantSoft,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  unitOption: { paddingVertical: 10, paddingHorizontal: 16 },
  unitOptionText: { ...typography.bodyMd, color: colors.onSurface },
  unitOptionActive: { color: colors.primary, fontFamily: fontFamily.interSemiBold },
  // AI helper
  aiCard: {
    backgroundColor: colors.primarySoftFaint,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primaryContainerBorder,
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiLabel: { ...typography.labelMd, color: colors.onPrimaryContainer },
  aiInput: { ...typography.bodyMd, color: colors.onSurface, padding: 0 },
  aiHintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },
  aiHint: { ...typography.labelSm, color: colors.onSurfaceVariant, flex: 1, lineHeight: 16 },
  // Info note
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariantSoft,
  },
  infoText: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1 },
  // Save button
  saveBtn: {
    marginTop: 8,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  saveText: { ...typography.headlineMd, color: colors.white },
  // Success
  successContainer: { flex: 1, backgroundColor: colors.slateBg },
  successCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  pulseRing: { position: 'absolute', width: 128, height: 128, borderRadius: 64, backgroundColor: colors.primary },
  iconCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  successTitle: { ...typography.headlineLgMobile, fontSize: 28, lineHeight: 36, color: colors.onSurface, textAlign: 'center', marginBottom: 12 },
  successSubtitle: { ...typography.bodyLg, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 24 },
  countdownTrack: { width: 240, height: 6, borderRadius: 3, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  countdownBar: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  successActions: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  homeBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  homeBtnText: { ...typography.headlineMd, color: colors.white },
  addMoreBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  addMoreText: { ...typography.labelMd, fontSize: 16, color: colors.primary },
});
