import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { AppHeader } from '../src/components/AppHeader';
import { colors } from '../src/theme/tokens';

describe('AppHeader', () => {
  it('uses the sales header as the shared app header baseline', () => {
    const { getByTestId, getByText } = render(<AppHeader testID="shared-header" />);

    expect(StyleSheet.flatten(getByTestId('shared-header').props.style)).toMatchObject({
      backgroundColor: colors.primary,
    });
    expect(StyleSheet.flatten(getByTestId('shared-header-container').props.style)).toMatchObject({
      height: 64,
      paddingHorizontal: 16,
      backgroundColor: colors.primary,
    });
    expect(StyleSheet.flatten(getByText('VoiceBill').props.style)).toMatchObject({
      color: colors.white,
      fontSize: 20,
    });
    expect(StyleSheet.flatten(getByTestId('shared-header-action').props.style)).toMatchObject({
      borderColor: colors.white,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    });
  });

  it('keeps screen-specific header actions without changing the layout shell', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <AppHeader
        testID="product-header-safe"
        actionTestID="select-mode-toggle"
        actionIcon="check"
        actionActive
        onActionPress={onPress}
      />
    );

    fireEvent.press(getByTestId('select-mode-toggle'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(getByTestId('product-header-safe-container').props.style)).toMatchObject({
      height: 64,
      paddingHorizontal: 16,
    });
  });
});
