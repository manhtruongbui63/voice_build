# Sửa lỗi crash khi xóa sản phẩm + Xóa nhiều sản phẩm — Design

**Ngày:** 2026-07-30
**Loại:** Bug fix (crash) + thay đổi schema nhỏ + tính năng xóa nhiều (multi-select)

## Vấn đề

Xóa liên tiếp nhiều sản phẩm: 3–4 sản phẩm đầu xóa được, tới một sản phẩm nào đó thì **app thoát đột ngột (crash)** trên bản Release.

## Root cause

Không phải "sản phẩm thứ 5" — mà là **sản phẩm đầu tiên đã từng nằm trong một hóa đơn đã lưu**. Chuỗi nhân quả:

1. Bảng `invoice_items` (`src/services/db.ts`) khai báo khóa ngoại `product_id` **không có `ON DELETE`**:
   ```
   FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
   FOREIGN KEY (product_id) REFERENCES products (id)   -- mặc định RESTRICT / NO ACTION
   ```
2. `PRAGMA foreign_keys = ON` đang bật → `DELETE FROM products WHERE id = ?` với sản phẩm đang được `invoice_items` tham chiếu sẽ **vi phạm ràng buộc → `runSync` ném lỗi**.
3. `handleDelete` trong `ProductCatalogScreen.tsx` gọi `deleteProductFromDB(id)` **không có try/catch**. Lỗi ném ra từ trong `onPress` của `Alert` → **uncaught exception** → bản Release **đóng app**.

→ Sản phẩm chưa từng xuất hiện trong hóa đơn nào thì xóa bình thường; sản phẩm đã được một hóa đơn tham chiếu thì crash.

## Quyết định nghiệp vụ

Khi xóa một sản phẩm đã có trong hóa đơn cũ: **cho xóa tự do, giữ nguyên lịch sử hóa đơn**.

Cơ sở: `invoice_items` đã lưu **bản chụp** của từng dòng (`product_name`, `unit`, `unit_price`, `amount`). Hóa đơn cũ hiển thị bằng các trường snapshot này, **không phụ thuộc** vào bản ghi `products`. Vì vậy xóa sản phẩm không làm hỏng lịch sử.

## Giải pháp

### 1. Migration schema — `invoice_items.product_id` thành `ON DELETE SET NULL`

SQLite không `ALTER` được khóa ngoại → phải **dựng lại bảng** `invoice_items`:

- Tạo bảng mới `invoice_items` với:
  - `product_id INTEGER` — **cho phép NULL** (bỏ `NOT NULL`).
  - `FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL`.
  - `FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE` — giữ nguyên.
  - Các cột còn lại giữ nguyên (`id`, `invoice_id`, `product_name`, `quantity`, `unit`, `unit_price`, `amount`).
- Copy toàn bộ dữ liệu cũ sang, **giữ nguyên `id`** (dùng danh sách cột tường minh trong `INSERT ... SELECT`).
- Xóa bảng cũ, đổi tên bảng mới thành `invoice_items`.

Trình tự an toàn (theo khuyến nghị chính thức của SQLite cho table-rebuild):
```
PRAGMA foreign_keys = OFF;
BEGIN;
  CREATE TABLE invoice_items_new (...);
  INSERT INTO invoice_items_new (<cột...>) SELECT <cột...> FROM invoice_items;
  DROP TABLE invoice_items;
  ALTER TABLE invoice_items_new RENAME TO invoice_items;
COMMIT;
PRAGMA foreign_keys = ON;
```
> Lưu ý: `PRAGMA foreign_keys` không đổi được bên trong transaction, nên hai câu PRAGMA nằm **ngoài** `BEGIN/COMMIT`.

**Idempotent:** trước khi chạy, kiểm tra `PRAGMA foreign_key_list(invoice_items)`. Nếu đã có mục `table = 'products'` với `on_delete = 'SET NULL'` → **bỏ qua** (đã migrate). Migration chạy một lần lúc khởi động, đặt trong `initDB` sau khi `CREATE TABLE IF NOT EXISTS`.

### 2. Lưới an toàn ở UI — `handleDelete`

Bọc `try/catch` quanh lời gọi xóa trong `ProductCatalogScreen.tsx`:
- Thành công → `loadProducts()` như hiện tại.
- Lỗi (bất kỳ nguyên nhân gì) → `Alert.alert('Lỗi', 'Không thể xóa sản phẩm. Vui lòng thử lại.')`.

Đây là **chốt chặn cứng**: dù migration có vấn đề hay lỗi khác, app **không bao giờ crash** khi xóa nữa.

### 3. Điều chỉnh type

`InvoiceItem.product_id` nới thành `number | null` (chỉ nới kiểu; UI hiển thị dùng `product_name` nên không đổi logic).

### 4. Xóa nhiều sản phẩm (multi-select bằng checkbox)

**Hàm DB mới — `deleteProductsFromDB(ids: number[])` (`src/services/db.ts`):**
- `ids` rỗng → no-op (return sớm).
- Ngược lại: xóa trong **một transaction** để nguyên tử:
  ```
  DELETE FROM products WHERE id IN (?, ?, ...)   -- placeholder theo số lượng ids
  ```
  Dùng `database.withTransactionSync(...)` (hoặc `BEGIN/COMMIT`). Nhờ migration `ON DELETE SET NULL`, các dòng `invoice_items` tham chiếu tự set `product_id = NULL`, lịch sử hóa đơn giữ nguyên.
