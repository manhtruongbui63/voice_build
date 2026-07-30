import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { initDB } from './src/services/db';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProductCatalogScreen } from './src/screens/ProductCatalogScreen';
import { InvoiceHistoryScreen } from './src/screens/InvoiceHistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { colors, fontFamily } from './src/theme/tokens';

type ActiveTab = 'home' | 'products' | 'history' | 'settings';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const TABS: { key: ActiveTab; label: string; icon: MaterialIconName }[] = [
  { key: 'home', label: 'Bán Hàng', icon: 'mic' },
  { key: 'products', label: 'Sản Phẩm', icon: 'inventory-2' },
  { key: 'history', label: 'Báo Cáo', icon: 'analytics' },
  { key: 'settings', label: 'Cài Đặt', icon: 'settings' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [dbReady, setDbReady] = useState(false);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    try {
      initDB();
      setDbReady(true);
    } catch (err) {
      console.error('Failed to initialize SQLite database:', err);
    }
  }, []);

  if (!dbReady || !fontsLoaded) {
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
        {activeTab === 'home' && (
          <HomeScreen onOpenSettings={() => setActiveTab('settings')} />
        )}
        {activeTab === 'products' && <ProductCatalogScreen />}
        {activeTab === 'history' && <InvoiceHistoryScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      <View style={styles.navBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const tint = active ? colors.primaryContainer : colors.textSecondary;
          return (
            <TouchableOpacity key={tab.key} style={styles.navItem} onPress={() => setActiveTab(tab.key)}>
              <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
                <MaterialIcons name={tab.icon} size={24} color={tint} />
              </View>
              <Text style={[styles.navText, { color: tint }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slateBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 72,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariantSoft,
    backgroundColor: colors.white,
  },
  navItem: { alignItems: 'center', gap: 6, minWidth: 64 },
  navIconWrap: {
    width: 48,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconWrapActive: { backgroundColor: colors.primaryContainerFaint },
  navText: { fontFamily: fontFamily.interBold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
});
