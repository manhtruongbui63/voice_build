import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import App from '../App';

jest.mock('../src/services/db', () => ({
  initDB: jest.fn(),
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
  it('opens Settings from the Settings tab', () => {
    const { getByText } = render(<App />);

    fireEvent.press(getByText('Cài đặt'));

    expect(getByText('Cài đặt Gemini')).toBeTruthy();
  });

  it('wires the Home missing-key action to Settings', () => {
    const { getByText } = render(<App />);

    fireEvent.press(getByText('Mở cài đặt từ Home'));

    expect(getByText('Cài đặt Gemini')).toBeTruthy();
  });
});
