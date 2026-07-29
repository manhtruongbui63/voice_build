# VoiceBill - Ubiquitous Language & Domain Glossary

This document defines the core domain concepts and business terminology used across the VoiceBill system.

---

## Domain Concepts & Glossary

### 1. Product (Sản phẩm)
Mặt hàng kinh doanh bán lẻ (ví dụ: Gạo ST25, Gạo Tám Thái) do cửa hàng đăng ký trong danh mục.
- **Name (Tên sản phẩm)**: Tên chính thức hiển thị trên ứng dụng và báo cáo.
- **Aliases (Tên gọi tắt / Từ khóa)**: Danh sách các tên viết tắt hoặc tên đọc vắn tắt của sản phẩm (ví dụ: `ST`, `ST25`, `Sóc Trăng`) dùng để đối chiếu khi đọc bằng giọng nói.
- **Default Unit (Đơn vị tính mặc định)**: Đơn vị đo lường mặc định (mặc định: `kg`, `túi`, `bao`).
- **Default Unit Price (Đơn giá mặc định)**: Giá tiền tính trên một đơn vị (VND).

### 2. Voice Transcript (Văn bản giọng nói)
Đoạn văn bản thô được chuyển đổi từ giọng nói của người bán thông qua bộ nhận dạng Speech-to-Text (STT) của thiết bị.

### 3. Matched Item (Mặt hàng bóc tách)
Một dòng hàng được AI Gemini nhận diện thành công từ `Voice Transcript`, khớp với một `Product` trong danh mục.
- **Quantity (Số lượng)**: Khối lượng/số lượng thực tế được bán (quy đổi tự nhiên từ tiếng Việt như "2 cân rưỡi" -> `2.5`).
- **Confidence (Độ tin cậy)**: Chỉ số từ `0.0` đến `1.0` thể hiện mức độ khớp chính xác của từ đọc so với sản phẩm trong danh mục. Nếu `< 0.8`, hệ thống sẽ cảnh báo màu vàng.

### 4. Invoice Draft (Hóa đơn nháp)
Màn hình trung gian hiển thị danh sách `Matched Item` sau khi AI phân tích xong, cho phép người bán kiểm tra, chỉnh sửa đơn giá/số lượng, thêm chiết khấu trước khi ghi nhận chính thức.

### 5. Invoice (Hóa đơn bán lẻ)
Bản ghi chính thức của một giao dịch bán lẻ đã được xác nhận và lưu vào cơ sở dữ liệu SQLite.
- **Invoice Code (Mã hóa đơn)**: Mã định danh duy nhất (ví dụ: `HD-20260729-001`).
- **Subtotal (Tổng tiền hàng)**: Tổng tiền trước chiết khấu (`∑ Quantity * Unit Price`).
- **Discount (Chiết khấu)**: Số tiền giảm giá cho khách hàng.
- **Final Amount (Thực thu)**: Số tiền phải thanh toán (`Subtotal - Discount`).
- **Paid Amount (Khách đưa)**: Số tiền mặt khách hàng đưa.
- **Change Amount (Tiền thừa)**: Tiền trả lại cho khách (`Paid Amount - Final Amount`).

### 6. Excel Report (Báo cáo Excel)
Bảng tính `.xlsx` được tổng hợp và xuất ra theo khoảng thời gian (Hôm nay, Tuần này, Tháng này) lưu trên bộ nhớ thiết bị.
