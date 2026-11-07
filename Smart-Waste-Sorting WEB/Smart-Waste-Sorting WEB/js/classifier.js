/* ===================================================================
   classifier.js – tải mô hình và dự đoán (phần AI của giao diện)
   =================================================================== */
const Classifier = {
  model: null,

  get ready() { return this.model !== null; },

  async load() {
    await tf.ready();
    this.model = await tf.loadLayersModel(CONFIG.MODEL_URL + "?v=" + Date.now());
    // Chạy thử 1 lần để lần dự đoán đầu không bị giật
    tf.tidy(() => this.model.predict(tf.zeros([1, CONFIG.IMG_SIZE, CONFIG.IMG_SIZE, 3])));
  },

  /** source: <video>, <canvas> hoặc <img>. Trả về mảng xác suất theo CONFIG.CLASSES */
  predict(source) {
    return tf.tidy(() => {
      let x = tf.browser.fromPixels(source)
        .resizeBilinear([CONFIG.IMG_SIZE, CONFIG.IMG_SIZE])
        .toFloat();
      x = x.div(127.5).sub(1);
      const out = this.model.predict(x.expandDims(0));
      return Array.from((Array.isArray(out) ? out[0] : out).dataSync());
    });
  },

  /** Xác suất giả, chỉ để xem thử giao diện khi chưa có model */
  demo() {
    const k = Math.floor(Date.now() / 3000) % CONFIG.CLASSES.length;
    const p = CONFIG.CLASSES.map((_, i) => (i === k ? 0.6 + Math.random() * 0.3 : Math.random() * 0.1));
    const s = p.reduce((a, b) => a + b, 0);
    return p.map(v => v / s);
  }
};