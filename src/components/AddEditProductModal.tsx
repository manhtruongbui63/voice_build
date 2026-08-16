import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  PanResponder,
  type PanResponderGestureState,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Product } from '../types';
import { colors, typography, fontFamily } from '../theme/tokens';

interface Props {
  visible: boolean;
  product?: Product | null;
  onClose: () => void;
  onSave: (
    name: string,
    aliases: string,
    unit: string,
    price: number,
    useAiAlias: boolean
  ) => void | Promise<void>;
  onDelete?: (product: Product) => void;
}

const UNITS = ['kg', 'Túi', 'Bao', 'Yến', 'Tạ', 'Thùng', 'Hộp', 'Gói'];
const DEFAULT_FORM = { name: '', aliases: '', unit: 'kg', price: '' };
const DRAWER_MIN_RATIO = 0.7;
const DRAWER_TOP_INSET = 56;
const UNIT_DROPDOWN_MAX_HEIGHT = 220;

type UnitDropdownPlacement = 'above' | 'below';

export const getProductDrawerGestureAction = (
  gestureState: Pick<PanResponderGestureState, 'dy' | 'vy'>
): 'expand' | 'close' | 'none' => {
  if (gestureState.dy < -40 || gestureState.vy < -0.35) return 'expand';
  if (gestureState.dy > 50 || gestureState.vy > 0.35) return 'close';
  return 'none';
};

export const getProductDrawerDragHeight = ({
  startHeight,
  dy,
  minHeight,
  maxHeight,
}: {
  startHeight: number;
  dy: number;
  minHeight: number;
  maxHeight: number;
}) => Math.min(maxHeight, Math.max(minHeight, startHeight - dy));

export const getProductDrawerDragOffset = ({
  startOffset,
  dy,
  minOffset,
  maxOffset,
}: {
  startOffset: number;
  dy: number;
  minOffset: number;
  maxOffset: number;
}) => Math.min(maxOffset, Math.max(minOffset, startOffset + dy));

export const getProductDrawerMaxHeight = ({
  windowHeight,
  topInset,
}: {
  windowHeight: number;
  topInset: number;
}) => Math.max(1, windowHeight - topInset);

export const getProductDrawerInitialOffset = ({
  maxHeight,
  minRatio,
}: {
  maxHeight: number;
  minRatio: number;
}) => Math.round(maxHeight * (1 - minRatio));

export const getProductDrawerClosedOffset = ({ maxHeight }: { maxHeight: number }) => maxHeight;

export const getUnitDropdownPlacement = ({
  selectY,
  selectHeight,
  sheetHeight,
  actionBarHeight,
  dropdownHeight,
}: {
  selectY: number;
  selectHeight: number;
  sheetHeight: number;
  actionBarHeight: number;
  dropdownHeight: number;
}): UnitDropdownPlacement => {
  const spaceBelow = sheetHeight - actionBarHeight - (selectY + selectHeight);
  return spaceBelow >= dropdownHeight ? 'below' : 'above';
};

