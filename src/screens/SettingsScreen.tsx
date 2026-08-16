import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  deleteGeminiApiKey,
  getGeminiApiKey,
  saveGeminiApiKey,
  validateGeminiApiKey,
  getDefaultPaymentMethod,
  setDefaultPaymentMethod,
} from '../services/geminiSettingsService';
import {
  getStoreProfile,
  saveStoreProfile,
  getCurrencyFormat,
  saveCurrencyFormat,
  formatCurrencyPreview,
  type CurrencyFormat,
} from '../services/storeSettingsService';
import { clearAllInvoicesFromDB } from '../services/db';
import { PaymentMethod } from '../types';
import { colors, fontFamily, radius } from '../theme/tokens';

const SAFE_VALIDATION_MESSAGES = new Set<string>([
  'Vui lòng nhập Gemini API Key',
  'API Key không hợp lệ hoặc đã bị thu hồi',
  'Gemini đang giới hạn lượt sử dụng',
  'Không thể kết nối Gemini',
  'Không thể xử lý yêu cầu Gemini',
]);

const getSafeSaveErrorMessage = (error: unknown): string =>
  error instanceof Error && SAFE_VALIDATION_MESSAGES.has(error.message)
    ? error.message
    : 'Không thể kiểm tra hoặc lưu API Key';

const PREVIEW_AMOUNT = 1250000;

/**
 * ⚠️ CHỈ DÙNG KHI TEST / THỬ NGHIỆM.
 * Trước khi phát hành production, đặt DANGER_RESET_ENABLED = false để ẩn hoàn toàn
 * tính năng "Xóa dữ liệu hóa đơn & báo cáo".
 */
const DANGER_RESET_ENABLED = true;
// Mật khẩu xác nhận xóa (phân biệt hoa/thường và khoảng trắng).
const DANGER_RESET_PASSWORD = 'Admin0961980030';

