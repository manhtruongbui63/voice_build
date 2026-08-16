import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import App from '../App';
import { colors } from '../src/theme/tokens';

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

    fireEvent.press(await findByText('Cài đặt', {}, { timeout: 10000 }));

    expect(getByText('Cài đặt Gemini')).toBeTruthy();
  }, 15000);

  it('wires the Home missing-key action to Settings', async () => {
    const { getByText, findByText } = render(<App />);

    fireEvent.press(await findByText('Mở cài đặt từ Home', {}, { timeout: 10000 }));

    expect(getByText('Cài đặt Gemini')).toBeTruthy();
  }, 15000);

  it('anchors the bottom menu and styles the active tab without a clipped border', async () => {
    const { findByTestId, findByText } = render(<App />);

    expect(StyleSheet.flatten((await findByTestId('bottom-tab-bar', {}, { timeout: 10000 })).props.style)).toMatchObject({
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: 10,
    });
    expect(StyleSheet.flatten((await findByTestId('tab-home')).props.style)).toMatchObject({
      borderWidth: 0,
    });
    expect(StyleSheet.flatten((await findByTestId('tab-home-icon')).props.style)).toMatchObject({
      color: colors.secondary,
    });
    expect(StyleSheet.flatten((await findByText('Bán hàng')).props.style)).toMatchObject({
      color: colors.secondary,
      fontFamily: 'Inter_700Bold',
    });
  }, 15000);
});
