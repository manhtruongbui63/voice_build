import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { breakpoints, colors, fontFamily } from '../theme/tokens';

const MOBILE_PARTICLES = [
  { size: 3.72888, left: '65.4761%', top: '82.4228%', duration: 5175.04, delay: 1455.79 },
  { size: 2.37812, left: '76.0592%', top: '41.5245%', duration: 5395.35, delay: 1852.56 },
  { size: 4.18886, left: '10.6188%', top: '10.4674%', duration: 3747.29, delay: 1245.18 },
  { size: 3.71084, left: '10.0931%', top: '13.3614%', duration: 6439.75, delay: 1374.23 },
  { size: 5.30383, left: '5.53174%', top: '27.8179%', duration: 4949.08, delay: 1161.41 },
  { size: 5.55754, left: '1.6085%', top: '52.7829%', duration: 5875.39, delay: 1524.86 },
  { size: 4.08822, left: '15.21%', top: '68.2424%', duration: 3057.9, delay: 1381.69 },
  { size: 2.65336, left: '39.3814%', top: '85.2568%', duration: 6875.44, delay: 1321.69 },
  { size: 3.73792, left: '45.26%', top: '41.7905%', duration: 4116.05, delay: 122.859 },
  { size: 5.40353, left: '16.8013%', top: '27.8975%', duration: 5636.49, delay: 1928.36 },
  { size: 3.32507, left: '78.2536%', top: '98.1078%', duration: 4216.63, delay: 649.103 },
  { size: 2.66111, left: '55.7172%', top: '20.0631%', duration: 3133.92, delay: 1839.93 },
  { size: 2.28612, left: '22.589%', top: '14.8574%', duration: 5908.82, delay: 662.114 },
  { size: 3.21694, left: '45.0269%', top: '13.376%', duration: 4563.2, delay: 1556.95 },
  { size: 5.47767, left: '72.9919%', top: '77.0524%', duration: 5017.65, delay: 1297.16 },
] as const;

