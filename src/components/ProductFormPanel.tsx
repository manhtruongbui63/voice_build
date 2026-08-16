import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Product } from '../types';
import { colors, fontFamily, radius } from '../theme/tokens';

const UNITS = ['kg', 'Túi', 'Bao', 'Yến', 'Tạ', 'Thùng', 'Hộp', 'Gói'];
const CATEGORY_PLACEHOLDERS = ['Gạo tẻ', 'Gạo thơm', 'Gạo nếp'];

interface Props {
  product: Product | null; // null = thêm mới
  onSave: (name: string, aliases: string, unit: string, price: number, useAiAlias: boolean) => void | Promise<void>;
  onDelete: (product: Product) => void;
  onCancel: () => void;
}

const parseAliasList = (aliases?: string): string[] =>
  (aliases || '').split(',').map((a) => a.trim()).filter(Boolean);

export const ProductFormPanel: React.FC<Props> = ({ product, onSave, onDelete, onCancel }) => {
  const isEdit = !!product;
  const [name, setName] = useState('');
  const [aliasList, setAliasList] = useState<string[]>([]);
  const [aliasDraft, setAliasDraft] = useState('');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');
  const [useAiAlias, setUseAiAlias] = useState(true);
  const [unitOpen, setUnitOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Chế độ sửa: thêm mới luôn mở; xem chi tiết mặc định khóa (chỉ đọc) tới khi bấm "Cập nhật".
  const [editing, setEditing] = useState(!product);

  const hydrate = (source: Product | null) => {
    setName(source?.name ?? '');
    setAliasList(parseAliasList(source?.aliases));
    setAliasDraft('');
    setUnit(source?.unit || 'kg');
    setPrice(source?.unit_price ? String(source.unit_price) : '');
    setUseAiAlias(!source); // thêm mới: mặc định bật AI; sửa: tắt để giữ alias hiện có
    setUnitOpen(false);
    setSaving(false);
  };

  useEffect(() => {
    hydrate(product);
    setEditing(!product);
  }, [product]);

  const locked = isEdit && !editing;

  const handleCancel = () => {
    if (isEdit && editing) {
      hydrate(product); // hoàn tác thay đổi, quay lại chế độ chỉ đọc
      setEditing(false);
      return;
    }
    onCancel();
  };

  const commitAliasDraft = () => {
    const value = aliasDraft.trim().replace(/,$/, '').trim();
    if (value && !aliasList.some((a) => a.toLowerCase() === value.toLowerCase())) {
      setAliasList((current) => [...current, value]);
    }
    setAliasDraft('');
  };

  const removeAlias = (index: number) => setAliasList((current) => current.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên sản phẩm và giá bán.');
      return;
    }
    if (saving) return;
    const aliases = useAiAlias ? '' : [...aliasList, aliasDraft.trim()].filter(Boolean).join(', ');
    try {
      setSaving(true);
      await onSave(name.trim(), aliases, unit.trim(), parseFloat(price) || 0, useAiAlias);
    } catch (error) {
      Alert.alert('Không thể lưu', error instanceof Error && error.message ? error.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View testID="product-form-panel" style={styles.panel}>
      {/* Banner (sửa) hoặc header (thêm) */}
      {isEdit ? (
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <MaterialIcons name="inventory-2" size={28} color={colors.primary} />
            <View style={styles.bannerEditBadge}>
              <MaterialIcons name="edit" size={11} color={colors.white} />
            </View>
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerEyebrow}>CHI TIẾT SẢN PHẨM</Text>
            <Text style={styles.bannerTitle} numberOfLines={1}>{name || product?.name}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.addHeader}>
          <Text style={styles.addTitle}>Thêm Sản Phẩm Mới</Text>
          <Text style={styles.addSubtitle}>Nhập thông tin chi tiết để tạo sản phẩm</Text>
        </View>
      )}

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Placeholder upload ảnh (chỉ ở chế độ thêm) */}
        {!isEdit ? (
          <View testID="product-image-upload" style={styles.uploadBox}>
            <View style={styles.uploadIconCircle}>
              <MaterialIcons name="add-photo-alternate" size={26} color={colors.primary} />
            </View>
            <Text style={styles.uploadTitle}>Tải ảnh lên</Text>
            <Text style={styles.uploadHint}>Chọn ảnh sản phẩm (tuỳ chọn)</Text>
          </View>
        ) : null}

        {/* Tên sản phẩm */}
        <View style={styles.field}>
          <Text style={styles.label}>Tên sản phẩm <Text style={styles.required}>*</Text></Text>
          <TextInput
            testID="product-form-name"
            style={[styles.input, locked && styles.inputLocked]}
            value={name}
            onChangeText={setName}
            editable={!locked}
            placeholder="VD: Gạo ST25"
            placeholderTextColor={colors.outline}
          />
        </View>

        {/* Giá + Đơn vị */}
        <View style={styles.row}>
          <View style={[styles.field, styles.flex1]}>
            <Text style={styles.label}>Giá bán (VNĐ) <Text style={styles.required}>*</Text></Text>
            <View style={[styles.priceWrap, locked && styles.inputLocked]}>
              <Text style={styles.priceSymbol}>₫</Text>
              <TextInput
                testID="product-form-price"
                style={styles.priceInput}
                value={price}
                onChangeText={setPrice}
                editable={!locked}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.outline}
              />
            </View>
          </View>
          <View style={[styles.field, styles.flex1, styles.unitField]}>
            <Text style={styles.label}>Đơn vị tính</Text>
            <TouchableOpacity
              testID="product-form-unit"
              style={[styles.unitSelect, locked && styles.inputLocked]}
              onPress={() => { if (!locked) setUnitOpen((v) => !v); }}
              disabled={locked}
              activeOpacity={0.85}
            >
              <Text style={styles.unitText}>{unit}</Text>
              <MaterialIcons name={unitOpen ? 'expand-less' : 'expand-more'} size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            {unitOpen ? (
              <View style={styles.unitDropdown}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
                  {UNITS.map((u) => (
                    <TouchableOpacity key={u} style={styles.unitOption} onPress={() => { setUnit(u); setUnitOpen(false); }}>
                      <Text style={[styles.unitOptionText, u === unit && styles.unitOptionActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>

        {/* Alias */}
        <View style={styles.field}>
          <View style={styles.aliasLabelRow}>
            <View style={styles.aliasLabelLeft}>
              <MaterialIcons name="mic-none" size={18} color={colors.primary} />
              <Text style={styles.label}>Từ khóa nhận diện (Alias)</Text>
            </View>
            <TouchableOpacity
              testID="product-form-ai-toggle"
              style={[styles.aiToggle, locked && styles.disabledOpacity]}
              onPress={() => { if (!locked) setUseAiAlias((v) => !v); }}
              disabled={locked}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: useAiAlias }}
            >
              <MaterialIcons name={useAiAlias ? 'check-box' : 'check-box-outline-blank'} size={20} color={useAiAlias ? colors.primary : colors.onSurfaceVariant} />
              <Text style={styles.aiToggleText}>Sử dụng AI</Text>
            </TouchableOpacity>
          </View>

          {useAiAlias ? (
            <View style={styles.aiHintBox}>
              <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
              <Text style={styles.aiHintText}>AI sẽ tự tạo alias từ tên sản phẩm khi lưu.</Text>
            </View>
          ) : (
            <View style={[styles.aliasBox, locked && styles.inputLocked]}>
              {aliasList.length === 0 && locked ? (
                <Text style={styles.aliasEmpty}>Chưa có alias.</Text>
              ) : null}
              {aliasList.map((alias, index) => (
                <View key={`${alias}-${index}`} style={styles.aliasChip}>
                  <Text style={styles.aliasChipText}>{alias}</Text>
                  {!locked ? (
                    <TouchableOpacity testID={`alias-remove-${index}`} onPress={() => removeAlias(index)}>
                      <MaterialIcons name="close" size={14} color={colors.white} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              {!locked ? (
                <TextInput
                  testID="product-form-alias-input"
                  style={styles.aliasInput}
                  value={aliasDraft}
                  onChangeText={(v) => { if (v.endsWith(',')) { setAliasDraft(v); commitAliasDraft(); } else setAliasDraft(v); }}
                  onSubmitEditing={commitAliasDraft}
                  onBlur={commitAliasDraft}
                  placeholder="Nhập alias..."
                  placeholderTextColor={colors.outline}
                  blurOnSubmit={false}
                />
              ) : null}
            </View>
          )}
          <Text style={styles.aliasHelp}>Các từ khóa giúp AI VoiceBill nhận diện sản phẩm này khi gọi món.</Text>
        </View>

        {/* Placeholder danh mục (chế độ thêm) */}
        {!isEdit ? (
          <View style={styles.field}>
            <Text style={styles.label}>Chọn danh mục</Text>
            <View style={styles.categoryRow}>
              {CATEGORY_PLACEHOLDERS.map((c, i) => (
                <View key={c} style={[styles.categoryChip, i === 0 && styles.categoryChipActive]}>
                  <Text style={[styles.categoryChipText, i === 0 && styles.categoryChipTextActive]}>{c}</Text>
                </View>
              ))}
              <View style={[styles.categoryChip, styles.categoryChipAdd]}>
                <MaterialIcons name="add" size={14} color={colors.onSurfaceVariant} />
                <Text style={styles.categoryChipText}>Thêm mới</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Placeholder thống kê (chế độ sửa) */}
        {isEdit ? (
          <View testID="product-stats-card" style={styles.statsCard}>
            <View>
              <Text style={styles.statsLabel}>LƯỢT GỌI TRONG THÁNG</Text>
              <View style={styles.statsRow}>
                <Text style={styles.statsValue}>—</Text>
                <Text style={styles.statsHint}>Sắp có</Text>
              </View>
            </View>
            <MaterialIcons name="show-chart" size={40} color={colors.primaryContainer} />
          </View>
        ) : null}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {isEdit && editing && product ? (
          <TouchableOpacity testID="product-form-delete" style={styles.deleteBtn} onPress={() => onDelete(product)} activeOpacity={0.85}>
            <MaterialIcons name="delete-outline" size={18} color={colors.errorCrimson} />
            <Text style={styles.deleteText}>Xóa Sản Phẩm</Text>
          </TouchableOpacity>
        ) : <View />}
        <View style={styles.footerRight}>
          {locked ? (
            <TouchableOpacity testID="product-form-edit" style={styles.saveBtn} onPress={() => setEditing(true)} activeOpacity={0.9}>
              <MaterialIcons name="edit" size={18} color={colors.white} />
              <Text style={styles.saveText}>Cập nhật</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity testID="product-form-cancel" style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.85}>
                <Text style={styles.cancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="product-form-save" style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.9}>
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <MaterialIcons name="save" size={18} color={colors.white} />
                    <Text style={styles.saveText}>{isEdit ? 'Lưu Thay Đổi' : 'Lưu Sản Phẩm'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.card,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  banner: {
    height: 96,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  bannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerEditBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { flex: 1, gap: 2 },
  bannerEyebrow: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 1.5, color: colors.primaryContainer },
  bannerTitle: { fontFamily: fontFamily.jakartaBold, fontSize: 22, color: colors.white },
  addHeader: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerHigh, gap: 2 },
  addTitle: { fontFamily: fontFamily.jakartaSemiBold, fontSize: 20, color: colors.primary },
  addSubtitle: { fontFamily: fontFamily.interRegular, fontSize: 13, color: colors.onSurfaceVariant },
  body: { flex: 1 },
  bodyContent: { padding: 20, gap: 16 },
  uploadBox: {
    minHeight: 130,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadIconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryContainerFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  uploadTitle: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: colors.primary },
  uploadHint: { fontFamily: fontFamily.interRegular, fontSize: 13, color: colors.onSurfaceVariant },
  field: { gap: 8 },
  flex1: { flex: 1 },
  label: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: colors.onSurface },
  required: { color: colors.errorCrimson },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: fontFamily.interRegular,
    fontSize: 15,
    color: colors.onSurface,
  },
  inputLocked: { backgroundColor: colors.surfaceContainer, borderColor: 'transparent' },
  disabledOpacity: { opacity: 0.5 },
  aliasEmpty: { fontFamily: fontFamily.interRegular, fontSize: 13, color: colors.onSurfaceVariant },
  row: { flexDirection: 'row', gap: 16 },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
  },
  priceSymbol: { fontFamily: fontFamily.interSemiBold, fontSize: 15, color: colors.onSurfaceVariant, marginRight: 8 },
  priceInput: { flex: 1, paddingVertical: 11, fontFamily: fontFamily.interBold, fontSize: 16, color: colors.primary },
  unitField: { zIndex: 20 },
  unitSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  unitText: { fontFamily: fontFamily.interRegular, fontSize: 15, color: colors.onSurface },
  unitDropdown: {
    position: 'absolute',
    top: 76,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    zIndex: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  unitOption: { paddingHorizontal: 14, paddingVertical: 10 },
  unitOptionText: { fontFamily: fontFamily.interRegular, fontSize: 15, color: colors.onSurface },
  unitOptionActive: { fontFamily: fontFamily.interBold, color: colors.primary },
  aliasLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aliasLabelLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiToggleText: { fontFamily: fontFamily.interSemiBold, fontSize: 13, color: colors.primary },
  aiHintBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primaryContainerFaint,
    borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12,
  },
  aiHintText: { flex: 1, fontFamily: fontFamily.interRegular, fontSize: 13, color: colors.onSurfaceVariant },
  aliasBox: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.lg, padding: 12, minHeight: 52,
  },
  aliasChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 999, paddingLeft: 12, paddingRight: 8, paddingVertical: 6,
  },
  aliasChipText: { fontFamily: fontFamily.interMedium, fontSize: 13, color: colors.white },
  aliasInput: { minWidth: 100, flexGrow: 1, paddingVertical: 6, fontFamily: fontFamily.interRegular, fontSize: 14, color: colors.onSurface },
  aliasHelp: { fontFamily: fontFamily.interRegular, fontSize: 12, color: colors.onSurfaceVariant },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceContainer },
  categoryChipActive: { backgroundColor: colors.primary },
  categoryChipAdd: { borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: 'transparent' },
  categoryChipText: { fontFamily: fontFamily.interMedium, fontSize: 13, color: colors.onSurface },
  categoryChipTextActive: { color: colors.white },
  statsCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainer, borderRadius: 16, padding: 16,
  },
  statsLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11, letterSpacing: 0.6, color: colors.onSurfaceVariant },
  statsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  statsValue: { fontFamily: fontFamily.jakartaBold, fontSize: 28, color: colors.onSurface },
  statsHint: { fontFamily: fontFamily.interMedium, fontSize: 12, color: colors.onSurfaceVariant, paddingBottom: 6 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderTopWidth: 1, borderTopColor: colors.surfaceContainerHigh, backgroundColor: colors.white,
  },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.lg },
  deleteText: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: colors.errorCrimson },
  footerRight: { flexDirection: 'row', gap: 12 },
  cancelBtn: { minWidth: 96, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: radius.lg, backgroundColor: colors.surfaceContainer },
  cancelText: { fontFamily: fontFamily.interSemiBold, fontSize: 14, color: colors.onSurface },
  saveBtn: { minWidth: 150, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, borderRadius: radius.lg, backgroundColor: colors.primary },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { fontFamily: fontFamily.interBold, fontSize: 14, color: colors.white },
});
