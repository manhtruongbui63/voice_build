import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Defs,
  Rect,
  LinearGradient,
  RadialGradient,
  Stop,
  G,
  Circle,
} from 'react-native-svg';
import { colors, typography } from '../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Vòng lặp 0↔1 vô hạn (dùng cho vầng sáng nền + chấm nhấp nháy).
const loop = (value: Animated.Value, duration: number) =>
  Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1,
        duration: duration / 2,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(value, {
        toValue: 0,
        duration: duration / 2,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    ])
  );

export const SplashScreen: React.FC = () => {
  const { width, height } = useWindowDimensions();

  // Hiệu ứng vào (opacity/translate) — chạy trên native driver.
  const titleAnim = useRef(new Animated.Value(0)).current;
  const loaderAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;

  // Thanh tiến trình + vầng sáng + chấm — chạy trên JS driver (layout/props svg).
  const progress = useRef(new Animated.Value(0)).current;
  const glow1 = useRef(new Animated.Value(0)).current;
  const glow2 = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  // Logo chỉ hiện (fade-in) sau khi ảnh decode xong — tránh khung placeholder mờ.
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
    ]).start();
    Animated.sequence([
      Animated.delay(600),
      Animated.timing(loaderAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
    Animated.sequence([
      Animated.delay(1000),
      Animated.timing(footerAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(progress, {
      toValue: 1,
      duration: 3000,
      easing: Easing.bezier(0.65, 0, 0.35, 1),
      useNativeDriver: false,
    }).start();

    const anims = [
      loop(glow1, 25000),
      loop(glow2, 30000),
      loop(dot1, 1000),
      Animated.sequence([Animated.delay(200), loop(dot2, 1000)]),
      Animated.sequence([Animated.delay(400), loop(dot3, 1000)]),
    ];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [titleAnim, loaderAnim, footerAnim, progress, glow1, glow2, dot1, dot2, dot3]);

  const dotStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) },
    ],
  });

  return (
    <View style={styles.container}>
      {/* Nền gradient + 2 vầng sáng trắng trôi chậm */}
      <Svg
        style={StyleSheet.absoluteFill}
        width={width}
        height={height}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="0.5" stopColor={colors.primaryActive} />
            <Stop offset="1" stopColor={colors.primaryContainer} />
          </LinearGradient>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.white} stopOpacity={0.35} />
            <Stop offset="1" stopColor={colors.white} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#bg)" />
        <G opacity={0.3}>
          <AnimatedCircle
            cx={glow1.interpolate({ inputRange: [0, 1], outputRange: [20, 80] })}
            cy={glow1.interpolate({ inputRange: [0, 1], outputRange: [20, 50] })}
            r={40}
            fill="url(#glow)"
          />
          <AnimatedCircle
            cx={glow2.interpolate({ inputRange: [0, 1], outputRange: [80, 30] })}
            cy={glow2.interpolate({ inputRange: [0, 1], outputRange: [80, 20] })}
            r={50}
            fill="url(#glow)"
          />
        </G>
      </Svg>

      {/* Nội dung giữa màn */}
      <View style={styles.content}>
        <Animated.Image
          source={require('../../assets/splash-logo.png')}
          style={[styles.logo, { opacity: logoOpacity }]}
          resizeMode="contain"
          fadeDuration={0}
          onLoad={() =>
            Animated.timing(logoOpacity, {
              toValue: 1,
              duration: 300,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }).start()
          }
        />

        <Animated.View
          style={{
            opacity: titleAnim,
            transform: [
              {
                translateY: titleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
            alignItems: 'center',
          }}
        >
          <Text style={styles.title}>VoiceBill</Text>
          <Text style={styles.subtitle}>Giải pháp bán hàng bằng giọng nói</Text>
        </Animated.View>

        <Animated.View style={[styles.loaderBlock, { opacity: loaderAnim }]}>
          <View style={styles.track}>
            <View style={styles.trackBg} />
            <Animated.View
              style={[
                styles.fill,
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <View style={styles.dots}>
            <Animated.View style={[styles.dot, dotStyle(dot1)]} />
            <Animated.View style={[styles.dot, dotStyle(dot2)]} />
            <Animated.View style={[styles.dot, dotStyle(dot3)]} />
          </View>
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View style={[styles.footer, { opacity: footerAnim }]}>
        <Text style={styles.footerText}>Trường Dev</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  logo: {
    width: 180,
    height: 180,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: colors.neutral900,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    ...typography.headlineLg,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.2,
    color: colors.white,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyLg,
    color: colors.white,
    opacity: 0.9,
    maxWidth: 320,
    textAlign: 'center',
    marginTop: 16,
  },
  loaderBlock: {
    marginTop: 48,
    width: '100%',
    maxWidth: 200,
    alignItems: 'center',
    gap: 16,
  },
  track: {
    height: 4,
    width: '100%',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  trackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.white,
    opacity: 0.2,
    borderRadius: 9999,
  },
  fill: {
    height: '100%',
    borderRadius: 9999,
    backgroundColor: colors.white,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  footer: { alignItems: 'center', paddingBottom: 48 },
  footerText: {
    ...typography.labelMd,
    color: colors.white,
    opacity: 0.7,
    letterSpacing: 2.1,
    textTransform: 'uppercase',
  },
});
