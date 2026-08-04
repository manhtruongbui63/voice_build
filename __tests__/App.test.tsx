import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import App from '../App';

jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: () => [true],
}));
jest.mock('../src/services/db', () => ({
  initDB: jest.fn(),
}));
jest.mock('../src/screens/SplashScreen', () => ({
  SplashScreen: () => null,
}));
jest.mock('../src/screens/HomeScreen', () => ({
  HomeScreen: ({ onOpenSettings }: { onOpenSettings: () => void }) => {
    const React = require('react');
    const { Text, TouchableOpacity } = require('react-native');
    return React.createElement(
      TouchableOpacity,
      { onPress: onOpenSettings },
      React.createElement(Text, null, 'Mở cài đặt từ Home')
    );
  },
}));
jest.mock('../src/screens/ProductCatalogScreen', () => ({
  ProductCatalogScreen: () => null,
}));
jest.mock('../src/screens/InvoiceHistoryScreen', () => ({
  InvoiceHistoryScreen: () => null,
}));
jest.mock('../src/screens/SettingsScreen', () => ({
  SettingsScreen: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'Cài đặt Gemini');
  },
}));

describe('App Settings navigation', () => {
  // Màn khởi động giữ tối thiểu ~2.6s trước khi hiện giao diện chính,
  // nên chờ điều hướng xuất hiện thay vì bấm ngay.
  it('opens Settings from the Settings tab', async () => {
    const { getByText, findByText } = render(<App />);

    fireEvent.press(await findByText('Cài Đặt', {}, { timeout: 10000 }));

    expect(getByText('Cài đặt Gemini')).toBeTruthy();
  }, 15000);

  it('wires the Home missing-key action to Settings', async () => {
    const { getByText, findByText } = render(<App />);

    fireEvent.press(await findByText('Mở cài đặt từ Home', {}, { timeout: 10000 }));

    expect(getByText('Cài đặt Gemini')).toBeTruthy();
  }, 15000);
});
