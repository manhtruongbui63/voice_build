# Product CSV Import Design

## Muc tieu

Them tinh nang import san pham hang loat tu file CSV trong tab San Pham cua VoiceBill. Tinh nang giup nguoi dung tao nhanh catalog san pham de ban hang va de he thong nhan dien giong noi chinh xac hon.

## Pham vi MVP

- Them nut `Import CSV` tren man hinh San Pham.
- Cho phep chon file `.csv` tu thiet bi.
- Doc va validate file truoc khi ghi database.
- Hien thi modal preview ket qua import.
- Khi nguoi dung xac nhan, ghi database bang transaction.
- Sau import, reload danh sach san pham va hien thi ket qua.

Khong nam trong MVP:

- Chinh sua tung dong loi truc tiep trong modal preview.
- Import `.xlsx`.
- Mapping cot tuy bien bang UI wizard.
- Export file CSV mau.

## CSV Schema

App chap nhan ca header tieng Anh va tieng Viet.

Header tieng Anh:

```csv
name,aliases,unit,unit_price
```

Header tieng Viet:

```csv
Tên sản phẩm,Alias,Đơn vị,Giá bán
```

Quy tac truong du lieu:

- `name` / `Tên sản phẩm`: bat buoc, trim khoang trang dau/cuoi.
- `aliases` / `Alias`: khong bat buoc, luu dang chuoi ngan cach bang dau phay.
- `unit` / `Đơn vị`: bat buoc, trim khoang trang dau/cuoi.
- `unit_price` / `Giá bán`: bat buoc, phai parse duoc thanh so lon hon hoac bang 0.

Gia ban chap nhan cac format pho bien:

- `25000`
- `25.000`
- `25,000`
- `25.000đ`
- `25,000 d`

Sau parse, gia ban duoc luu thanh number trong cot `unit_price`.

## Xu ly san pham trung ten

Cot `name` la khoa doi chieu.

- Neu `name` chua ton tai trong database: tao san pham moi.
- Neu `name` da ton tai trong database: cap nhat lai `aliases`, `unit`, `unit_price` theo CSV.
- Khong tu doi `name` cua san pham cu.
- So sanh trung ten bang gia tri da trim va khong phan biet hoa/thuong.
- Neu CSV co nhieu dong trung `name`, dong sau cung duoc tinh la gia tri cuoi cung va cac dong truoc duoc dua vao nhom `Loi` voi thong bao trung lap trong file.

## Validate va Preview

Sau khi nguoi dung chon file, app parse CSV va chia ket qua thanh cac nhom:

- `Tao moi`: dong hop le co ten chua ton tai.
- `Cap nhat`: dong hop le co ten da ton tai.
- `Loi`: dong thieu truong bat buoc, gia khong hop le, header khong hop le, dong rong khong co du lieu.

Modal preview can hien thi:

- Tong so dong doc duoc.
- So san pham se tao moi.
- So san pham se cap nhat.
- So dong loi.
- Danh sach loi theo dong, vi du `Dong 4: thieu ten san pham`.
- Nut `Huy`.
- Nut `Xac nhan import`.

Neu tat ca dong deu loi, disable nut `Xac nhan import`.

## Data Flow

1. Nguoi dung bam `Import CSV`.
2. App mo file picker mac dinh cua thiet bi va chi chap nhan CSV.
3. App doc noi dung file.
4. `productCsvImportService` parse va validate noi dung.
5. Man San Pham hien thi modal preview.
6. Khi nguoi dung bam `Xac nhan import`, app goi database transaction:
   - Insert cac san pham moi.
   - Update cac san pham trung ten.
7. App reload danh sach san pham.
8. App hien thi ket qua import.

## Kien truc de xuat

Them service rieng:

```ts
src/services/productCsvImportService.ts
```

Service nay phu trach:

- Parse CSV text.
- Normalize header.
- Normalize alias, unit, price.
- Phan loai dong tao moi, cap nhat, loi.
- Tra ve ket qua preview de UI render.

Them database helper trong `src/services/db.ts`:

- `importProductsFromDB(rows)`.
- Chay trong `withTransactionSync`.
- Insert/update theo `name`.
- Tra ve `{ created, updated }`.

Man `ProductCatalogScreen` phu trach:

- Mo file picker.
- Goi service parse/preview.
- Quan ly modal preview.
- Goi DB helper khi user xac nhan.
- Reload products.

## UI

Vi header va menu bar dang dung common component, khong thay doi common header.

Nut `Import CSV` nen dat trong vung noi dung tab San Pham, gan khu vuc search/chip hoac gan FAB, de tranh lam header bi giat/lech giua cac tab. UI can ro rang nhung khong lan at action tao san pham moi.

Modal preview can theo visual language hien tai:

- Nen sang `surface`.
- Tieu de ro: `Import sản phẩm từ CSV`.
- Summary cards/chips cho `Tạo mới`, `Cập nhật`, `Lỗi`.
- Neu co loi, hien thi danh sach loi dang scroll-y.
- Button primary: `Xác nhận import`.
- Button secondary: `Hủy`.

## Loi va thong bao

Cac truong hop can thong bao:

- User huy file picker: dong flow, khong bao loi.
- File khong doc duoc: alert `Không thể đọc file CSV`.
- Header khong hop le: preview hien loi header va disable confirm.
- Import transaction fail: alert `Không thể import sản phẩm. Vui lòng thử lại.`
- Import thanh cong: thong bao tong so tao moi va cap nhat.

## Testing

Them unit test cho parser:

- Parse header tieng Anh.
- Parse header tieng Viet.
- Parse gia `25.000đ` thanh `25000`.
- Bao loi khi thieu ten.
- Bao loi khi gia khong hop le.
- Phan loai tao moi/cap nhat theo danh sach san pham hien co.

Them test DB:

- Insert san pham moi theo batch.
- Update alias/unit/unit_price khi trung ten.
- Transaction khong de trang thai import dang do neu co loi bat thuong.

Them test UI cho `ProductCatalogScreen`:

- Nut `Import CSV` hien thi tren man San Pham.
- Preview hien dung so luong tao moi/cap nhat/loi.
- Disable confirm khi khong co dong hop le.
- Sau confirm, reload danh sach san pham.

## Verification

Truoc khi ket luan hoan thanh can chay:

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run ios -- --device "iPhone 12"
```

Native build tren iPhone 12 la bat buoc neu them dependency file picker moi.
