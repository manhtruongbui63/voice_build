# Màn Bán Hàng (Voice Billing)

Màn chính — chủ shop nhấn micro, nói khẩu lệnh, AI dựng hóa đơn nháp.
Code: [`src/screens/HomeScreen.tsx`](../../../src/screens/HomeScreen.tsx),
modal: [`src/components/DraftInvoiceModal.tsx`](../../../src/components/DraftInvoiceModal.tsx)

## Thiết kế tham chiếu (Stitch export)

| Trạng thái | Screenshot | HTML |
|---|---|---|
| Phone — bước 1: nhập giọng nói | [screen.png](../../../stitch_emerald_ai_retail_pos/b_n_h_ng_b_c_1_nh_p_gi_ng_n_i/screen.png) | [code.html](../../../stitch_emerald_ai_retail_pos/b_n_h_ng_b_c_1_nh_p_gi_ng_n_i/code.html) |
| Phone — bước 2: đơn hàng nháp | [screen.png](../../../stitch_emerald_ai_retail_pos/b_n_h_ng_b_c_2_n_h_ng_nh_p/screen.png) | [code.html](../../../stitch_emerald_ai_retail_pos/b_n_h_ng_b_c_2_n_h_ng_nh_p/code.html) |
| Tablet — đang ghi âm | [screen.png](../../../stitch_emerald_ai_retail_pos/b_n_h_ng_tablet_ang_ghi_m/screen.png) | [code.html](../../../stitch_emerald_ai_retail_pos/b_n_h_ng_tablet_ang_ghi_m/code.html) |
| Tablet — đang ghi âm (mới) | [screen.png](../../../stitch_emerald_ai_retail_pos/b_n_h_ng_tablet_ang_ghi_m_m_i/screen.png) | [code.html](../../../stitch_emerald_ai_retail_pos/b_n_h_ng_tablet_ang_ghi_m_m_i/code.html) |

## Bố cục & thành phần

- **Header:** tiêu đề "VOICE BILLING" + phụ đề "Nhấn Nút Micro Để Nói Khẩu Lệnh Bán Hàng".
- **Nút micro:** tròn `full`, 140px (phone) / 180px (tablet). Nền `primaryContainer #10B981`;
  khi đang ghi âm đổi sang `errorCrimson #EF4444` + hiệu ứng `elevation.micPulse`.
- **Ô transcript:** hiện văn bản nhận diện được (card nền trắng, bo `card`).
- **Draft Invoice (bottom sheet / panel tablet):** danh sách dòng hàng do AI tách.
  Dòng có confidence `< 0.8` → nền `warningSurface`, viền `warningAmber`, icon ⚠️.
- **Thanh toán:** chọn "Tiền mặt" / "Chuyển khoản". Chọn "Chuyển khoản" → ẩn "Khách đưa" & "Tiền thừa".

## Luồng

1. Nhấn micro → ghi âm (đổi màu đỏ + pulse).
2. Thả → nhận diện giọng nói → AI parse ra dòng hàng.
3. Xem lại draft, sửa dòng cảnh báo vàng nếu cần.
4. Chọn phương thức thanh toán → Lưu hóa đơn.

## Tablet

Split view 2 cột: trái = micro + transcript, phải = draft invoice thường trực.
Navigation chuyển sang side rail.
