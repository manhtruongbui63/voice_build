# Màn Sản Phẩm (Product Catalog)

Quản lý danh mục sản phẩm & alias giọng nói (vd `ST` → `Gạo ST25`) — dữ liệu để AI khớp khi bán.
Code: [`src/screens/ProductCatalogScreen.tsx`](../../../src/screens/ProductCatalogScreen.tsx),
modal: [`src/components/AddEditProductModal.tsx`](../../../src/components/AddEditProductModal.tsx)

## Thiết kế tham chiếu (Stitch export)

| Trạng thái | Screenshot | HTML |
|---|---|---|
| Phone — danh sách | [screen.png](../../../stitch_emerald_ai_retail_pos/s_n_ph_m_mobile_optimized/screen.png) | [code.html](../../../stitch_emerald_ai_retail_pos/s_n_ph_m_mobile_optimized/code.html) |
| Tablet — grid | [screen.png](../../../stitch_emerald_ai_retail_pos/s_n_ph_m_tablet_t_i_u_nh/screen.png) | [code.html](../../../stitch_emerald_ai_retail_pos/s_n_ph_m_tablet_t_i_u_nh/code.html) |
| Phone — thêm sản phẩm | [screen.png](../../../stitch_emerald_ai_retail_pos/th_m_s_n_ph_m_mobile/screen.png) | [code.html](../../../stitch_emerald_ai_retail_pos/th_m_s_n_ph_m_mobile/code.html) |
| Tablet — modal thêm sản phẩm | [screen.png](../../../stitch_emerald_ai_retail_pos/th_m_s_n_ph_m_tablet_modal/screen.png) | [code.html](../../../stitch_emerald_ai_retail_pos/th_m_s_n_ph_m_tablet_modal/code.html) |

Ảnh sản phẩm mẫu: các thư mục `high_quality_product_photo_*` trong `stitch_emerald_ai_retail_pos/`.

## Bố cục & thành phần

- **Danh sách:** card từng sản phẩm (ảnh, tên, giá, đơn vị, alias). Bo `card`, đổ bóng `softCard`.
- **Tìm kiếm** ở đầu màn.
- **Nút thêm** (FAB / sticky đáy trên phone).
- **Modal Thêm/Sửa:** tên, giá, đơn vị, danh sách **alias giọng nói**.
  - Phone: bottom sheet. Tablet: center modal (bo `xl`).

## Tablet

Grid nhiều cột. Thêm/sửa mở center modal thay vì bottom sheet.