export const SplashScreen: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= breakpoints.tablet;

  const mobileContentIn = useRef(new Animated.Value(0)).current;
  const mobileLoadingIn = useRef(new Animated.Value(0)).current;
  const mobileLoadingProgress = useRef(new Animated.Value(0)).current;
  const mobileLogoPulse = useRef(new Animated.Value(0)).current;
  const mobileParticles = useRef(MOBILE_PARTICLES.map(() => new Animated.Value(0))).current;

  const tabletLogoFloat = useRef(new Animated.Value(0)).current;
  const tabletLeakA = useRef(new Animated.Value(0)).current;
  const tabletLeakB = useRef(new Animated.Value(0)).current;
  const tabletDots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (isTablet) {
      const logoFloatLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(tabletLogoFloat, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(tabletLogoFloat, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      const leakALoop = Animated.loop(
        Animated.sequence([
          Animated.timing(tabletLeakA, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(tabletLeakA, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      const leakBLoop = Animated.sequence([
        Animated.delay(2000),
        Animated.loop(
          Animated.sequence([
            Animated.timing(tabletLeakB, {
              toValue: 1,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(tabletLeakB, {
              toValue: 0,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ),
      ]);

      const dotLoops = tabletDots.map((dot, index) =>
        Animated.sequence([
          Animated.delay(index * 200),
          Animated.loop(
            Animated.sequence([
              Animated.timing(dot, {
                toValue: 1,
                duration: 500,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(dot, {
                toValue: 0,
                duration: 500,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }),
            ])
          ),
        ])
      );

      logoFloatLoop.start();
      leakALoop.start();
      leakBLoop.start();
      dotLoops.forEach((loop) => loop.start());

      return () => {
        logoFloatLoop.stop();
        leakALoop.stop();
        leakBLoop.stop();
        dotLoops.forEach((loop) => loop.stop());
        tabletLogoFloat.stopAnimation();
        tabletLeakA.stopAnimation();
        tabletLeakB.stopAnimation();
        tabletDots.forEach((dot) => dot.stopAnimation());
      };
    }

    Animated.timing(mobileContentIn, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    Animated.sequence([
      Animated.delay(500),
      Animated.timing(mobileLoadingIn, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    const mobileLogoLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(mobileLogoPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(mobileLogoPulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const mobileLoadingLoop = Animated.loop(
      Animated.timing(mobileLoadingProgress, {
        toValue: 1,
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      })
    );

    const particleLoops = mobileParticles.map((particle, index) =>
      Animated.sequence([
        Animated.delay(MOBILE_PARTICLES[index].delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(particle, {
              toValue: 1,
              duration: MOBILE_PARTICLES[index].duration,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(particle, {
              toValue: 0,
              duration: MOBILE_PARTICLES[index].duration,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ),
      ])
    );

    mobileLogoLoop.start();
    mobileLoadingLoop.start();
    particleLoops.forEach((loop) => loop.start());

    return () => {
      mobileLogoLoop.stop();
      mobileLoadingLoop.stop();
      particleLoops.forEach((loop) => loop.stop());
      mobileContentIn.stopAnimation();
      mobileLoadingIn.stopAnimation();
      mobileLoadingProgress.stopAnimation();
      mobileLogoPulse.stopAnimation();
      mobileParticles.forEach((particle) => particle.stopAnimation());
    };
  }, [
    isTablet,
    mobileContentIn,
    mobileLoadingIn,
    mobileLoadingProgress,
    mobileLogoPulse,
    mobileParticles,
    tabletDots,
    tabletLeakA,
    tabletLeakB,
    tabletLogoFloat,
  ]);

  if (isTablet) {
    return (
      <View style={styles.container}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tabletLeakTop,
            {
              opacity: tabletLeakA.interpolate({
                inputRange: [0, 1],
                outputRange: [0.1, 0.18],
              }),
              transform: [
                {
                  scale: tabletLeakA.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.05],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tabletLeakBottom,
            {
              opacity: tabletLeakB.interpolate({
                inputRange: [0, 1],
                outputRange: [0.1, 0.18],
              }),
              transform: [
                {
                  scale: tabletLeakB.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.05],
                  }),
                },
              ],
            },
          ]}
        />

        <View style={styles.tabletContent}>
          <Animated.View
            style={[
              styles.tabletLogoWrap,
              {
                transform: [
                  {
                    translateY: tabletLogoFloat.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -15],
                    }),
                  },
                ],
              },
            ]}
          >
            <Image
              accessibilityLabel="VoiceBill Logo"
              source={require('../../assets/splash-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
          <Text style={styles.tabletTitle}>VoiceBill</Text>
          <Text style={styles.tabletSubtitle}>Thanh toán & lập hóa đơn bằng giọng nói</Text>
        </View>

        <View style={styles.tabletLoadingContainer}>
          <View style={styles.tabletDots}>
            {tabletDots.map((dot, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.tabletDot,
                  {
                    transform: [
                      {
                        translateY: dot.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -8],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.tabletLoadingText}>Đang tải hệ thống</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Svg
        style={StyleSheet.absoluteFill}
        width={width}
        height={height}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <Defs>
          <RadialGradient id="logoGlow" cx="50%" cy="47%" r="36%">
            <Stop offset="0" stopColor="#62B3EC" stopOpacity={0.3} />
            <Stop offset="0.58" stopColor="#62B3EC" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#62B3EC" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="#05163A" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#logoGlow)" />
      </Svg>

      <Animated.View style={styles.mobileParticles} pointerEvents="none">
        {MOBILE_PARTICLES.map((particle, index) => {
          const progress = mobileParticles[index];
          return (
            <Animated.View
              key={`${particle.left}-${particle.top}`}
              style={[
                styles.mobileParticle,
                {
                  width: particle.size,
                  height: particle.size,
                  borderRadius: particle.size / 2,
                  left: particle.left,
                  top: particle.top,
                  opacity: progress.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.1, 0.4, 0.1],
                  }),
                  transform: [
                    {
                      translateY: progress.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, -20, -40],
                      }),
                    },
                    {
                      scale: progress.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [1, 1.2, 0.8],
                      }),
                    },
                  ],
                },
              ]}
            />
          );
        })}
      </Animated.View>

      <Animated.View
        style={[
          styles.mobileContent,
          {
            opacity: mobileContentIn,
            transform: [
              {
                translateY: mobileContentIn.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.mobileLogoWrap}>
          <Animated.Image
            accessibilityLabel="VoiceBill Logo"
            source={require('../../assets/splash-logo.png')}
            style={[
              styles.logo,
              {
                opacity: mobileLogoPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.5],
                }),
              },
            ]}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.mobileTitle}>VoiceBill</Text>
        <Text style={styles.mobileSubtitle}>Thanh toán & lập hóa đơn bằng giọng nói</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.mobileLoadingContainer,
          {
            opacity: mobileLoadingIn,
            transform: [
              {
                translateY: mobileLoadingIn.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.mobileLoadingTrack}>
          <Animated.View
            style={[
              styles.mobileLoadingFill,
              {
                width: mobileLoadingProgress.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: ['0%', '50%', '100%'],
                }),
                transform: [
                  {
                    translateX: mobileLoadingProgress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, 25, 200],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
        <Text style={styles.mobileLoadingText}>Đang khởi tạo AI...</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#05163A',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },

  // Mobile splash mirrors /Users/admin/Desktop/khoi_tao_sp/code.html.
  mobileParticles: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  mobileParticle: {
    position: 'absolute',
    backgroundColor: '#62B3EC',
  },
  mobileContent: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -48,
    zIndex: 10,
  },
  mobileLogoWrap: {
    width: 128,
    height: 128,
    marginBottom: 24,
  },
  mobileTitle: {
    color: colors.white,
    fontFamily: fontFamily.jakartaBold,
    fontSize: 24,
    letterSpacing: -0.6,
    lineHeight: 32,
    marginBottom: 8,
    textAlign: 'center',
  },
  mobileSubtitle: {
    color: '#76AAD1',
    fontFamily: fontFamily.interRegular,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 280,
    textAlign: 'center',
  },
  mobileLoadingContainer: {
    position: 'absolute',
    bottom: 64,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  mobileLoadingTrack: {
    width: '100%',
    maxWidth: 200,
    height: 4,
    backgroundColor: '#0F295E',
    borderRadius: 999,
    overflow: 'hidden',
  },
  mobileLoadingFill: {
    height: '100%',
    backgroundColor: '#62B3EC',
    borderRadius: 999,
  },
  mobileLoadingText: {
    color: 'rgba(118, 170, 209, 0.7)',
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    letterSpacing: 1.2,
    lineHeight: 20,
    marginTop: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  // Tablet splash mirrors /Users/admin/Desktop/khoi_tao_md/code.html.
  tabletLeakTop: {
    position: 'absolute',
    top: '-20%',
    left: '-10%',
    width: '60%',
    height: '80%',
    borderRadius: 999,
    backgroundColor: '#62B3EC',
  },
  tabletLeakBottom: {
    position: 'absolute',
    right: '-10%',
    bottom: '-30%',
    width: '70%',
    height: '70%',
    borderRadius: 999,
    backgroundColor: '#62B3EC',
  },
  tabletContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  tabletLogoWrap: {
    width: 256,
    height: 256,
    marginBottom: 32,
    shadowColor: '#62B3EC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
  },
  tabletTitle: {
    color: colors.white,
    fontFamily: fontFamily.jakartaBold,
    fontSize: 60,
    letterSpacing: -1.2,
    lineHeight: 72,
    marginBottom: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  tabletSubtitle: {
    color: '#76AAD1',
    fontFamily: fontFamily.interRegular,
    fontSize: 24,
    letterSpacing: 0.5,
    lineHeight: 32,
    maxWidth: 448,
    opacity: 0.9,
    textAlign: 'center',
  },
  tabletLoadingContainer: {
    position: 'absolute',
    bottom: 64,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 16,
  },
  tabletDots: {
    flexDirection: 'row',
    gap: 8,
  },
  tabletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#62B3EC',
  },
  tabletLoadingText: {
    color: 'rgba(118, 170, 209, 0.6)',
    fontFamily: fontFamily.interSemiBold,
    fontSize: 12,
    letterSpacing: 2.4,
    lineHeight: 20,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