- `deleteProductFromDB(id)` (đơn lẻ) giữ nguyên cho nút xóa từng thẻ.

**UI — `ProductCatalogScreen.tsx`:**
- State mới: `selectionMode: boolean`, `selectedIds: Set<number>`.
- **Nút "Chọn"** ở header bật/tắt `selectionMode`. Khi tắt: reset `selectedIds`, ẩn checkbox và thanh hành động.
- Trong `selectionMode`:
  - Mỗi thẻ hiện **checkbox**; chạm cả thẻ để toggle id trong `selectedIds` (thay cho hành vi mở sửa). Nút Sửa/Xóa từng thẻ ẩn đi trong chế độ chọn.
  - **Thanh hành động** (trên danh sách) hiện: "Đã chọn {N}", nút **"Chọn tất cả"** (toggle chọn/bỏ toàn bộ danh sách đang lọc), nút **"Xóa ({N})"** (disable khi N = 0), nút **"Hủy"**.
- **Luồng xóa nhiều:** bấm "Xóa (N)" → `Alert` xác nhận "Xóa {N} sản phẩm đã chọn?" → `onPress`:
  ```
  try { deleteProductsFromDB([...selectedIds]); loadProducts(); setSelectionMode(false); setSelectedIds(new Set()); }
  catch { Alert.alert('Lỗi', 'Không thể xóa sản phẩm. Vui lòng thử lại.'); }
  ```
  Dùng chung **lưới an toàn try/catch** như mục 2 → không crash.
- Ngoài `selectionMode`, màn hình hoạt động y như hiện tại (xóa/sửa từng thẻ).

Đây chính là kịch bản trước đây gây crash (xóa loạt sản phẩm). Với migration + transaction + try/catch, xóa nhiều trở nên an toàn.

## Data flow sau khi sửa

**Xóa từng sản phẩm:**
```
Bấm Xóa (thẻ) → Alert xác nhận
  → onPress: try { deleteProductFromDB(id); loadProducts(); }
             catch { Alert lỗi thân thiện }
  → DELETE FROM products WHERE id = ?
       → invoice_items tham chiếu (nếu có): product_id tự set NULL (ON DELETE SET NULL)
       → hóa đơn cũ vẫn hiển thị đủ nhờ snapshot
```

**Xóa nhiều sản phẩm:**
```
Bấm "Chọn" → tick nhiều thẻ → bấm "Xóa (N)" → Alert xác nhận
  → onPress: try { deleteProductsFromDB([...ids]); loadProducts(); thoát selectionMode }
             catch { Alert lỗi thân thiện }
  → DELETE FROM products WHERE id IN (?, ...) trong 1 transaction
       → mọi invoice_items tham chiếu: product_id tự set NULL
       → hóa đơn cũ vẫn hiển thị đủ nhờ snapshot
```

## Error handling

- Migration bọc trong transaction; nếu lỗi giữa chừng → `ROLLBACK` (transaction tự đảm bảo), bảng cũ nguyên vẹn.
- Guard idempotent tránh chạy lại migration đã áp dụng.
- UI `try/catch` đảm bảo không crash trong mọi trường hợp.

## Testing

> Lưu ý: jest đang **mock `expo-sqlite`** (không chạy SQLite thật), nên không test được hành vi FK thật ở tầng unit. Kiểm chứng FK thật thực hiện trên thiết bị.

1. **Lưới an toàn UI (ProductCatalogScreen):** mock `deleteProductFromDB` / `deleteProductsFromDB` ném lỗi → render màn, kích hoạt xác nhận Xóa → khẳng định **hiện `Alert` lỗi, không văng**, và không gọi tiếp `loadProducts` gây lỗi lan.
2. **Guard idempotency của migration:** mock `getDB` trả đối tượng giả với `getAllSync`/`execSync` là jest.fn.
   - Khi `foreign_key_list` đã trả `on_delete: 'SET NULL'` → **không** chạy các câu lệnh rebuild.
   - Khi chưa có → **có** chạy rebuild (khẳng định các câu `CREATE TABLE invoice_items_new`, `INSERT ... SELECT`, `DROP TABLE`, `RENAME` được thực thi).
3. **`deleteProductsFromDB`:** mock db → `ids` rỗng thì **không** chạy câu lệnh nào; `ids` có phần tử thì chạy `DELETE ... WHERE id IN (?, ...)` với đúng số placeholder và tham số, bên trong transaction.
4. **Multi-select UI:** bật "Chọn" → thẻ hiện checkbox; tick N sản phẩm → nút "Xóa (N)" gọi `deleteProductsFromDB` với đúng danh sách id; "Chọn tất cả" tick toàn bộ; N = 0 thì nút Xóa disable.
5. **Kiểm chứng thật trên iPhone 12** sau khi build lại: xóa loạt sản phẩm (cả đơn lẻ lẫn multi-select) đã có trong hóa đơn → không crash; mở lại Báo Cáo kiểm tra hóa đơn cũ vẫn hiển thị đủ dòng.

## Phạm vi / YAGNI

- **Trong phạm vi:** xóa từng sản phẩm (đã có) + xóa nhiều bằng checkbox (mới); đều qua lưới an toàn.
- Vẫn giữ `Alert` xác nhận trước khi xóa (đơn lẻ và theo nhóm).
- Không thêm chọn nhiều cho màn hình khác (hóa đơn, v.v.) — ngoài phạm vi.
- Không thêm undo/khôi phục sau xóa — ngoài phạm vi.
- Không đụng tới luồng lưu hóa đơn hay các FK khác.
