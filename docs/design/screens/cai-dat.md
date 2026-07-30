# Màn Cài Đặt (Settings)

Cấu hình app, gồm **Gemini API key** dùng cho AI parse hóa đơn.
Code: [`src/screens/SettingsScreen.tsx`](../../../src/screens/SettingsScreen.tsx),
lưu key: [`src/services/geminiSettingsService.ts`](../../../src/services/geminiSettingsService.ts)

## Thiết kế tham chiếu (Stitch export)

| Trạng thái | Screenshot | HTML |
|---|---|---|
| Phone | [screen.png](../../../stitch_emerald_ai_retail_pos/c_i_t_mobile_optimized/screen.png) | [code.html](../../../stitch_emerald_ai_retail_pos/c_i_t_mobile_optimized/code.html) |
| Tablet | [screen.png](../../../stitch_emerald_ai_retail_pos/c_i_t_tablet_optimized/screen.png) | [code.html](../../../stitch_emerald_ai_retail_pos/c_i_t_tablet_optimized/code.html) |

## Bố cục & thành phần

- **Nhóm cài đặt** dạng list, mỗi mục là 1 row có label + control.
- **Gemini API key:** ô nhập bảo mật (che ký tự), nút Lưu / Kiểm tra.
  Key lưu bằng `expo-secure-store` — không hiển thị lại dạng thô.
- **Các cấu hình khác:** ngôn ngữ nhận diện, thông tin cửa hàng…

## Ghi chú bảo mật

API key là dữ liệu nhạy cảm → luôn dùng ô nhập che ký tự và lưu ở SecureStore,
không log ra console, không đưa vào tài liệu hay ảnh chụp.
