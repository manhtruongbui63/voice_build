import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography } from '../theme/tokens';

type Variant = 'success' | 'warning' | 'error';

const VARIANT: Record<Variant, { bg: string; border: string; fg: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  success: { bg: colors.primarySoft, border: colors.primaryContainerBorder, fg: colors.onPrimaryContainer, icon: 'check-circle' },
  warning: { bg: colors.warningSurface, border: colors.warningAmber, fg: colors.onSurface, icon: 'warning' },
  error: { bg: colors.errorContainerFaint, border: colors.errorCrimson, fg: colors.onSurface, icon: 'error' },
};

interface Props {
  visible: boolean;
  variant: Variant;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export const Toast: React.FC<Props> = ({ visible, variant, title, subtitle, onClose }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const style = VARIANT[variant];

  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(onClose);
    }, 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [visible, anim, onClose]);

  if (!visible) return null;
  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: style.bg, borderColor: style.border },
        { opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] },
      ]}
    >
      <View style={styles.left}>
        <MaterialIcons name={style.icon} size={22} color={style.border} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: style.fg }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: style.fg }]}>{subtitle}</Text> : null}
        </View>
      </View>
      <TouchableOpacity onPress={onClose}>
        <MaterialIcons name="close" size={20} color={style.fg} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: colors.neutral900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  title: { ...typography.labelMd },
  subtitle: { ...typography.bodySm, opacity: 0.8 },
});
