import React from 'react';
import { render } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { SplashScreen } from '../src/screens/SplashScreen';

describe('SplashScreen', () => {
  const mockViewport = (width: number, height: number) => {
    Dimensions.set({
      window: { width, height, scale: 2, fontScale: 1 },
      screen: { width, height, scale: 2, fontScale: 1 },
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockViewport(390, 844);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the mobile splash content', () => {
    const { getByLabelText, getByText, queryByText, unmount } = render(<SplashScreen />);
    expect(getByLabelText('VoiceBill Logo')).toBeTruthy();
    expect(getByText('VoiceBill')).toBeTruthy();
    expect(getByText('Thanh toán & lập hóa đơn bằng giọng nói')).toBeTruthy();
    expect(getByText('Đang khởi tạo AI...')).toBeTruthy();
    expect(queryByText('Đang tải hệ thống')).toBeNull();
    expect(queryByText('Trường Dev')).toBeNull();
    unmount();
  });

  it('renders the tablet splash loading indicator', () => {
    mockViewport(1024, 768);
    const { getByLabelText, getByText, queryByText, unmount } = render(<SplashScreen />);
    expect(getByLabelText('VoiceBill Logo')).toBeTruthy();
    expect(getByText('VoiceBill')).toBeTruthy();
    expect(getByText('Thanh toán & lập hóa đơn bằng giọng nói')).toBeTruthy();
    expect(getByText('Đang tải hệ thống')).toBeTruthy();
    expect(queryByText('Đang khởi tạo AI...')).toBeNull();
    expect(queryByText('Trường Dev')).toBeNull();
    unmount();
  });
});
