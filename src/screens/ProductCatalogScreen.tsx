import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Product } from '../types';
import { getProductsFromDB, addProductToDB, updateProductInDB, deleteProductFromDB } from '../services/db';
import { AddEditProductModal } from '../components/AddEditProductModal';

export const ProductCatalogScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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
      { text: 'Xóa', style: 'destructive', onPress: () => { deleteProductFromDB(id); loadProducts(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{item.name}</Text>
              {item.aliases ? <Text style={styles.aliasText}>Viết tắt: {item.aliases}</Text> : null}
              <Text style={styles.priceText}>{item.unit_price.toLocaleString('vi-VN')} đ / {item.unit}</Text>
            </View>
            <TouchableOpacity onPress={() => { setSelectedProduct(item); setModalVisible(true); }}>
              <Text style={styles.editBtn}>Sửa</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)}>
              <Text style={styles.deleteBtn}>Xóa</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => { setSelectedProduct(null); setModalVisible(true); }}>
        <Text style={styles.fabText}>+ Thêm SP</Text>
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
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  productName: { fontSize: 17, fontWeight: 'bold', color: '#111827' },
  aliasText: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  priceText: { fontSize: 15, color: '#059669', fontWeight: '600', marginTop: 4 },
  editBtn: { color: '#2563EB', fontWeight: '600', marginHorizontal: 10 },
  deleteBtn: { color: '#EF4444', fontWeight: '600' },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#10B981', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 30, elevation: 5 },
  fabText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
