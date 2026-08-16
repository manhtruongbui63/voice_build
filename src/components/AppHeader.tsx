import React from 'react';
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fontFamily } from '../theme/tokens';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

export interface AppHeaderProps {
  testID?: string;
  actionTestID?: string;
  actionIcon?: MaterialIconName;
  actionActive?: boolean;
  onActionPress?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  testID = 'app-header',
  actionTestID,
  actionIcon = 'person-outline',
  actionActive = false,
  onActionPress,
}) => {
  const actionTestIdentifier = actionTestID ?? `${testID}-action`;

  return (
    <SafeAreaView testID={testID} style={styles.headerSafe}>
      <View testID={`${testID}-container`} style={styles.header}>
        <View style={styles.brand}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.brandName}>VoiceBill</Text>
        </View>
        {onActionPress ? (
          <TouchableOpacity
            testID={actionTestIdentifier}
            style={[styles.avatar, actionActive && styles.avatarActive]}
            activeOpacity={0.85}
            onPress={onActionPress}
          >
            <MaterialIcons name={actionIcon} size={18} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View
            testID={actionTestIdentifier}
            style={[styles.avatar, actionActive && styles.avatarActive]}
          >
            <MaterialIcons name={actionIcon} size={18} color={colors.white} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerSafe: {
    backgroundColor: colors.primary,
  },
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImage: {
    width: 40,
    height: 40,
  },
  brandName: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.white,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: {
    backgroundColor: colors.secondary,
  },
});
