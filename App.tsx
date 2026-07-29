import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { initDB } from './src/services/db';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProductCatalogScreen } from './src/screens/ProductCatalogScreen';
import { InvoiceHistoryScreen } from './src/screens/InvoiceHistoryScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'products' | 'history'>('home');
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    try {
      initDB();
      setDbReady(true);
    } catch (err) {
      console.error('Failed to initialize SQLite database:', err);
    }
  }, []);

  if (!dbReady) {
    return (
      <View style={styles.center}>
        <Text>Đang khởi tạo cơ sở dữ liệu SQLite...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.content}>
        {activeTab === 'home' && <HomeScreen />}
        {activeTab === 'products' && <ProductCatalogScreen />}
        {activeTab === 'history' && <InvoiceHistoryScreen />}
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('home')}>
          <Text style={[styles.navText, activeTab === 'home' && styles.activeNav]}>🎙️ Bán Hàng</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('products')}>
          <Text style={[styles.navText, activeTab === 'products' && styles.activeNav]}>📦 Sản Phẩm</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('history')}>
          <Text style={[styles.navText, activeTab === 'history' && styles.activeNav]}>📊 Báo Cáo</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  navBar: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, backgroundColor: '#FFF' },
  navItem: { flex: 1, alignItems: 'center' },
  navText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  activeNav: { color: '#10B981', fontWeight: 'bold' },
});
