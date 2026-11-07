# Smart Waste Sorting Web App ♻️

Ứng dụng nhận diện và phân loại rác thải theo thời gian thực trực tiếp trên trình duyệt, sử dụng trí tuệ nhân tạo (Computer Vision).

## Tính năng nổi bật
* **Real-time Detection:** Phân loại rác trực tiếp qua Webcam (> 15 FPS).
* **Edge Computing:** Mô hình chạy 100% bằng tài nguyên máy khách qua TensorFlow.js, không cần gửi ảnh lên server.
* **Result Smoothing:** Tích hợp bộ đệm (buffer) đa khung hình giúp kết quả hiển thị mượt mà.

## Cài đặt & Sử dụng
1. Truy cập bản Demo trực tuyến: `[Dán link Netlify của bạn vào đây]`
2. Cấp quyền sử dụng Camera cho trình duyệt.
3. Đưa vật thể ra trước camera, giữ khoảng cách 15-30cm và đảm bảo môi trường đủ sáng.

## Kiến trúc Kỹ thuật
* **AI Model:** MobileNetV2 (Transfer Learning, chuẩn hóa dải màu `[-1, 1]`).
* **Frontend:** HTML5, CSS3, Vanilla JavaScript, TensorFlow.js (`tfjs`).
* **Kỹ thuật xử lý:** Áp dụng Data Augmentation, Confidence Threshold > 70%, sửa lỗi Batch Shape của Keras 3.
