# Màn Báo Cáo (Reports)

Xem lịch sử hóa đơn & thống kê doanh thu; xuất Excel.
Code: [`src/screens/InvoiceHistoryScreen.tsx`](../../../src/screens/InvoiceHistoryScreen.tsx),
xuất file: [`src/services/excelService.ts`](../../../src/services/excelService.ts)

## Thiết kế tham chiếu (Stitch export)

| Trạng thái | Screenshot | HTML |
|---|---|---|
| Phone | [screen.png](../../../stitch_emerald_ai_retail_pos/b_o_c_o_mobile_optimized/screen.png) | [code.html](../../../stitch_emerald_ai_retail_pos/b_o_c_o_mobile_optimized/code.html) |
| Tablet | [screen.png](../../../stitch_emerald_ai_retail_pos/b_o_c_o_tablet_optimized/screen.png) | [code.html](../../../stitch_emerald_ai_retail_pos/b_o_c_o_tablet_optimized/code.html) |

## Bố cục & thành phần

- **Thẻ tổng quan (KPI):** doanh thu ngày/tuần/tháng — card nền trắng, số lớn `headlineMd`.
- **Danh sách hóa đơn:** mỗi dòng gồm thời gian, tổng tiền, phương thức thanh toán.
- **Bộ lọc theo ngày.**
- **Nút xuất Excel.**

## Tablet

Master-detail: trái = danh sách hóa đơn, phải = chi tiết hóa đơn đang chọn.