export const AddEditProductModal: React.FC<Props> = ({ visible, product, onClose, onSave, onDelete }) => {
  const { height: windowHeight } = useWindowDimensions();
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');
  const [useAiAlias, setUseAiAlias] = useState(true);
  const [unitOpen, setUnitOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drawerSnap, setDrawerSnap] = useState<'half' | 'full'>('half');
  const [actionBarHeight, setActionBarHeight] = useState(0);
  const [unitSelectLayout, setUnitSelectLayout] = useState({ y: 0, height: 56 });
  const maxDrawerHeight = getProductDrawerMaxHeight({ windowHeight, topInset: DRAWER_TOP_INSET });
  const minDrawerHeight = maxDrawerHeight * DRAWER_MIN_RATIO;
  const halfDrawerOffset = getProductDrawerInitialOffset({ maxHeight: maxDrawerHeight, minRatio: DRAWER_MIN_RATIO });
  const drawerTranslateY = useRef(
    new Animated.Value(getProductDrawerClosedOffset({ maxHeight: maxDrawerHeight }))
  ).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const drawerOffset = useRef(halfDrawerOffset);
  const drawerStartOffset = useRef(halfDrawerOffset);
  const resolvedDrawerHeight = drawerSnap === 'full' ? maxDrawerHeight : minDrawerHeight;
  const unitDropdownPlacement = getUnitDropdownPlacement({
    selectY: unitSelectLayout.y,
    selectHeight: unitSelectLayout.height,
    sheetHeight: resolvedDrawerHeight,
    actionBarHeight,
    dropdownHeight: UNIT_DROPDOWN_MAX_HEIGHT,
  });

  const snapDrawerTo = React.useCallback((snap: 'half' | 'full', animated = true) => {
    const nextOffset = snap === 'full' ? 0 : halfDrawerOffset;
    setDrawerSnap(snap);
    drawerOffset.current = nextOffset;
    if (!animated) {
      drawerTranslateY.setValue(nextOffset);
      return;
    }
    Animated.spring(drawerTranslateY, {
      toValue: nextOffset,
      useNativeDriver: true,
      damping: 24,
      stiffness: 240,
      mass: 0.9,
    }).start();
  }, [drawerTranslateY, halfDrawerOffset]);

  const closeDrawer = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(drawerTranslateY, {
        toValue: getProductDrawerClosedOffset({ maxHeight: maxDrawerHeight }),
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [backdropOpacity, drawerTranslateY, maxDrawerHeight, onClose]);

  const initialForm = React.useMemo(
    () =>
      product
        ? {
            name: product.name,
            aliases: product.aliases || '',
            unit: product.unit || 'kg',
            price: product.unit_price ? product.unit_price.toString() : '',
          }
        : DEFAULT_FORM,
    [product]
  );

  const isDirty =
    name !== initialForm.name ||
    aliases !== initialForm.aliases ||
    unit !== initialForm.unit ||
    price !== initialForm.price;

  const requestClose = React.useCallback(() => {
    if (!isDirty) {
      closeDrawer();
      return;
    }

    Alert.alert(
      product ? 'Hủy cập nhật sản phẩm?' : 'Hủy tạo sản phẩm?',
      'Thông tin đã nhập sẽ không được lưu.',
      [
        { text: 'Tiếp tục chỉnh sửa', style: 'cancel' },
        { text: 'Hủy', style: 'destructive', onPress: closeDrawer },
      ]
    );
  }, [closeDrawer, isDirty, product]);

  const drawerPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 2,
        onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dy) > 2,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          drawerStartOffset.current = drawerOffset.current;
        },
        onPanResponderMove: (_, gestureState) => {
          const nextOffset = getProductDrawerDragOffset({
              startOffset: drawerStartOffset.current,
              dy: gestureState.dy,
              minOffset: 0,
              maxOffset: halfDrawerOffset,
            });
          drawerOffset.current = nextOffset;
          drawerTranslateY.setValue(nextOffset);
        },
        onPanResponderRelease: (_, gestureState) => {
          const action = getProductDrawerGestureAction(gestureState);
          if (action === 'expand') {
            snapDrawerTo('full');
            return;
          }
          if (action === 'close') {
            snapDrawerTo(drawerSnap);
            requestClose();
            return;
          }
          snapDrawerTo(drawerOffset.current < halfDrawerOffset / 2 ? 'full' : 'half');
        },
        onPanResponderTerminate: () => {
          snapDrawerTo(drawerOffset.current < halfDrawerOffset / 2 ? 'full' : 'half');
        },
      }),
    [drawerSnap, drawerTranslateY, halfDrawerOffset, requestClose, snapDrawerTo]
  );

  useEffect(() => {
    if (!visible) return;
    setShowSuccess(false);
    setSaving(false);
    setUnitOpen(false);
    // Tạo mới: mặc định bật AI. Sửa: giữ alias thủ công hiện có, người dùng tự bật khi cần.
    setUseAiAlias(!product);
    setDrawerSnap('half');
    drawerOffset.current = halfDrawerOffset;
    drawerTranslateY.setValue(getProductDrawerClosedOffset({ maxHeight: maxDrawerHeight }));
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(drawerTranslateY, {
        toValue: halfDrawerOffset,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    if (product) {
      setName(product.name);
      setAliases(product.aliases || '');
      setUnit(product.unit || 'kg');
      setPrice(product.unit_price ? product.unit_price.toString() : '');
    } else {
      setName('');
      setAliases('');
      setUnit('kg');
      setPrice('');
    }
  }, [backdropOpacity, drawerTranslateY, halfDrawerOffset, maxDrawerHeight, product, visible]);

  const handleSave = async () => {
    // Khi bật AI, bỏ qua validate/ nhập tay alias — backend sẽ tự sinh từ tên sản phẩm.
    if (!name.trim() || !price.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên sản phẩm và giá bán.');
      return;
    }
    if (saving) return;

    try {
      setSaving(true);
      await onSave(
        name.trim(),
        useAiAlias ? '' : aliases.trim(),
        unit.trim(),
        parseFloat(price) || 0,
        useAiAlias
      );
      setShowSuccess(true);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Không thể lưu sản phẩm. Vui lòng thử lại.';
      Alert.alert('Không thể lưu', message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setAliases('');
    setUnit('kg');
    setPrice('');
    setUseAiAlias(true);
    setShowSuccess(false);
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={requestClose}>
      {showSuccess ? (
        <SuccessView onHome={onClose} onAddAnother={resetForm} />
      ) : (
        <View style={styles.overlayRoot}>
          <Animated.View
            testID="product-form-backdrop-dim"
            pointerEvents="none"
            style={[styles.backdropDim, { opacity: backdropOpacity }]}
          />
          <TouchableOpacity
            testID="product-form-backdrop"
            style={styles.backdropHitArea}
            activeOpacity={1}
            onPress={requestClose}
          />
          <Animated.View
            testID="product-form-sheet"
            style={[
              styles.sheet,
              { height: maxDrawerHeight, transform: [{ translateY: drawerTranslateY }] },
            ]}
          >
            <View
              testID="product-drawer-handle"
              style={styles.dragHandleWrap}
              {...drawerPanResponder.panHandlers}
            >
              <View style={styles.dragHandle} />
            </View>

            <ScrollView
              testID="product-form-scroll"
              style={styles.sheetScroll}
              contentContainerStyle={[styles.sheetBody, unitOpen && styles.sheetBodyDropdownOpen]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{product ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</Text>
                <TouchableOpacity
                  testID="product-form-close-button"
                  style={styles.closeBtn}
                  onPress={requestClose}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="close" size={30} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tên sản phẩm</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={product ? 'VD: Gạo ST25 túi 5kg' : 'VD: Gạo ST25'}
                  placeholderTextColor="#C5C6CF"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.aliasLabelRow}>
                  <Text style={styles.formLabel}>{product ? 'Tên gợi nhớ (Alias)' : 'Tên gọi tắt (Alias)'}</Text>
                  <TouchableOpacity
                    testID="product-alias-ai-toggle"
                    style={styles.aiToggle}
                    activeOpacity={0.8}
                    onPress={() => setUseAiAlias((value) => !value)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: useAiAlias }}
                  >
                    <MaterialIcons
                      testID="product-alias-ai-checkbox"
                      name={useAiAlias ? 'check-box' : 'check-box-outline-blank'}
                      size={22}
                      color={useAiAlias ? colors.primary : colors.onSurfaceVariant}
                    />
                    <Text style={styles.aiToggleText}>Sử dụng AI</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.aliasInputWrap}>
                  {!product ? (
                    <MaterialIcons
                      name={useAiAlias ? 'auto-awesome' : 'mic-none'}
                      size={22}
                      color={useAiAlias ? colors.primary : '#C5C6CF'}
                      style={styles.aliasIcon}
                    />
                  ) : null}
                  <TextInput
                    testID="product-alias-input"
                    style={[
                      styles.formInput,
                      !product && styles.aliasInput,
                      useAiAlias && styles.formInputDisabled,
                    ]}
                    placeholder={
                      useAiAlias
                        ? 'AI sẽ tự tạo tên gọi tắt từ tên sản phẩm'
                        : product
                          ? 'Nhập tên gọi khác, cách nhau bằng dấu phẩy'
                          : 'VD: st25, gao thom, gao deo'
                    }
                    placeholderTextColor="#C5C6CF"
                    value={useAiAlias ? '' : aliases}
                    onChangeText={setAliases}
                    editable={!useAiAlias}
                  />
                </View>
                {useAiAlias ? (
                  <Text testID="product-alias-ai-hint" style={styles.aiHint}>
                    Alias sẽ được AI phân tích và tạo tự động từ tên sản phẩm khi lưu.
                  </Text>
                ) : null}
              </View>

              <View testID="product-inline-row" style={styles.inlineRow}>
                <View testID="product-price-field" style={styles.inlineField}>
                  <Text style={styles.formLabel}>Giá bán</Text>
                  <View style={styles.priceInputWrap}>
                    <TextInput
                      style={styles.priceInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#C5C6CF"
                      value={price}
                      onChangeText={setPrice}
                    />
                    <Text style={styles.priceSuffix}>đ</Text>
                  </View>
                </View>

                <View
                  testID="product-unit-field"
                  style={[styles.inlineField, styles.unitField]}
                  onLayout={(event) =>
                    setUnitSelectLayout({
                      y: event.nativeEvent.layout.y,
                      height: event.nativeEvent.layout.height,
                    })
                  }
                >
                  <Text style={styles.formLabel}>Đơn vị</Text>
                  <TouchableOpacity
                    testID="product-unit-select"
                    style={styles.formInputBox}
                    onPress={() => setUnitOpen((open) => !open)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.formInputText}>{unit}</Text>
                    <MaterialIcons
                      testID="product-unit-arrow"
                      name={unitOpen ? 'expand-less' : 'expand-more'}
                      size={28}
                      color={colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                  {unitOpen ? (
                    <View
                      testID="product-unit-dropdown"
                      style={[
                        styles.unitDropdown,
                        unitDropdownPlacement === 'above' ? styles.unitDropdownAbove : styles.unitDropdownBelow,
                      ]}
                    >
                      <ScrollView
                        testID="product-unit-dropdown-scroll"
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={UNITS.length > 5}
                      >
                        {UNITS.map((u) => (
                          <TouchableOpacity
                            key={u}
                            style={styles.unitOption}
                            onPress={() => { setUnit(u); setUnitOpen(false); }}
                          >
                            <Text style={[styles.unitOptionText, u === unit && styles.unitOptionActive]}>{u}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>
              </View>
            </ScrollView>

            <View
              testID="product-form-action-bar"
              style={[styles.actionBar, !product && styles.createActionBar]}
              onLayout={(event) => setActionBarHeight(event.nativeEvent.layout.height)}
            >
              {product ? (
                <TouchableOpacity
                  testID="product-delete-button"
                  style={styles.deleteAction}
                  activeOpacity={0.9}
                  onPress={() => product && onDelete?.(product)}
                >
                  <MaterialIcons
                    testID="product-delete-icon"
                    name="delete-outline"
                    size={16}
                    color={colors.white}
                    style={styles.actionIcon}
                  />
                  <Text testID="product-delete-label" style={styles.deleteActionText}>Xóa</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                testID="product-save-button"
                style={[styles.saveBtn, product && styles.saveBtnCompact, saving && styles.saveBtnDisabled]}
                activeOpacity={0.9}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <ActivityIndicator testID="product-save-spinner" size="small" color={colors.white} />
                    <Text testID="product-save-label" style={styles.saveText}>
                      {useAiAlias ? 'Đang tạo Alias…' : 'Đang lưu…'}
                    </Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons
                      testID="product-save-icon"
                      name="save"
                      size={16}
                      color={colors.white}
                      style={styles.actionIcon}
                    />
                    <Text testID="product-save-label" style={styles.saveText}>{product ? 'Lưu thay đổi' : 'Tạo sản phẩm'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}
    </Modal>
  );
};

const FIREWORK_COLORS = ['#05163A', '#B29469', '#62B3EC', '#76AAD1', '#EAF4FB', '#F59E0B'];

// Một chùm pháo hoa: các hạt nổ tỏa tròn từ một điểm, rơi nhẹ theo trọng lực rồi mờ dần.
const Burst: React.FC<{
  originX: `${number}%`;
  originY: `${number}%`;
  count: number;
  delay: number;
}> = ({
  originX,
  originY,
  count,
  delay,
}) => {
  const progress = useRef(new Animated.Value(0)).current;
  const particles = useRef(
    Array.from({ length: count }, (_, i) => ({
      angle: (Math.PI * 2 * i) / count + Math.random() * 0.4,
      dist: 90 + Math.random() * 150,
      size: 6 + Math.random() * 6,
      color: FIREWORK_COLORS[i % FIREWORK_COLORS.length],
    }))
  ).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(700 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, delay]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
      {particles.map((p, i) => {
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * p.dist] });
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(p.angle) * p.dist + 70],
        });
        const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
        const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: originX,
              top: originY,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateX }, { translateY }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
};

const Fireworks: React.FC = () => (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Burst originX="50%" originY="34%" count={16} delay={0} />
    <Burst originX="26%" originY="26%" count={14} delay={350} />
    <Burst originX="74%" originY="30%" count={14} delay={650} />
  </View>
);

const SuccessView: React.FC<{ onHome: () => void; onAddAnother: () => void }> = ({ onHome, onAddAnother }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const countdown = useRef(new Animated.Value(1)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    Animated.timing(countdown, { toValue: 0, duration: 3000, easing: Easing.linear, useNativeDriver: false }).start();
    timer.current = setTimeout(() => onHome(), 3000);
    return () => {
      loop.stop();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pulse, countdown, onHome]);

  const stopTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return (
    <View style={styles.successContainer}>
      <Fireworks />
      <View style={styles.successCenter}>
        <View style={styles.iconWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulseRing,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
              },
            ]}
          />
          <View style={styles.iconCircle}>
            <MaterialIcons name="check-circle" size={80} color={colors.white} />
          </View>
        </View>
        <Text style={styles.successTitle}>Tạo sản phẩm thành công!</Text>
        <Text style={styles.successSubtitle}>Sản phẩm đã được thêm vào cửa hàng của bạn.</Text>
        <View style={styles.countdownTrack}>
          <Animated.View
            style={[
              styles.countdownBar,
              { width: countdown.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
      </View>

      <View style={styles.successActions}>
        <TouchableOpacity
          style={styles.homeBtn}
          activeOpacity={0.9}
          onPress={() => { stopTimer(); onHome(); }}
        >
          <MaterialIcons name="home" size={22} color={colors.white} />
          <Text style={styles.homeBtnText}>Quay về trang chủ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addMoreBtn}
          activeOpacity={0.9}
          onPress={() => { stopTimer(); onAddAnother(); }}
        >
          <MaterialIcons name="add-circle" size={22} color={colors.primary} />
          <Text style={styles.addMoreText}>Tiếp tục thêm sản phẩm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdropDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 30, 47, 0.4)',
  },
  backdropHitArea: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: '100%',
    overflow: 'visible',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#F6FAFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 16,
  },
  dragHandleWrap: {
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 10,
  },
  dragHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#C5C6CF',
  },
  sheetScroll: {
    flex: 1,
  },
  sheetBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  sheetBodyDropdownOpen: {
    paddingBottom: 180,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: {
    flex: 1,
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 24,
    lineHeight: 32,
    color: '#001E2F',
  },
  closeBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D5EBFF',
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    fontFamily: fontFamily.interMedium,
    fontSize: 14,
    lineHeight: 20,
    color: '#45464E',
  },
  formInput: {
    minHeight: 56,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 0,
    backgroundColor: '#E0F0FF',
    fontFamily: fontFamily.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: '#001E2F',
  },
  aliasLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  aiToggleText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
  },
  formInputDisabled: {
    backgroundColor: '#EDF2F7',
    color: '#9AA5B1',
  },
  aiHint: {
    fontFamily: fontFamily.interRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
  },
  aliasInputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  aliasIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
  },
  aliasInput: {
    paddingLeft: 48,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  inlineField: {
    flex: 1,
    gap: 8,
  },
  unitField: {
    zIndex: 40,
  },
  formInputBox: {
    minHeight: 56,
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E0F0FF',
  },
  formInputText: {
    fontFamily: fontFamily.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: '#001E2F',
  },
  priceInputWrap: {
    minHeight: 56,
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F0FF',
  },
  priceInput: {
    flex: 1,
    padding: 0,
    textAlign: 'right',
    fontFamily: fontFamily.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: '#001E2F',
  },
  priceSuffix: {
    marginLeft: 12,
    fontFamily: fontFamily.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: '#45464E',
  },
  unitDropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    maxHeight: UNIT_DROPDOWN_MAX_HEIGHT,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariantSoft,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 50,
  },
  unitDropdownBelow: {
    top: 84,
  },
  unitDropdownAbove: {
    bottom: 64,
  },
  unitOption: { paddingVertical: 10, paddingHorizontal: 16 },
  unitOptionText: { ...typography.bodyMd, color: colors.onSurface },
  unitOptionActive: { color: colors.primary, fontFamily: fontFamily.interSemiBold },
  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: colors.white,
    flexDirection: 'row',
    gap: 16,
  },
  createActionBar: {
    paddingTop: 18,
    paddingBottom: 66,
    backgroundColor: '#F6FAFF',
  },
  saveBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  saveBtnCompact: {
    borderRadius: 8,
  },
  saveText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
  },
  actionIcon: {
    fontSize: 16,
    lineHeight: 24,
  },
  deleteAction: {
    flex: 1,
    minHeight: 56,
    borderRadius: 8,
    backgroundColor: colors.errorCrimson,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteActionText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
  },
  // Success
  successContainer: { flex: 1, backgroundColor: colors.slateBg },
  successCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  pulseRing: { position: 'absolute', width: 128, height: 128, borderRadius: 64, backgroundColor: colors.primary },
  iconCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  successTitle: { ...typography.headlineLgMobile, fontSize: 28, lineHeight: 36, color: colors.onSurface, textAlign: 'center', marginBottom: 12 },
  successSubtitle: { ...typography.bodyLg, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 24 },
  countdownTrack: { width: 240, height: 6, borderRadius: 3, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  countdownBar: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  successActions: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  homeBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  homeBtnText: { ...typography.headlineMd, color: colors.white },
  addMoreBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  addMoreText: { ...typography.labelMd, fontSize: 16, color: colors.primary },
});
