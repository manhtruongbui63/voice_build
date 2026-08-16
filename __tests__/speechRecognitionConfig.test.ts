const appConfig = require('../app.json') as {
  expo: {
    plugins?: Array<string | [string, Record<string, string>]>;
    ios?: {
      infoPlist?: Record<string, string>;
    };
  };
};

const microphonePermission =
  'VoiceBill cần quyền truy cập Micro để thu âm khẩu lệnh tạo hóa đơn.';
const speechPermission =
  'VoiceBill cần quyền sử dụng Nhận dạng giọng nói để bóc tách hóa đơn bằng giọng nói.';

describe('speech recognition Expo configuration', () => {
  it('registers the plugin with the approved iOS permission copy', () => {
    expect(appConfig.expo.plugins).toContainEqual([
      'expo-speech-recognition',
      {
        microphonePermission,
        speechRecognitionPermission: speechPermission,
      },
    ]);
  });

  it('keeps the same copy in ios.infoPlist', () => {
    expect(appConfig.expo.ios?.infoPlist).toMatchObject({
      NSMicrophoneUsageDescription: microphonePermission,
      NSSpeechRecognitionUsageDescription: speechPermission,
    });
  });
});
