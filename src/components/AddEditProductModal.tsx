import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Product } from '../types';

interface Props {
  visible: boolean;
  product?: Product | null;
  onClose: () => void;
  onSave: (name: string, aliases: string, unit: string, price: number) => void;
}

export const AddEditProductModal: React.FC<Props> = ({ visible, product, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (product) {
      setName(product.name);
      setAliases(product.aliases || '');
      setUnit(product.unit);
      setPrice(product.unit_price.toString());
    } else {
      setName('');
      setAliases('');
      setUnit('kg');
      setPrice('');
    }
  }, [product, visible]);

  const handleSave = () => {
    if (!name.trim() || !price.trim()) return;
    onSave(name.trim(), aliases.trim(), unit.trim(), parseFloat(price) || 0);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{product ? 'Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}</Text>
          
          <TextInput style={styles.input} placeholder="Tên sản phẩm (ví dụ: Gạo ST25)" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Tên gọi ngắn / Viết tắt (ví dụ: ST, ST25)" value={aliases} onChangeText={setAliases} />
          <TextInput style={styles.input} placeholder="Đơn vị tính (ví dụ: kg, túi, bao)" value={unit} onChangeText={setUnit} />
          <TextInput style={styles.input} placeholder="Đơn giá (VNĐ)" keyboardType="numeric" value={price} onChangeText={setPrice} />

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
              <Text style={styles.btnText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave}>
              <Text style={[styles.btnText, { color: '#FFF' }]}>Lưu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  container: { width: '85%', backgroundColor: '#FFF', padding: 20, borderRadius: 12 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  input: { borderBottomWidth: 1, borderColor: '#CCC', paddingVertical: 8, marginBottom: 12, fontSize: 16 },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  cancelBtn: { backgroundColor: '#E0E0E0' },
  saveBtn: { backgroundColor: '#10B981' },
  btnText: { fontSize: 16, fontWeight: '600', color: '#333' },
});
