import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Product } from '../types';
import { getProductsFromDB, addProductToDB, updateProductInDB, deleteProductFromDB, deleteProductsFromDB } from '../services/db';
import { AddEditProductModal } from '../components/AddEditProductModal';
import { colors, typography } from '../theme/tokens';

const CHIPS = ['Tất cả', 'Gạo & Ngũ cốc', 'Gia vị', 'Đồ uống'];

export const ProductCatalogScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [query, setQuery] = useState('');
  const [activeChip, setActiveChip] = useState('Tất cả');

  const loadProducts = () => {
    setProducts(getProductsFromDB());
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSaveProduct = (name: string, aliases: string, unit: string, price: number) => {
    if (selectedProduct) {
      updateProductInDB(selectedProduct.id, name, aliases, unit, price);
    } else {
      addProductToDB(name, aliases, unit, price);
    }
    loadProducts();
  };

  const handleDelete = (id: number) => {
    Alert.alert('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa sản phẩm này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          try {
            deleteProductFromDB(id);
            loadProducts();
          } catch {
            Alert.alert('Lỗi', 'Không thể xóa sản phẩm. Vui lòng thử lại.');
          }
        },
      },
    ]);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.aliases || '').toLowerCase().includes(q)
    );
  }, [products, query]);

  const renderCard = ({ item }: { item: Product }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.productName}>{item.name}</Text>
          {item.aliases ? (
            <View style={styles.aliasRow}>
              <View style={styles.aliasBadge}>
                <Text style={styles.aliasBadgeText}>Viết tắt: {item.aliases}</Text>
              </View>
            </View>
          ) : null}
        </View>
        <View style={styles.thumb}>
          <Text style={styles.thumbLetter}>{item.name.trim().charAt(0).toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.price}>{item.unit_price.toLocaleString('vi-VN')} đ</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => { setSelectedProduct(item); setModalVisible(true); }}
          >
            <MaterialIcons name="edit" size={22} color={colors.tertiary} />
            <Text style={styles.editText}>Sửa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID={`delete-button-${item.id}`}
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.id)}
          >
            <MaterialIcons name="delete" size={22} color={colors.errorCrimson} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.logoBox}>
            <MaterialIcons name="settings-voice" size={20} color={colors.white} />
          </View>
          <Text style={styles.brandName}>VoiceBill</Text>
        </View>
        <View style={styles.avatar}>
          <MaterialIcons name="person" size={20} color={colors.onSurfaceVariant} />
        </View>
      </View>

      {/* Search + chips */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={26} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm sản phẩm..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CHIPS.map((chip) => {
            const active = chip === activeChip;
            return (
              <TouchableOpacity
                key={chip}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActiveChip(chip)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Product list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="inventory-2" size={48} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>
              {query ? 'Không tìm thấy sản phẩm phù hợp' : 'Chưa có sản phẩm nào'}
            </Text>
          </View>
        }
        ListFooterComponent={
          filtered.length > 0 ? (
            <View style={styles.footer}>
              <MaterialIcons name="inventory-2" size={48} color={colors.onSurfaceVariant} />
              <Text style={styles.footerText}>Đã hiển thị hết sản phẩm</Text>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() => { setSelectedProduct(null); setModalVisible(true); }}
      >
        <MaterialIcons name="add" size={32} color={colors.white} />
      </TouchableOpacity>

      <AddEditProductModal
        visible={modalVisible}
        product={selectedProduct}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveProduct}
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
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariantSoft,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { ...typography.headlineMd, color: colors.onSurface },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Search
  searchSection: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface },
  searchBox: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerHighest,
  },
  searchInput: { flex: 1, ...typography.bodyLg, color: colors.onSurface, padding: 0 },
  chips: { gap: 8, paddingTop: 12, paddingRight: 8 },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: colors.surfaceContainerHigh,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.labelMd, color: colors.onSurfaceVariant },
  chipTextActive: { color: colors.white },
  // List
  listContent: { padding: 16, gap: 16, paddingBottom: 120 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  productName: { ...typography.headlineMd, color: colors.onBackground },
  aliasRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aliasBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.secondaryContainer },
  aliasBadgeText: { ...typography.labelMd, color: colors.onSecondaryContainer },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLetter: { ...typography.headlineMd, color: colors.primary },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceVariant,
  },
  price: { ...typography.headlineLgMobile, color: colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingVertical: 4 },
  editText: { ...typography.labelMd, color: colors.tertiary },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorContainerFaint,
  },
  // Empty / footer
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 8, opacity: 0.5 },
  emptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  footer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8, opacity: 0.4 },
  footerText: { ...typography.bodyMd, color: colors.onSurface },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
});