export const SettingsScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 1024;
  // Thông tin cửa hàng
  const [storeName, setStoreName] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  // Vận hành bán hàng
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('chuyển khoản');
  const [currencyFormat, setCurrencyFormat] = useState<CurrencyFormat>('symbol');
  // Snapshot ban đầu để phát hiện thay đổi (dirty).
  const [initialForm, setInitialForm] = useState({
    storeName: '',
    storePhone: '',
    storeAddress: '',
    paymentMethod: 'chuyển khoản' as PaymentMethod,
    currencyFormat: 'symbol' as CurrencyFormat,
  });
  const [savingAll, setSavingAll] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');

  // Gemini API Key
  const [apiKey, setApiKey] = useState('');
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [resettingData, setResettingData] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [resetPasswordRevealed, setResetPasswordRevealed] = useState(false);

  const storageStateVersion = useRef(0);
  const operationLock = useRef(false);
  const isOperationPending = isSaving || isDeleting;

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      const loadVersion = storageStateVersion.current;

      try {
        const [storedKey, storedMethod, profile, currency] = await Promise.all([
          getGeminiApiKey(),
          getDefaultPaymentMethod(),
          getStoreProfile(),
          getCurrencyFormat(),
        ]);
        if (!isMounted || loadVersion !== storageStateVersion.current) return;

        setHasStoredKey(Boolean(storedKey));
        if (storedKey) {
          setApiKey(storedKey);
          setMessage('Đã kết nối');
        }
        const nextMethod = storedMethod ?? 'chuyển khoản';
        setPaymentMethod(nextMethod);
        setStoreName(profile.name);
        setStorePhone(profile.phone);
        setStoreAddress(profile.address);
        setCurrencyFormat(currency);
        setInitialForm({
          storeName: profile.name,
          storePhone: profile.phone,
          storeAddress: profile.address,
          paymentMethod: nextMethod,
          currencyFormat: currency,
        });
      } catch {
        if (!isMounted || loadVersion !== storageStateVersion.current) return;
        setIsError(true);
        setMessage('Không thể tải API Key đã lưu');
      }
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const isDirty =
    storeName !== initialForm.storeName ||
    storePhone !== initialForm.storePhone ||
    storeAddress !== initialForm.storeAddress ||
    paymentMethod !== initialForm.paymentMethod ||
    currencyFormat !== initialForm.currencyFormat;

  const currencyPreview = useMemo(
    () => formatCurrencyPreview(PREVIEW_AMOUNT, currencyFormat),
    [currencyFormat]
  );

  const markChanged = () => setSavedNotice('');

  const handleSaveAll = async () => {
    if (!isDirty || savingAll) return;
    setSavingAll(true);
    setSavedNotice('');
    try {
      await Promise.all([
        saveStoreProfile({ name: storeName.trim(), phone: storePhone.trim(), address: storeAddress.trim() }),
        saveCurrencyFormat(currencyFormat),
        setDefaultPaymentMethod(paymentMethod),
      ]);
      setInitialForm({
        storeName: storeName.trim(),
        storePhone: storePhone.trim(),
        storeAddress: storeAddress.trim(),
        paymentMethod,
        currencyFormat,
      });
      setStoreName((value) => value.trim());
      setStorePhone((value) => value.trim());
      setStoreAddress((value) => value.trim());
      setSavedNotice('Đã lưu thay đổi');
    } catch {
      Alert.alert('Không thể lưu', 'Đã xảy ra lỗi khi lưu thay đổi. Vui lòng thử lại.');
    } finally {
      setSavingAll(false);
    }
  };

  const handleTestConnection = async () => {
    if (operationLock.current) return;

    const trimmedKey = apiKey.trim();
    operationLock.current = true;
    setIsSaving(true);
    setIsError(false);
    setMessage('');

    try {
      await validateGeminiApiKey(trimmedKey);
      await saveGeminiApiKey(trimmedKey);
      storageStateVersion.current += 1;
      setHasStoredKey(true);
      setMessage('Đã kết nối');
    } catch (error) {
      setIsError(true);
      setMessage(getSafeSaveErrorMessage(error));
    } finally {
      operationLock.current = false;
      setIsSaving(false);
    }
  };

  const handleCopyKey = async () => {
    if (!apiKey.trim()) return;
    try {
      await Clipboard.setStringAsync(apiKey.trim());
      setSavedNotice('');
      setIsError(false);
      setMessage('Đã sao chép API Key');
    } catch {
      // Bỏ qua lỗi clipboard (không ảnh hưởng dữ liệu).
    }
  };

  const handleDelete = () => {
    if (operationLock.current) return;

    Alert.alert(
      'Xóa API Key',
      'VoiceBill sẽ không thể phân tích hóa đơn bằng AI cho đến khi bạn thêm key mới.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            if (operationLock.current) return;

            operationLock.current = true;
            setIsDeleting(true);
            try {
              await deleteGeminiApiKey();
              storageStateVersion.current += 1;
              setApiKey('');
              setHasStoredKey(false);
              setIsError(false);
              setMessage('Đã xóa API Key');
            } catch {
              setIsError(true);
              setMessage('Không thể xóa API Key');
            } finally {
              operationLock.current = false;
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const openResetModal = () => {
    if (operationLock.current || resettingData) return;
    setResetPassword('');
    setResetPasswordError('');
    setResetPasswordRevealed(false);
    setResetModalVisible(true);
  };

  const closeResetModal = () => {
    setResetModalVisible(false);
    setResetPassword('');
    setResetPasswordError('');
    setResetPasswordRevealed(false);
  };

  const confirmResetReportData = () => {
    if (operationLock.current || resettingData) return;

    if (resetPassword !== DANGER_RESET_PASSWORD) {
      setResetPasswordError('Mật khẩu không đúng. Vui lòng thử lại.');
      return;
    }

    operationLock.current = true;
    setResettingData(true);
    try {
      clearAllInvoicesFromDB();
      setIsError(false);
      setMessage('Đã xóa toàn bộ dữ liệu hóa đơn & báo cáo');
      closeResetModal();
    } catch {
      setResetPasswordError('Không thể xóa dữ liệu. Vui lòng thử lại.');
    } finally {
      operationLock.current = false;
      setResettingData(false);
    }
  };

  const renderResetDataButton = () => (
    <TouchableOpacity
      testID="settings-reset-data-button"
      disabled={resettingData}
      onPress={openResetModal}
      style={[styles.resetDataButton, resettingData && styles.disabledButton]}
      activeOpacity={0.85}
    >
      {resettingData ? (
        <ActivityIndicator color={colors.errorCrimson} />
      ) : (
        <>
          <MaterialIcons name="delete-sweep" size={20} color={colors.errorCrimson} />
          <Text style={styles.resetDataButtonText}>Xóa dữ liệu hóa đơn & báo cáo</Text>
        </>
      )}
    </TouchableOpacity>
  );

  const renderResetPasswordModal = () => (
    <Modal
      transparent
      visible={resetModalVisible}
      animationType="fade"
      onRequestClose={closeResetModal}
    >
      <View style={styles.resetOverlay}>
        <View testID="settings-reset-modal" style={styles.resetModal}>
          <View style={styles.resetModalIcon}>
            <MaterialIcons name="lock" size={26} color={colors.errorCrimson} />
          </View>
          <Text style={styles.resetModalTitle}>Xác nhận xóa dữ liệu</Text>
          <Text style={styles.resetModalDesc}>
            Toàn bộ hóa đơn & báo cáo sẽ bị xóa vĩnh viễn (giữ lại sản phẩm và API Key).
            Nhập mật khẩu quản trị để tiếp tục.
          </Text>

          <View style={[styles.resetInputRow, !!resetPasswordError && styles.resetInputError]}>
            <TextInput
              testID="settings-reset-password-input"
              style={styles.resetInputField}
              value={resetPassword}
              onChangeText={(v) => {
                setResetPassword(v);
                if (resetPasswordError) setResetPasswordError('');
              }}
              placeholder="Mật khẩu"
              placeholderTextColor={colors.outline}
              secureTextEntry={!resetPasswordRevealed}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={confirmResetReportData}
            />
            <TouchableOpacity
              testID="settings-reset-password-eye"
              style={styles.resetEyeButton}
              onPress={() => setResetPasswordRevealed((v) => !v)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: resetPasswordRevealed }}
            >
              <MaterialIcons
                name={resetPasswordRevealed ? 'visibility-off' : 'visibility'}
                size={20}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>
          {resetPasswordError ? (
            <Text testID="settings-reset-password-error" style={styles.resetErrorText}>{resetPasswordError}</Text>
          ) : null}

          <View style={styles.resetModalActions}>
            <TouchableOpacity
              testID="settings-reset-cancel"
              style={styles.resetCancelBtn}
              onPress={closeResetModal}
              activeOpacity={0.85}
            >
              <Text style={styles.resetCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="settings-reset-confirm"
              style={[styles.resetConfirmBtn, resettingData && styles.disabledButton]}
              onPress={confirmResetReportData}
              disabled={resettingData}
              activeOpacity={0.9}
            >
              {resettingData ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.resetConfirmText}>Xóa dữ liệu</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderRadioRow = (
    selected: boolean,
    label: string,
    icon: React.ComponentProps<typeof MaterialIcons>['name'] | null,
    onPress: () => void,
    testID: string
  ) => (
    <TouchableOpacity
      testID={testID}
      style={[styles.radioRow, selected && styles.radioRowActive]}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <MaterialIcons
        name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
        size={20}
        color={selected ? colors.primary : colors.outline}
      />
      {icon ? (
        <MaterialIcons name={icon} size={20} color={selected ? colors.primary : colors.onSurfaceVariant} />
      ) : null}
      <Text style={[styles.radioLabel, selected && styles.radioLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );

  // ===== Tablet (≥1024px) =====
  const tabletStoreField = (
    label: string,
    icon: React.ComponentProps<typeof MaterialIcons>['name'],
    value: string,
    onChange: (v: string) => void,
    testID: string,
    placeholder: string,
    keyboardType?: 'phone-pad'
  ) => (
    <View style={styles.tField}>
      <Text style={styles.tFieldLabel}>{label.toUpperCase()}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          testID={testID}
          style={styles.tInput}
          value={value}
          onChangeText={(v) => { onChange(v); markChanged(); }}
          placeholder={placeholder}
          placeholderTextColor={colors.outline}
          keyboardType={keyboardType}
        />
        <MaterialIcons name={icon} size={20} color={colors.outlineVariant} style={styles.tInputIconRight} />
      </View>
    </View>
  );

  const tabletPayButton = (
    label: string,
    icon: React.ComponentProps<typeof MaterialIcons>['name'],
    active: boolean,
    onPress: () => void,
    testID: string
  ) => (
    <TouchableOpacity
      testID={testID}
      style={[styles.tPayBtn, active && styles.tPayBtnActive]}
      activeOpacity={0.9}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <MaterialIcons name={icon} size={20} color={active ? colors.white : colors.onSurface} />
      <Text style={[styles.tPayText, active && styles.tPayTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const tabletRadio = (label: string, active: boolean, onPress: () => void, testID: string) => (
    <TouchableOpacity
      testID={testID}
      style={styles.tRadio}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <MaterialIcons
        name={active ? 'radio-button-checked' : 'radio-button-unchecked'}
        size={20}
        color={active ? colors.primary : colors.outline}
      />
      <Text style={styles.tRadioLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const renderTablet = () => (
    <View style={styles.screen}>
      <ScrollView
        testID="settings-scroll"
        style={styles.body}
        contentContainerStyle={styles.tContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tHeader}>
          <Text style={styles.tTitle}>Cài đặt hệ thống</Text>
          <View style={styles.tHeaderRight}>
            <Text style={styles.tVersion}>Version 1.0.0</Text>
            <TouchableOpacity style={styles.tHelpBtn} activeOpacity={0.85}>
              <MaterialIcons name="help-outline" size={18} color={colors.primary} />
              <Text style={styles.tHelpText}>Trợ giúp</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tGrid}>
          {/* Cột trái */}
          <View style={styles.tColLeft}>
            <View style={styles.tCard}>
              <View style={styles.tCardTitleRow}>
                <MaterialIcons name="storefront" size={20} color={colors.primary} />
                <Text style={styles.tCardTitle}>Thông tin cửa hàng</Text>
              </View>
              <View style={styles.tFieldRow}>
                {tabletStoreField('Tên cửa hàng', 'edit', storeName, setStoreName, 'store-name-input', 'Nhập tên cửa hàng')}
                {tabletStoreField('Số điện thoại', 'call', storePhone, setStorePhone, 'store-phone-input', 'Nhập số điện thoại', 'phone-pad')}
              </View>
              {tabletStoreField('Địa chỉ', 'location-on', storeAddress, setStoreAddress, 'store-address-input', 'Nhập địa chỉ cửa hàng')}
            </View>

            <View style={styles.tCard}>
              <View style={styles.tCardTitleRow}>
                <MaterialIcons name="tune" size={20} color={colors.primary} />
                <Text style={styles.tCardTitle}>Cài đặt vận hành bán hàng</Text>
              </View>
              <View style={styles.subGroup}>
                <Text style={styles.tSubTitle}>PHƯƠNG THỨC THANH TOÁN MẶC ĐỊNH</Text>
                <View style={styles.tPayRow}>
                  {tabletPayButton('Tiền mặt', 'payments', paymentMethod === 'tiền mặt', () => { setPaymentMethod('tiền mặt'); markChanged(); }, 'payment-method-cash')}
                  {tabletPayButton('Chuyển khoản', 'account-balance', paymentMethod === 'chuyển khoản', () => { setPaymentMethod('chuyển khoản'); markChanged(); }, 'payment-method-transfer')}
                </View>
              </View>
              <View style={styles.subGroup}>
                <Text style={styles.tSubTitle}>ĐƠN VỊ TIỀN TỆ / FORMAT SỐ TIỀN</Text>
                <View style={styles.tCurrencyBox}>
                  <View style={styles.tCurrencyRadios}>
                    {tabletRadio('Dấu chấm (1.000)', currencyFormat === 'symbol', () => { setCurrencyFormat('symbol'); markChanged(); }, 'currency-format-symbol')}
                    {tabletRadio('Dấu phẩy (1,000)', currencyFormat === 'code', () => { setCurrencyFormat('code'); markChanged(); }, 'currency-format-code')}
                  </View>
                  <View style={styles.tPreviewBox}>
                    <MaterialIcons name="visibility" size={18} color={colors.primary} />
                    <Text style={styles.tPreviewLabel}>Ví dụ hiển thị: </Text>
                    <Text testID="currency-preview" style={styles.tPreviewValue}>{currencyPreview}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Cột phải */}
          <View style={styles.tColRight}>
            <View style={styles.tCard}>
              <View style={styles.tCardTitleRow}>
                <MaterialIcons name="hub" size={20} color={colors.tertiary} />
                <Text style={styles.tCardTitle}>Cài đặt kỹ thuật</Text>
              </View>
              <Text style={styles.tTechDesc}>Cấu hình API để kích hoạt tính năng nhận diện giọng nói AI.</Text>
              <View style={styles.tField}>
                <Text style={styles.tFieldLabel}>GEMINI API KEY</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="vpn-key" size={20} color={colors.onSurfaceVariant} style={styles.inputIcon} />
                  <TextInput
                    testID="gemini-api-key-input"
                    style={[styles.tInput, styles.tInputKey]}
                    value={apiKey}
                    onChangeText={setApiKey}
                    placeholder={hasStoredKey ? 'Nhập key mới để thay thế' : 'Nhập API Key'}
                    placeholderTextColor={colors.outline}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!keyRevealed}
                  />
                  <View style={styles.inputActions}>
                    <TouchableOpacity testID="gemini-key-reveal" style={styles.iconButton} onPress={() => setKeyRevealed((v) => !v)} activeOpacity={0.7}>
                      <MaterialIcons name={keyRevealed ? 'visibility-off' : 'visibility'} size={20} color={colors.onSurfaceVariant} />
                    </TouchableOpacity>
                    <TouchableOpacity testID="gemini-key-copy" style={styles.iconButton} onPress={handleCopyKey} activeOpacity={0.7}>
                      <MaterialIcons name="content-copy" size={20} color={colors.onSurfaceVariant} />
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity style={styles.tGuideLink} activeOpacity={0.7}>
                  <Text style={styles.tGuideText}>Hướng dẫn lấy API Key</Text>
                  <MaterialIcons name="open-in-new" size={14} color={colors.tertiary} />
                </TouchableOpacity>
              </View>
              <View style={styles.tTechBtnRow}>
                <TouchableOpacity
                  testID="gemini-test-connection"
                  disabled={isOperationPending}
                  onPress={handleTestConnection}
                  style={[styles.tTechTestBtn, isOperationPending && styles.disabledButton]}
                  activeOpacity={0.9}
                >
                  {isSaving ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <MaterialIcons name="sync" size={20} color={colors.onSurface} />
                      <Text style={styles.tTechTestText}>Kiểm tra kết nối</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  testID="gemini-save"
                  disabled={isOperationPending}
                  onPress={handleTestConnection}
                  style={[styles.tTechSaveBtn, isOperationPending && styles.disabledButton]}
                  activeOpacity={0.9}
                >
                  <MaterialIcons name="save" size={20} color={colors.white} />
                  <Text style={styles.tTechSaveText}>Lưu</Text>
                </TouchableOpacity>
              </View>
              {message ? (
                <Text style={isError ? styles.errorText : styles.successText}>{message}</Text>
              ) : null}
            </View>

            <View style={styles.tBanner}>
              <View style={styles.tBannerGlow} />
              <MaterialIcons name="graphic-eq" size={64} color="rgba(255,255,255,0.12)" style={styles.tBannerIcon} />
              <View style={styles.tBannerText}>
                <Text style={styles.tBannerEyebrow}>HỆ THỐNG AI VOICEBILL</Text>
                <Text style={styles.tBannerTitle}>Bảo mật cấp cao</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.tSaveBar}>
          {DANGER_RESET_ENABLED ? renderResetDataButton() : <View />}
          <TouchableOpacity
            testID="settings-save-button"
            disabled={!isDirty || savingAll}
            onPress={handleSaveAll}
            style={[styles.saveButton, styles.tSaveButton, (!isDirty || savingAll) && styles.saveButtonDisabled]}
            activeOpacity={0.9}
          >
            {savingAll ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <MaterialIcons name="save" size={18} color={(!isDirty || savingAll) ? colors.outline : colors.white} />
                <Text style={[styles.saveButtonText, styles.tSaveButtonText, (!isDirty || savingAll) && styles.saveButtonTextDisabled]}>Lưu thay đổi</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        {savedNotice ? <Text testID="settings-saved-notice" style={[styles.savedNotice, styles.tSavedNotice]}>{savedNotice}</Text> : null}
      </ScrollView>
      {DANGER_RESET_ENABLED ? renderResetPasswordModal() : null}
    </View>
  );

  if (isTablet) return renderTablet();

  return (
    <View style={styles.screen}>
      <ScrollView
        testID="settings-scroll"
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Thông tin cửa hàng */}
        <Text style={styles.sectionTitle}>Thông tin cửa hàng</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Tên cửa hàng</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="storefront" size={20} color={colors.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                testID="store-name-input"
                style={styles.input}
                value={storeName}
                onChangeText={(value) => { setStoreName(value); markChanged(); }}
                placeholder="Cửa hàng Gạo Sạch"
                placeholderTextColor={colors.outline}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Số điện thoại</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="phone" size={20} color={colors.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                testID="store-phone-input"
                style={styles.input}
                value={storePhone}
                onChangeText={(value) => { setStorePhone(value); markChanged(); }}
                placeholder="0901234567"
                placeholderTextColor={colors.outline}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Địa chỉ</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="location-on" size={20} color={colors.onSurfaceVariant} style={styles.inputIconTop} />
              <TextInput
                testID="store-address-input"
                style={[styles.input, styles.inputMultiline]}
                value={storeAddress}
                onChangeText={(value) => { setStoreAddress(value); markChanged(); }}
                placeholder="123 Đường Nguyễn Văn Linh, Phường Tân Phú, Quận 7, TP.HCM"
                placeholderTextColor={colors.outline}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>
          </View>
        </View>

        {/* Section 2: Cài đặt vận hành bán hàng */}
        <Text style={styles.sectionTitle}>Cài đặt vận hành bán hàng</Text>
        <View style={styles.card}>
          <View style={styles.subGroup}>
            <Text style={styles.subTitle}>Phương thức thanh toán mặc định</Text>
            {renderRadioRow(
              paymentMethod === 'tiền mặt',
              'Tiền mặt',
              'payments',
              () => { setPaymentMethod('tiền mặt'); markChanged(); },
              'payment-method-cash'
            )}
            {renderRadioRow(
              paymentMethod === 'chuyển khoản',
              'Chuyển khoản',
              'account-balance',
              () => { setPaymentMethod('chuyển khoản'); markChanged(); },
              'payment-method-transfer'
            )}
          </View>

          <View style={styles.subGroup}>
            <Text style={styles.subTitle}>Định dạng tiền tệ</Text>
            {renderRadioRow(
              currencyFormat === 'symbol',
              "Ký hiệu 'đ' (1.250.000 đ)",
              null,
              () => { setCurrencyFormat('symbol'); markChanged(); },
              'currency-format-symbol'
            )}
            {renderRadioRow(
              currencyFormat === 'code',
              "Mã 'VND' (1,250,000 VND)",
              null,
              () => { setCurrencyFormat('code'); markChanged(); },
              'currency-format-code'
            )}

            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Hiển thị mẫu:</Text>
              <Text testID="currency-preview" style={styles.previewValue}>{currencyPreview}</Text>
            </View>
          </View>
        </View>

        {/* Section 3: Cài đặt kỹ thuật */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Cài đặt kỹ thuật</Text>
          <MaterialIcons name="memory" size={20} color={colors.onSurfaceVariant} />
        </View>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Gemini API Key</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="vpn-key" size={20} color={colors.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                testID="gemini-api-key-input"
                style={[styles.input, styles.inputWithActions]}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder={hasStoredKey ? 'Nhập key mới để thay thế' : 'Dán Gemini API Key'}
                placeholderTextColor={colors.outline}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!keyRevealed}
              />
              <View style={styles.inputActions}>
                <TouchableOpacity
                  testID="gemini-key-reveal"
                  style={styles.iconButton}
                  onPress={() => setKeyRevealed((value) => !value)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={keyRevealed ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  testID="gemini-key-copy"
                  style={styles.iconButton}
                  onPress={handleCopyKey}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="content-copy" size={20} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity
            testID="gemini-test-connection"
            disabled={isOperationPending}
            onPress={handleTestConnection}
            style={[styles.testButton, isOperationPending && styles.disabledButton]}
            activeOpacity={0.9}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <MaterialIcons name="sync" size={20} color={colors.white} />
                <Text style={styles.testButtonText}>Kiểm tra kết nối</Text>
              </>
            )}
          </TouchableOpacity>

          {message ? (
            <Text style={isError ? styles.errorText : styles.successText}>{message}</Text>
          ) : null}

          {hasStoredKey ? (
            <TouchableOpacity
              testID="gemini-key-delete"
              disabled={isOperationPending}
              onPress={handleDelete}
              style={styles.deleteLink}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteLinkText}>Xóa API Key</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Vùng nguy hiểm: reset dữ liệu hóa đơn/báo cáo (chỉ khi bật cờ test) */}
        {DANGER_RESET_ENABLED ? renderResetDataButton() : null}

        {/* Footer: Lưu thay đổi */}
        <TouchableOpacity
          testID="settings-save-button"
          disabled={!isDirty || savingAll}
          onPress={handleSaveAll}
          style={[styles.saveButton, (!isDirty || savingAll) && styles.saveButtonDisabled]}
          activeOpacity={0.9}
        >
          {savingAll ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[styles.saveButtonText, (!isDirty || savingAll) && styles.saveButtonTextDisabled]}>
              Lưu thay đổi
            </Text>
          )}
        </TouchableOpacity>
        {savedNotice ? <Text testID="settings-saved-notice" style={styles.savedNotice}>{savedNotice}</Text> : null}
      </ScrollView>
      {DANGER_RESET_ENABLED ? renderResetPasswordModal() : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  body: {
    flex: 1,
  },
  // ===== Tablet =====
  tContent: {
    padding: 20,
    paddingBottom: 32,
  },
  tHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tTitle: {
    fontFamily: fontFamily.jakartaBold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.onSurface,
  },
  tHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tVersion: {
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  tHelpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainer,
  },
  tHelpText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 13,
    color: colors.primary,
  },
  tGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  tColLeft: {
    flex: 58,
    gap: 16,
  },
  tColRight: {
    flex: 42,
    gap: 16,
  },
  tCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.card,
    padding: 16,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  tCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tCardTitle: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.onSurface,
  },
  tFieldRow: {
    flexDirection: 'row',
    gap: 14,
  },
  tField: {
    flex: 1,
    gap: 6,
  },
  tFieldLabel: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.onSurfaceVariant,
  },
  tInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingLeft: 14,
    paddingRight: 40,
    paddingVertical: 10,
    fontFamily: fontFamily.interRegular,
    fontSize: 15,
    color: colors.onSurface,
  },
  tInputKey: {
    paddingLeft: 40,
    paddingRight: 92,
    fontFamily: fontFamily.interMedium,
  },
  tInputIconRight: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  tSubTitle: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.onSurfaceVariant,
  },
  tPayRow: {
    flexDirection: 'row',
    gap: 14,
  },
  tPayBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  tPayBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tPayText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    color: colors.onSurface,
  },
  tPayTextActive: {
    color: colors.white,
  },
  tCurrencyBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    gap: 14,
  },
  tCurrencyRadios: {
    flexDirection: 'row',
    gap: 28,
  },
  tRadio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tRadioLabel: {
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    color: colors.onSurface,
  },
  tPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryContainerBorder,
    backgroundColor: colors.primaryContainerFaint,
  },
  tPreviewLabel: {
    fontFamily: fontFamily.interRegular,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.onSurfaceVariant,
  },
  tPreviewValue: {
    fontFamily: fontFamily.interBold,
    fontSize: 14,
    color: colors.onSurface,
  },
  tTechDesc: {
    fontFamily: fontFamily.interRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurfaceVariant,
  },
  tGuideLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  tGuideText: {
    fontFamily: fontFamily.interRegular,
    fontSize: 13,
    color: colors.tertiary,
    textDecorationLine: 'underline',
  },
  tTechBtnRow: {
    flexDirection: 'row',
    gap: 14,
  },
  tTechTestBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
  },
  tTechTestText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 13,
    color: colors.onSurface,
  },
  tTechSaveBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  tTechSaveText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 13,
    color: colors.white,
  },
  tBanner: {
    height: 140,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    justifyContent: 'flex-end',
    padding: 16,
  },
  tBannerGlow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(98,179,236,0.25)',
  },
  tBannerIcon: {
    position: 'absolute',
    right: 20,
    top: 40,
  },
  tBannerText: {
    gap: 2,
  },
  tBannerEyebrow: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.7)',
  },
  tBannerTitle: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 16,
    color: colors.white,
  },
  tSaveBar: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tSaveButton: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 24,
    alignSelf: 'flex-end',
    borderRadius: radius.lg,
  },
  tSaveButtonText: {
    fontFamily: fontFamily.interBold,
    fontSize: 15,
  },
  tSavedNotice: {
    textAlign: 'right',
    marginTop: 8,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 48,
    gap: 24,
  },
  sectionTitle: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.onBackground,
    paddingHorizontal: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: -16,
  },
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.card,
    padding: 16,
    gap: 16,
    marginTop: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: fontFamily.interMedium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.onSurfaceVariant,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 2,
  },
  inputIconTop: {
    position: 'absolute',
    left: 12,
    top: 14,
    zIndex: 2,
  },
  input: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    paddingLeft: 40,
    paddingRight: 16,
    paddingVertical: 12,
    fontFamily: fontFamily.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurface,
  },
  inputMultiline: {
    minHeight: 68,
    paddingTop: 12,
  },
  inputWithActions: {
    paddingRight: 92,
  },
  inputActions: {
    position: 'absolute',
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    zIndex: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subGroup: {
    gap: 10,
  },
  subTitle: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.28,
    color: colors.onSurface,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceBright,
  },
  radioRowActive: {
    borderColor: colors.primary,
  },
  radioLabel: {
    flex: 1,
    fontFamily: fontFamily.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurface,
  },
  radioLabelActive: {
    fontFamily: fontFamily.interSemiBold,
  },
  previewBox: {
    marginTop: 4,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerHigh,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewLabel: {
    fontFamily: fontFamily.interMedium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.onSurfaceVariant,
  },
  previewValue: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },
  testButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  testButtonText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.28,
    color: colors.white,
  },
  disabledButton: {
    opacity: 0.6,
  },
  resetDataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    marginTop: 12,
    paddingHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.errorCrimson,
    backgroundColor: 'transparent',
  },
  resetDataButtonText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    color: colors.errorCrimson,
  },
  resetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 22, 58, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resetModal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 24,
    gap: 12,
  },
  resetModalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  resetModalTitle: {
    fontFamily: fontFamily.interBold,
    fontSize: 18,
    color: colors.onSurface,
    textAlign: 'center',
  },
  resetModalDesc: {
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  resetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    paddingLeft: 14,
    paddingRight: 6,
    marginTop: 4,
  },
  resetInputField: {
    flex: 1,
    paddingVertical: 0,
    fontFamily: fontFamily.interRegular,
    fontSize: 15,
    color: colors.onSurface,
  },
  resetEyeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetInputError: {
    borderColor: colors.errorCrimson,
  },
  resetErrorText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 13,
    color: colors.errorCrimson,
  },
  resetModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  resetCancelBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainer,
  },
  resetCancelText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 15,
    color: colors.onSurface,
  },
  resetConfirmBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.errorCrimson,
  },
  resetConfirmText: {
    fontFamily: fontFamily.interBold,
    fontSize: 15,
    color: colors.white,
  },
  successText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    color: colors.primaryActive,
  },
  errorText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    color: colors.errorCrimson,
  },
  deleteLink: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  deleteLinkText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    color: colors.errorCrimson,
  },
  saveButton: {
    minHeight: 56,
    borderRadius: radius.card,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.outlineVariant,
  },
  saveButtonText: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.white,
  },
  saveButtonTextDisabled: {
    color: colors.outline,
  },
  savedNotice: {
    textAlign: 'center',
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    color: colors.primaryActive,
    marginTop: -12,
  },
});
