import React from 'react';
import { render } from '@testing-library/react-native';
import { SplashScreen } from '../src/screens/SplashScreen';

describe('SplashScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the brand name, tagline and author', () => {
    const { getByText, unmount } = render(<SplashScreen />);
    expect(getByText('VoiceBill')).toBeTruthy();
    expect(getByText('Giải pháp bán hàng bằng giọng nói')).toBeTruthy();
    expect(getByText('Trường Dev')).toBeTruthy();
    unmount();
  });
});
