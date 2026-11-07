/* ===================================================================
   CẤU HÌNH – chỉnh theo mô hình của Thành viên 1
   =================================================================== */
const CONFIG = {
  MODEL_URL: "model/model.json",
  IMG_SIZE: 224,

  // Thứ tự lớp PHẢI khớp lúc huấn luyện (flow_from_directory sắp theo bảng chữ cái).
  CLASSES: ["cardboard", "glass", "metal", "paper", "plastic", "trash"],

  // "mobilenet" => ảnh về [-1, 1]   |   "01" => ảnh về [0, 1]
  PREPROCESS: "mobilenet",

  INTERVAL_MS: 150,    // khoảng cách giữa 2 lần dự đoán
  SMOOTH: 5,           // số khung dùng để làm mượt kết quả
  STABLE_FRAMES: 6     // số khung liên tiếp giống nhau để ghi nhận (~1 giây)
};

/* Thông tin hiển thị cho từng loại rác */
const INFO = {
  cardboard: {
    vi: "Giấy & Carton", color: "#2F6FDE",
    bin: "Thùng giấy / carton tái chế. Gấp phẳng, giữ khô ráo.",
    examples: "Thùng giao hàng, hộp bìa cứng, giấy in, báo",
    tip: "Tháo băng keo, giữ khô ráo và không bỏ giấy dính dầu mỡ."
  },
  glass: {
    vi: "Thủy tinh", color: "#1F8A70",
    bin: "Thùng thủy tinh tái chế. Rửa sạch, cẩn thận khi vỡ.",
    examples: "Chai lọ thủy tinh, hũ đựng thực phẩm",
    tip: "Không bỏ chung gương, bóng đèn hay đồ gốm sứ."
  },
  metal: {
    vi: "Kim loại", color: "#5B6B7A",
    bin: "Thùng kim loại tái chế (lon nhôm, hộp thiếc). Làm sạch trước khi bỏ.",
    examples: "Lon nước ngọt, hộp thiếc, nắp chai kim loại",
    tip: "Tráng nhanh với nước để tránh mùi và côn trùng."
  },
  paper: {
    vi: "Giấy & Carton", color: "#2F6FDE",
    bin: "Thùng giấy / carton tái chế. Gấp phẳng, giữ khô ráo.",
    examples: "Thùng giao hàng, hộp bìa cứng, giấy in, báo",
    tip: "Tháo băng keo, giữ khô ráo và không bỏ giấy dính dầu mỡ."
  },
  plastic: {
    vi: "Nhựa", color: "#B8860B",
    bin: "Thùng nhựa tái chế (chai, hộp). Súc rửa và ép dẹp.",
    examples: "Chai nước, hộp nhựa, can nhựa",
    tip: "Vặn chặt nắp sau khi ép dẹp chai."
  },
  trash: {
    vi: "Rác còn lại", color: "#3F4747",
    bin: "Thùng rác thông thường, không tái chế được.",
    examples: "Túi ni lông bẩn, khăn giấy, ly giấy tráng nhựa",
    tip: "Đây là nhóm cần giảm bớt nhiều nhất."
  }
};