import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Product } from '../types';
import {
  getProductsFromDB,
  addProductToDB,
  updateProductInDB,
  deleteProductFromDB,
  deleteProductsFromDB,
  importProductsFromDB,
} from '../services/db';
import { AddEditProductModal } from '../components/AddEditProductModal';
import { ProductFormPanel } from '../components/ProductFormPanel';
import { colors, fontFamily, radius, typography } from '../theme/tokens';
import {
  parseProductCsvForPreview,
  ProductImportPreview,
} from '../services/productCsvImportService';
import { generateProductAliases } from '../services/aliasSuggestionService';
import { getGeminiApiKey } from '../services/geminiSettingsService';

const CHIPS = ['Tất cả', 'Gạo tẻ', 'Gạo thơm', 'Gạo nếp'];
// Lọc theo danh mục chưa xử lý — tạm ẩn UI, sẽ bật lại sau.
const SHOW_CATEGORY_CHIPS = false;

const formatCatalogPrice = (value: number) => `${Math.round(value).toLocaleString('vi-VN')}đ`;

const parseAliases = (aliases?: string) =>
  (aliases || '')
    .split(',')
    .map((alias) => alias.trim())
    .filter(Boolean);

export const ProductCatalogScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 1024;
  const [products, setProducts] = useState<Product[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [query, setQuery] = useState('');
  const [activeChip, setActiveChip] = useState('Tất cả');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [importPreview, setImportPreview] = useState<ProductImportPreview | null>(null);
  const [importing, setImporting] = useState(false);

  const loadProducts = () => {
    setProducts(getProductsFromDB());
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSaveProduct = async (
    name: string,
    aliases: string,
    unit: string,
    price: number,
    useAiAlias: boolean
  ) => {
    let finalAliases = aliases;
    if (useAiAlias) {
      const apiKey = await getGeminiApiKey();
      if (!apiKey) {
        throw new Error('Chưa cấu hình Gemini API Key. Vào tab Cài đặt để thêm trước khi dùng AI tạo Alias.');
      }
      // Điều kiện tiên quyết: alias mới không được trùng tên/alias của sản phẩm khác.
      const takenAliases = products
        .filter((item) => item.id !== selectedProduct?.id)
        .flatMap((item) => [item.name, ...parseAliases(item.aliases)]);
      finalAliases = await generateProductAliases(name, apiKey, { takenAliases });
    }

    if (selectedProduct) {
      updateProductInDB(selectedProduct.id, name, finalAliases, unit, price);
    } else {
      addProductToDB(name, finalAliases, unit, price);
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

  // Tablet master-detail: tự chọn sản phẩm đầu để panel phải luôn có nội dung.
  useEffect(() => {
    if (!isTablet || addingNew) return;
    const stillSelected = selectedProduct != null && filtered.some((p) => p.id === selectedProduct.id);
    if (!stillSelected) setSelectedProduct(filtered[0] ?? null);
  }, [isTablet, addingNew, filtered, selectedProduct]);

  const handleTabletAddNew = () => {
    setAddingNew(true);
    setSelectedProduct(null);
  };

  const handleTabletSelect = (product: Product) => {
    setAddingNew(false);
    setSelectedProduct(product);
  };

  const handlePanelSave = async (
    name: string,
    aliases: string,
    unit: string,
    price: number,
    useAiAlias: boolean
  ) => {
    const wasAdding = addingNew;
    await handleSaveProduct(name, aliases, unit, price, useAiAlias);
    const fresh = getProductsFromDB();
    setProducts(fresh);
    if (wasAdding) {
      setAddingNew(false);
      setSelectedProduct(fresh[fresh.length - 1] ?? null);
    } else if (selectedProduct) {
      setSelectedProduct(fresh.find((p) => p.id === selectedProduct.id) ?? fresh[0] ?? null);
    }
  };

  const handlePanelDelete = (product: Product) => {
    Alert.alert('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa sản phẩm này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          try {
            deleteProductFromDB(product.id);
            const fresh = getProductsFromDB();
            setProducts(fresh);
            setAddingNew(false);
            setSelectedProduct(fresh[0] ?? null);
          } catch {
            Alert.alert('Lỗi', 'Không thể xóa sản phẩm. Vui lòng thử lại.');
          }
        },
      },
    ]);
  };

  const handlePanelCancel = () => {
    setAddingNew(false);
    if (!selectedProduct) setSelectedProduct(filtered[0] ?? null);
  };

  const catalogPrice = (value: number) => `${Math.round(value).toLocaleString('vi-VN')}`;

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const inventoryEmpty = products.length === 0 && query.trim() === '';

  const handleBulkDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    Alert.alert('Xác nhận xóa', `Xóa ${ids.length} sản phẩm đã chọn?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          try {
            deleteProductsFromDB(ids);
            loadProducts();
            setSelectionMode(false);
            setSelectedIds(new Set());
          } catch {
            Alert.alert('Lỗi', 'Không thể xóa sản phẩm. Vui lòng thử lại.');
          }
        },
      },
    ]);
  };

  const handleImportCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Lỗi', 'Không thể đọc file CSV.');
        return;
      }

      const csvText = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      setImportPreview(parseProductCsvForPreview(csvText, products));
    } catch {
      Alert.alert('Lỗi', 'Không thể đọc file CSV.');
    }
  };

  const validImportRows = importPreview
    ? [...importPreview.createRows, ...importPreview.updateRows]
    : [];
  const canConfirmImport = validImportRows.length > 0 && !importing;

  const handleConfirmImport = () => {
    if (!importPreview || validImportRows.length === 0) return;

    setImporting(true);
    try {
      const result = importProductsFromDB(validImportRows);
      loadProducts();
      setImportPreview(null);
      Alert.alert(
        'Import thành công',
        `Đã tạo mới ${result.created} sản phẩm và cập nhật ${result.updated} sản phẩm.`
      );
    } catch {
      Alert.alert('Lỗi', 'Không thể import sản phẩm. Vui lòng thử lại.');
    } finally {
      setImporting(false);
    }
  };

  const renderCard = ({ item }: { item: Product }) => {
    const checked = selectedIds.has(item.id);
    const aliases = parseAliases(item.aliases).slice(0, 2);
    return (
      <TouchableOpacity
        testID={`product-card-${item.id}`}
        activeOpacity={selectionMode ? 0.7 : 1}
        onPress={() => {
          if (selectionMode) toggleSelected(item.id);
          else {
            setSelectedProduct(item);
            setModalVisible(true);
          }
        }}
        style={styles.card}
      >
        <View style={styles.cardContent}>
          {selectionMode ? (
            <MaterialIcons
              name={checked ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={checked ? colors.primary : colors.onSurfaceVariant}
              style={styles.selectionIcon}
            />
          ) : null}
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
            {aliases.length > 0 ? (
              <View style={styles.aliasRow}>
                {aliases.map((alias) => (
                  <View key={`${item.id}-${alias}`} style={styles.aliasBadge}>
                    <Text style={styles.aliasBadgeText}>{alias}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <View style={styles.priceColumn}>
            <Text style={styles.price}>{formatCatalogPrice(item.unit_price)}</Text>
            {!selectionMode ? (
              <TouchableOpacity
                testID={`delete-button-${item.id}`}
                style={styles.moreBtn}
                onPress={() => handleDelete(item.id)}
                activeOpacity={0.85}
              >
                <MaterialIcons testID={`product-more-button-${item.id}`} name="more-vert" size={22} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderImportPreviewModal = () => (
    <Modal
      transparent
      visible={Boolean(importPreview)}
      animationType="fade"
      onRequestClose={() => setImportPreview(null)}
    >
      <View style={styles.importOverlay}>
        <View testID="product-import-preview-modal" style={styles.importModal}>
          <View style={styles.importHeader}>
            <Text style={styles.importTitle}>Import sản phẩm từ CSV</Text>
            <TouchableOpacity onPress={() => setImportPreview(null)} activeOpacity={0.85}>
              <MaterialIcons name="close" size={28} color={colors.outline} />
            </TouchableOpacity>
          </View>

          <View style={styles.importStats}>
            <Text style={styles.importStatText}>Tổng dòng: {importPreview?.totalRows ?? 0}</Text>
            <Text style={styles.importStatText}>Tạo mới: {importPreview?.createRows.length ?? 0}</Text>
            <Text style={styles.importStatText}>Cập nhật: {importPreview?.updateRows.length ?? 0}</Text>
            <Text style={[styles.importStatText, styles.importErrorText]}>
              Lỗi: {importPreview?.errors.length ?? 0}
            </Text>
          </View>

          {importPreview?.errors.length ? (
            <ScrollView style={styles.importErrors} contentContainerStyle={styles.importErrorsContent}>
              {importPreview.errors.map((error) => (
                <Text key={`${error.line}-${error.message}`} style={styles.importErrorLine}>
                  Dòng {error.line}: {error.message}
                </Text>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.importSuccessHint}>File hợp lệ và sẵn sàng import.</Text>
          )}

          <View style={styles.importActions}>
            <TouchableOpacity
              style={styles.importCancelButton}
              onPress={() => setImportPreview(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.importCancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="product-import-confirm-button"
              style={[styles.importConfirmButton, !canConfirmImport && styles.importConfirmButtonDisabled]}
              onPress={handleConfirmImport}
              disabled={!canConfirmImport}
              activeOpacity={0.85}
            >
              {importing ? <ActivityIndicator color={colors.white} /> : null}
              <Text style={styles.importConfirmButtonText}>Xác nhận import</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderTablet = () => (
    <View style={styles.container}>
      <View style={styles.tRow}>
        <View style={styles.tListCol}>
          <View style={styles.tListHeaderRow}>
            <Text style={styles.tListTitle}>Sản phẩm</Text>
            <TouchableOpacity
              testID="select-mode-toggle"
              style={styles.tSelectToggle}
              onPress={toggleSelectionMode}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selectionMode }}
            >
              <MaterialIcons
                name={selectionMode ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={selectionMode ? colors.primary : colors.onSurfaceVariant}
              />
              <Text style={styles.tSelectToggleText}>Chọn nhiều</Text>
            </TouchableOpacity>
          </View>

          {selectionMode ? (
            <View style={styles.tSelectionBar}>
              <Text style={styles.tSelectionCount}>Chọn {selectedIds.size} sản phẩm</Text>
              <TouchableOpacity
                testID="tablet-bulk-delete"
                style={[styles.tBulkDeleteBtn, selectedIds.size === 0 && styles.tBulkDeleteDisabled]}
                onPress={handleBulkDelete}
                disabled={selectedIds.size === 0}
                activeOpacity={0.85}
              >
                <MaterialIcons name="delete-outline" size={18} color={colors.white} />
                <Text style={styles.tBulkDeleteText}>Xóa</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.tSearchRow}>
              <View testID="product-search-box" style={styles.tSearchBox}>
                <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
                <TextInput
                  style={styles.tSearchInput}
                  placeholder="Tìm kiếm tên hoặc alias..."
                  placeholderTextColor={colors.outline}
                  value={query}
                  onChangeText={setQuery}
                />
              </View>
              <TouchableOpacity
                testID="product-import-button"
                style={styles.tIconBtnGhost}
                onPress={handleImportCsv}
                activeOpacity={0.9}
              >
                <MaterialIcons name="upload-file" size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity testID="product-add-button" style={styles.tAddBtn} onPress={handleTabletAddNew} activeOpacity={0.9}>
                <MaterialIcons name="add" size={22} color={colors.white} />
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={styles.tListScroll} contentContainerStyle={styles.tListContent} showsVerticalScrollIndicator={false}>
            {filtered.map((product) => {
              const checked = selectedIds.has(product.id);
              const selected = !selectionMode && !addingNew && selectedProduct?.id === product.id;
              const aliases = parseAliases(product.aliases).slice(0, 3).join(', ');
              return (
                <TouchableOpacity
                  key={product.id}
                  testID={`product-card-${product.id}`}
                  style={[styles.tItem, selected && styles.tItemActive, selectionMode && checked && styles.tItemChecked]}
                  activeOpacity={0.85}
                  onPress={() => (selectionMode ? toggleSelected(product.id) : handleTabletSelect(product))}
                >
                  <View style={styles.tItemLeft}>
                    {selectionMode ? (
                      <MaterialIcons
                        testID={`select-checkbox-${product.id}`}
                        name={checked ? 'check-box' : 'check-box-outline-blank'}
                        size={24}
                        color={checked ? colors.primary : colors.onSurfaceVariant}
                      />
                    ) : (
                      <View style={[styles.tItemIcon, selected && styles.tItemIconActive]}>
                        <MaterialIcons name="inventory-2" size={22} color={selected ? colors.primary : colors.onSurfaceVariant} />
                      </View>
                    )}
                    <View style={styles.tItemInfo}>
                      <Text style={styles.tItemName} numberOfLines={1}>{product.name}</Text>
                      {aliases ? <Text style={styles.tItemAlias} numberOfLines={1}>{aliases.toUpperCase()}</Text> : null}
                    </View>
                  </View>
                  <View style={styles.tItemRight}>
                    <Text style={[styles.tItemPrice, selected && styles.tItemPriceActive]}>{catalogPrice(product.unit_price)}</Text>
                    <Text style={styles.tItemVnd}>VND</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {filtered.length === 0 ? (
              <View style={styles.tListEmpty}>
                <MaterialIcons name="inventory-2" size={40} color={colors.outline} />
                <Text style={styles.tListEmptyText}>Chưa có sản phẩm.</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>

        <View style={styles.tFormCol}>
          {selectionMode ? (
            <View style={styles.tFormEmpty}>
              <MaterialIcons name="checklist" size={48} color={colors.outline} />
              <Text style={styles.tFormEmptyText}>Đang ở chế độ chọn nhiều để xóa.</Text>
            </View>
          ) : addingNew || selectedProduct ? (
            <ProductFormPanel
              product={addingNew ? null : selectedProduct}
              onSave={handlePanelSave}
              onDelete={handlePanelDelete}
              onCancel={handlePanelCancel}
            />
          ) : (
            <View style={styles.tFormEmpty}>
              <MaterialIcons name="touch-app" size={48} color={colors.outline} />
              <Text style={styles.tFormEmptyText}>Chọn một sản phẩm hoặc thêm mới.</Text>
            </View>
          )}
        </View>
      </View>

      {renderImportPreviewModal()}
    </View>
  );

  if (isTablet) return renderTablet();

  return (
    <View style={styles.container}>
      {/* Search + chips */}
      {!inventoryEmpty ? (
        <View style={styles.searchSection}>
          <View testID="product-search-box" style={styles.searchBox}>
            <MaterialIcons name="search" size={22} color={colors.onSurfaceVariant} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm tên hoặc mã rút gọn (alias)..."
              placeholderTextColor={colors.onSurfaceVariant}
              value={query}
              onChangeText={setQuery}
            />
          </View>
          {SHOW_CATEGORY_CHIPS ? (
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
                    testID={chip === 'Tất cả' ? 'product-chip-all' : undefined}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setActiveChip(chip)}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}
          <View style={styles.toolbarRow}>
            <TouchableOpacity
              testID="select-mode-toggle"
              style={styles.selectCheckboxBtn}
              onPress={toggleSelectionMode}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selectionMode }}
            >
              <MaterialIcons
                name={selectionMode ? 'check-box' : 'check-box-outline-blank'}
                size={28}
                color={selectionMode ? colors.primary : colors.onSurfaceVariant}
              />
            </TouchableOpacity>

            {!selectionMode ? (
              <>
                <View style={styles.toolbarSpacer} />

                <TouchableOpacity
                  testID="product-import-button"
                  style={styles.importButton}
                  onPress={handleImportCsv}
                  activeOpacity={0.9}
                >
                  <MaterialIcons name="upload-file" size={20} color={colors.primary} />
                  <Text style={styles.importButtonText}>CSV</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="product-add-button"
                  style={styles.addButton}
                  onPress={() => { setSelectedProduct(null); setModalVisible(true); }}
                  activeOpacity={0.9}
                >
                  <MaterialIcons name="add" size={20} color={colors.white} />
                  <Text style={styles.addButtonText}>Sản phẩm</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.selectionCountText}>Chọn {selectedIds.size} sản phẩm</Text>

                <View style={styles.toolbarSpacer} />

                <TouchableOpacity
                  testID="bulk-delete-button"
                  style={[styles.bulkDeleteBtn, selectedIds.size === 0 && styles.bulkDeleteBtnDisabled]}
                  onPress={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                  activeOpacity={0.9}
                >
                  <MaterialIcons name="delete" size={18} color={colors.white} />
                  <Text style={styles.bulkDeleteText}>Xóa</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ) : null}

      {/* Product list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCard}
        contentContainerStyle={[styles.listContent, filtered.length === 0 && styles.emptyListContent]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          inventoryEmpty ? (
            <View testID="product-empty-card" style={styles.emptyCard}>
              <View style={styles.emptyGlowTop} />
              <View style={styles.emptyGlowBottom} />
              <View style={styles.emptyIconStage}>
                <View style={styles.emptyIconPing} />
                <View style={styles.emptyIconCircle}>
                  <MaterialIcons name="inventory-2" size={22} color={colors.onSurfaceVariant} />
                </View>
                <MaterialIcons style={styles.emptySparkRight} name="arrow-back-ios-new" size={16} color="#E3C193" />
                <MaterialIcons style={styles.emptySparkLeft} name="arrow-back-ios-new" size={14} color="#E3C193" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có sản phẩm nào</Text>
              <Text style={styles.emptyDescription}>
                Kho hàng của bạn đang trống. Hãy thêm sản phẩm đầu tiên để bắt đầu tạo hóa đơn nhanh chóng.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                activeOpacity={0.9}
                onPress={() => { setSelectedProduct(null); setModalVisible(true); }}
              >
                <MaterialIcons name="add" size={20} color={colors.white} />
                <Text style={styles.emptyCtaText}>Thêm sản phẩm ngay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="product-import-button"
                style={styles.emptyImportCta}
                activeOpacity={0.9}
                onPress={handleImportCsv}
              >
                <MaterialIcons name="upload-file" size={20} color={colors.primary} />
                <Text style={styles.emptyImportCtaText}>Import CSV</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.searchEmpty}>
              <View style={styles.searchEmptyIcon}>
                <MaterialIcons name="search-off" size={42} color={colors.onSurfaceVariant} />
              </View>
              <Text style={styles.emptyTitle}>Không tìm thấy sản phẩm</Text>
              <Text style={styles.searchEmptyText}>Thử tìm kiếm với tên hoặc mã rút gọn khác.</Text>
            </View>
          )
        }
      />

      {renderImportPreviewModal()}

      <AddEditProductModal
        visible={modalVisible}
        product={selectedProduct}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveProduct}
        onDelete={(item) => handleDelete(item.id)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6FAFF' },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(246, 250, 255, 0.92)',
  },
  searchBox: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#EBF5FF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontFamily: fontFamily.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: '#001E2F',
  },
  chips: { gap: 8, paddingTop: 20, paddingRight: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E0F0FF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  chipActive: { backgroundColor: '#091A3E' },
  chipText: {
    fontFamily: fontFamily.interMedium,
    fontSize: 14,
    lineHeight: 20,
    color: '#001E2F',
  },
  chipTextActive: { color: colors.white },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  selectionCountText: {
    ...typography.labelMd,
    color: colors.onSurface,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primaryContainerFaint,
  },
  importButtonText: { ...typography.labelMd, color: colors.primary },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  addButtonText: { ...typography.labelMd, color: colors.white },
  toolbarSpacer: { flex: 1 },
  selectCheckboxBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 120,
    gap: 12,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 72,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectionIcon: {
    marginRight: 2,
  },
  productInfo: {
    flex: 1,
    gap: 8,
  },
  productName: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: '#001E2F',
  },
  aliasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  aliasBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#D5EBFF',
  },
  aliasBadgeText: {
    fontFamily: fontFamily.interMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.onSurfaceVariant,
  },
  priceColumn: {
    alignItems: 'flex-end',
    gap: 10,
  },
  price: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: '#091A3E',
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6FAFF',
  },
  emptyCard: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.white,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
  },
  emptyGlowTop: {
    position: 'absolute',
    top: -48,
    right: -48,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(183, 197, 243, 0.2)',
  },
  emptyGlowBottom: {
    position: 'absolute',
    bottom: -48,
    left: -48,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(201, 230, 255, 0.3)',
  },
  emptyIconStage: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIconPing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(218, 226, 255, 0.2)',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F0FF',
  },
  emptySparkRight: {
    position: 'absolute',
    top: 8,
    right: 2,
  },
  emptySparkLeft: {
    position: 'absolute',
    bottom: 20,
    left: 2,
  },
  emptyTitle: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 20,
    lineHeight: 28,
    color: '#001E2F',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDescription: {
    maxWidth: 280,
    fontFamily: fontFamily.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyCta: {
    minHeight: 46,
    alignSelf: 'stretch',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#091A3E',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  emptyCtaText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },
  emptyImportCta: {
    minHeight: 46,
    alignSelf: 'stretch',
    marginTop: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primaryContainerBorder,
  },
  emptyImportCtaText: { ...typography.labelMd, color: colors.primary },
  searchEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  searchEmptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#EBF5FF',
  },
  searchEmptyText: {
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  bulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.errorCrimson,
  },
  bulkDeleteBtnDisabled: { opacity: 0.4 },
  bulkDeleteText: { ...typography.labelMd, color: colors.white },
  importOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  importModal: {
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
    backgroundColor: colors.white,
  },
  importHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  importTitle: { ...typography.headlineMd, flex: 1, color: colors.onSurface },
  importStats: { gap: 6, marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: colors.primaryContainerFaint },
  importStatText: { ...typography.bodyMd, color: colors.onSurface },
  importErrorText: { color: colors.errorCrimson },
  importErrors: { maxHeight: 180, marginTop: 16 },
  importErrorsContent: { gap: 8 },
  importErrorLine: { ...typography.bodySm, color: colors.errorCrimson },
  importSuccessHint: { ...typography.bodyMd, marginTop: 16, color: colors.onSurfaceVariant },
  importActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  importCancelButton: { paddingHorizontal: 16, paddingVertical: 12 },
  importCancelButtonText: { ...typography.labelMd, color: colors.primary },
  importConfirmButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  importConfirmButtonDisabled: { opacity: 0.45 },
  importConfirmButtonText: { ...typography.labelMd, color: colors.white },

  // ===== Tablet master-detail =====
  tRow: { flex: 1, flexDirection: 'row', padding: 20, gap: 20 },
  tListCol: {
    width: '38%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 16,
  },
  tListHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tListTitle: { fontFamily: fontFamily.jakartaSemiBold, fontSize: 16, color: colors.onSurface },
  tSelectToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 6 },
  tSelectToggleText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  tSelectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingLeft: 4,
    marginBottom: 12,
  },
  tSelectionCount: { ...typography.labelMd, color: colors.onSurface },
  tBulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.errorCrimson,
  },
  tBulkDeleteDisabled: { opacity: 0.4 },
  tBulkDeleteText: { ...typography.labelMd, color: colors.white },
  tIconBtnGhost: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tItemChecked: { borderColor: colors.primary, backgroundColor: '#EEF4FB' },
  tSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  tSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow ?? '#F6FAFF',
  },
  tSearchInput: { flex: 1, ...typography.bodyMd, color: colors.onSurface, padding: 0 },
  tAddBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tListScroll: { flex: 1 },
  tListContent: { paddingBottom: 8, gap: 8 },
  tItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.white,
  },
  tItemActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: '#EEF4FB' },
  tItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 10 },
  tItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.outlineVariantSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tItemIconActive: { backgroundColor: '#DCE9F6' },
  tItemInfo: { flex: 1 },
  tItemName: { ...typography.labelMd, color: colors.onSurface },
  tItemAlias: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: 2 },
  tItemRight: { alignItems: 'flex-end' },
  tItemPrice: { ...typography.labelMd, color: colors.onSurface },
  tItemPriceActive: { color: colors.primary },
  tItemVnd: { ...typography.labelSm, color: colors.onSurfaceVariant },
  tListEmpty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  tListEmptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  tFormCol: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  tFormEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  tFormEmptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
});
