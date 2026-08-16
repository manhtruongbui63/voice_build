import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme/tokens';

interface Props {
  radius?: number;
  strokeWidth?: number;
  /** Màu vệt sáng quét quanh viền (mặc định navy như thiết kế). */
  color?: string;
  /** Màu nền phần giữa (che để chỉ lộ viền). */
  fillColor?: string;
  duration?: number;
}

/**
 * Viền bo góc với một vệt sáng quét vòng quanh — mô phỏng conic-gradient xoay của web.
 * Kỹ thuật: xoay một hình gradient (trong suốt -> màu) bằng transform + native driver
 * (chạy trên UI thread nên MƯỢT), rồi che phần giữa để chỉ lộ dải viền.
 */
const RunningBorderBase: React.FC<Props> = ({
  radius = 16,
  strokeWidth = 4,
  color = colors.primary,
  fillColor = colors.white,
  duration = 5000,
}) => {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true, // xoay trên UI thread -> mượt
      })
    );
    loop.start();
    return () => loop.stop();
  }, [duration, spin]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current.w === width && current.h === height ? current : { w: width, h: height }
    );
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // Hình vuông đủ lớn để khi xoay luôn phủ kín thẻ.
  const diag = Math.ceil(Math.sqrt(size.w * size.w + size.h * size.h));

  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
    >
      {size.w > 0 && size.h > 0 ? (
        <>
          <Animated.View
            style={{
              position: 'absolute',
              width: diag,
              height: diag,
              left: (size.w - diag) / 2,
              top: (size.h - diag) / 2,
              transform: [{ rotate }],
            }}
          >
            <Svg width={diag} height={diag}>
              <Defs>
                <LinearGradient id="beam" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={color} stopOpacity="0" />
                  <Stop offset="0.68" stopColor={color} stopOpacity="0" />
                  <Stop offset="1" stopColor={color} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect width={diag} height={diag} fill="url(#beam)" />
            </Svg>
          </Animated.View>
          {/* Lớp che giữa: chỉ chừa dải viền dày strokeWidth */}
          <View
            style={{
              position: 'absolute',
              top: strokeWidth,
              left: strokeWidth,
              right: strokeWidth,
              bottom: strokeWidth,
              borderRadius: Math.max(0, radius - strokeWidth),
              backgroundColor: fillColor,
            }}
          />
        </>
      ) : null}
    </View>
  );
};

export const RunningBorder = React.memo(RunningBorderBase);
