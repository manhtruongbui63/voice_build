import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
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
import { AppHeader } from './src/components/AppHeader';
import { SplashScreen } from './src/screens/SplashScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProductCatalogScreen } from './src/screens/ProductCatalogScreen';
import { InvoiceHistoryScreen } from './src/screens/InvoiceHistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { colors, fontFamily } from './src/theme/tokens';

type ActiveTab = 'home' | 'products' | 'history' | 'settings';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const TABS: { key: ActiveTab; label: string; icon: MaterialIconName }[] = [
  { key: 'home', label: 'Bán hàng', icon: 'point-of-sale' },
  { key: 'products', label: 'Sản phẩm', icon: 'inventory-2' },
  { key: 'history', label: 'Báo cáo', icon: 'bar-chart' },
  { key: 'settings', label: 'Cài đặt', icon: 'settings' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [dbReady, setDbReady] = useState(false);
  const [minSplashPassed, setMinSplashPassed] = useState(false);

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

  // Giữ màn khởi động tối thiểu ~2.6s để chạy trọn hiệu ứng.
  useEffect(() => {
    const timer = setTimeout(() => setMinSplashPassed(true), 2600);
    return () => clearTimeout(timer);
  }, []);

  if (!dbReady || !fontsLoaded || !minSplashPassed) {
    return <SplashScreen />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header dùng chung — render một lần, không unmount khi đổi tab (hết giật). */}
      <AppHeader testID="app-header" />

      <View style={styles.content}>
        {activeTab === 'home' && (
          <HomeScreen onOpenSettings={() => setActiveTab('settings')} />
        )}
        {activeTab === 'products' && <ProductCatalogScreen />}
        {activeTab === 'history' && <InvoiceHistoryScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      <View testID="bottom-tab-bar" style={styles.navBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const tint = active ? colors.secondary : colors.onSurfaceVariant;
          return (
            <TouchableOpacity
              key={tab.key}
              testID={`tab-${tab.key}`}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <View style={styles.navIconWrap}>
                <MaterialIcons testID={`tab-${tab.key}-icon`} name={tab.icon} size={24} color={tint} />
              </View>
              <Text style={[styles.navText, { color: tint }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slateBg },
  content: { flex: 1, paddingBottom: 76 },
  navBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 76,
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197, 198, 207, 0.65)',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 52,
    borderWidth: 0,
  },
  navItemActive: {},
  navIconWrap: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { fontFamily: fontFamily.interBold, fontSize: 12, lineHeight: 16 },
});
