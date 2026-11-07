/* ===================================================================
   app.js – camera, giao diện, thống kê, lịch sử, cài đặt
   =================================================================== */
const $ = id => document.getElementById(id);
const { CLASSES, SMOOTH, STABLE_FRAMES, INTERVAL_MS } = CONFIG;
const CONFIDENCE_THRESHOLD = 0.7;
const HISTORY_SIZE = 5;

const video = $("video"), photo = $("photo"), stage = $("stage");
const state = {
  stream: null, running: false, facing: "environment",
  lastRun: 0, lastFrame: 0,
  buffer: [],
  predictionHistory: [],
  stableLabel: null, stableCount: 0, locked: false,
  counts: Object.fromEntries(CLASSES.map(c => [c, 0])),
  history: []
};

/* ---------- Lưu cài đặt (không bắt buộc, lỗi thì bỏ qua) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem("sws_" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("sws_" + k, JSON.stringify(v)); } catch {} }
};
const settings = {
  threshold: store.get("threshold", 60),
  mirror: store.get("mirror", false),
  speak: store.get("speak", false),
  demo: false,
  theme: store.get("theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
};

/* ---------- Dựng giao diện từ cấu hình ---------- */
function buildBars(el, prefix) {
  el.innerHTML = CLASSES.map(c => `
    <div class="row"><span>${INFO[c].vi}</span>
      <div class="track"><div class="fill" id="${prefix}f-${c}" style="background:${INFO[c].color}"></div></div>
      <b id="${prefix}p-${c}">0${prefix ? "" : "%"}</b></div>`).join("");
}
buildBars($("bars"), "");
buildBars($("counts"), "c");

$("guideGrid").innerHTML = CLASSES.map(c => `
  <article class="guide" style="--c:${INFO[c].color}">
    <header><b>${INFO[c].vi}</b><span>${c}</span></header>
    <div class="body">
      <div><b>Bỏ vào:</b> ${INFO[c].bin}</div>
      <div><b>Ví dụ:</b> ${INFO[c].examples}</div>
      <p>${INFO[c].tip}</p>
    </div>
  </article>`).join("");

/* ---------- Tiện ích ---------- */
function setStatus(kind, text) { $("dot").className = "dot " + kind; $("statusText").textContent = text; }
let toastTimer;
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}
function applyTheme() {
  document.documentElement.dataset.theme = settings.theme;
  store.set("theme", settings.theme);
}
function applySettings() {
  $("threshold").value = settings.threshold;
  $("thVal").textContent = settings.threshold + "%";
  $("mirror").checked = settings.mirror;
  $("speak").checked = settings.speak;
  $("demo").checked = settings.demo;
  stage.classList.toggle("mirror", settings.mirror);
}

/* ---------- Tabs ---------- */
document.querySelectorAll(".tabs [role=tab]").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".tabs [role=tab]").forEach(t => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      $(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (tab.id !== "tab-detect" && state.running) stopCamera();
  };
});

/* ---------- Camera ---------- */
async function startCamera() {
  try {
    stopCamera();
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: state.facing, width: { ideal: 960 }, height: { ideal: 720 } }, audio: false
    });
    video.srcObject = state.stream; await video.play();
    photo.hidden = true; video.hidden = false; $("empty").hidden = true;
    state.running = true; stage.classList.add("running");
    $("startBtn").disabled = true; $("stopBtn").disabled = false; $("flipBtn").disabled = false;
    resetPredictionHistory();
    resetStable();
    requestAnimationFrame(loop);
  } catch (err) {
    $("empty").hidden = false;
    $("empty").textContent = err.name === "NotAllowedError"
      ? "Trình duyệt đang chặn camera. Hãy cho phép camera trong thanh địa chỉ rồi thử lại."
      : "Không mở được camera. Kiểm tra thiết bị có webcam và trang đang chạy qua https hoặc localhost.";
  }
}
function stopCamera() {
  state.running = false; stage.classList.remove("running");
  resetPredictionHistory();
  if (state.stream) { state.stream.getTracks().forEach(t => t.stop()); state.stream = null; }
  video.hidden = true;
  $("startBtn").disabled = false; $("stopBtn").disabled = true; $("flipBtn").disabled = true;
}
function toggleCamera() { state.running ? stopCameraWithMessage() : startCamera(); }
function stopCameraWithMessage() {
  stopCamera();
  if (photo.hidden) { $("empty").hidden = false; $("empty").textContent = "Camera đã dừng. Bấm “Bắt đầu” để tiếp tục."; }
}

/* ---------- Dự đoán ---------- */
function smooth(p) {
  state.buffer.push(p); if (state.buffer.length > SMOOTH) state.buffer.shift();
  return CLASSES.map((_, i) => state.buffer.reduce((a, b) => a + b[i], 0) / state.buffer.length);
}
function getSmoothResult(historyArray) {
  if (historyArray.length === 0) return null;
  const counts = {};
  let maxCount = 0;
  let mostFrequent = null;

  for (const item of historyArray) {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      mostFrequent = item;
    }
  }
  return maxCount >= Math.ceil(HISTORY_SIZE / 2) ? mostFrequent : null;
}
function resetPredictionHistory() {
  state.predictionHistory = [];
}
function meetsConfidenceThreshold(probability) {
  return probability >= Math.max(CONFIDENCE_THRESHOLD, settings.threshold / 100);
}
function resetStable() {
  state.stableLabel = null; state.stableCount = 0; state.locked = false;
  $("holdWrap").hidden = true; $("holdBar").style.width = "0";
  document.querySelector(".reticle").classList.remove("locked");
}

function render(p) {
  let best = 0; p.forEach((v, i) => { if (v > p[best]) best = i; });
  CLASSES.forEach((c, i) => {
    $("f-" + c).style.width = (p[i] * 100).toFixed(0) + "%";
    $("p-" + c).textContent = (p[i] * 100).toFixed(0) + "%";
  });

  const maxProb = p[best];
  const currentLabel = meetsConfidenceThreshold(maxProb) ? CLASSES[best] : "Chưa rõ";
  state.predictionHistory.push(currentLabel);
  if (state.predictionHistory.length > HISTORY_SIZE) state.predictionHistory.shift();

  const finalResult = getSmoothResult(state.predictionHistory);
  const c = CLASSES[best], conf = maxProb, r = $("result");
  if (!finalResult || finalResult === "Chưa rõ") {
    r.style.setProperty("--bin", "#6b7b79");
    $("rName").textContent = "Chưa chắc chắn";
    $("rBin").textContent = "Đưa vật lại gần hơn, giữ yên và đảm bảo đủ sáng.";
    $("rConf").textContent = `Cao nhất: ${(conf * 100).toFixed(0)}% (${INFO[c].vi})`;
    resetStable();
    return;
  }
  const finalInfo = INFO[finalResult];
  r.style.setProperty("--bin", finalInfo.color);
  $("rName").textContent = finalInfo.vi;
  $("rBin").textContent = finalInfo.bin;
  $("rConf").textContent = "Độ tin cậy: " + (conf * 100).toFixed(1) + "%";
  console.log("Kết quả chốt:", finalResult, "- Xác suất:", maxProb.toFixed(2));
  trackStable(finalResult, conf);
}

/* Giữ yên cùng một loại đủ lâu thì mới ghi nhận */
function trackStable(c, conf) {
  if (c !== state.stableLabel) { resetStable(); state.stableLabel = c; }
  if (state.locked) return;
  state.stableCount++;
  $("holdWrap").hidden = false;
  $("holdBar").style.width = Math.min(100, state.stableCount / STABLE_FRAMES * 100) + "%";
  if (state.stableCount >= STABLE_FRAMES) {
    state.locked = true;
    document.querySelector(".reticle").classList.add("locked");
    confirmItem(c, conf);
  }
}

function confirmItem(c, conf) {
  state.counts[c]++;
  state.history.unshift({ time: new Date(), label: c, conf });
  renderStats(); renderHistory();
  toast("Đã ghi nhận: " + INFO[c].vi);
  if (settings.speak && "speechSynthesis" in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(INFO[c].vi + ". " + INFO[c].bin);
    u.lang = "vi-VN"; speechSynthesis.speak(u);
  }
}

function renderStats() {
  const total = CLASSES.reduce((a, c) => a + state.counts[c], 0);
  $("totalCount").textContent = total + " vật";
  CLASSES.forEach(c => {
    $("cf-" + c).style.width = (total ? state.counts[c] / total * 100 : 0) + "%";
    $("cp-" + c).textContent = state.counts[c];
  });
}
function renderHistory() {
  const ul = $("hist");
  if (!state.history.length) {
    ul.innerHTML = '<li class="placeholder"><span>Giữ vật yên khoảng 1 giây để hệ thống ghi nhận.</span></li>';
    return;
  }
  ul.innerHTML = state.history.slice(0, 40).map(h => `
    <li style="--c:${INFO[h.label].color}"><span>${INFO[h.label].vi}</span>
    <span>${(h.conf * 100).toFixed(0)}% · ${h.time.toLocaleTimeString("vi-VN")}</span></li>`).join("");
}

function classify(source) {
  const t0 = performance.now();
  const raw = (settings.demo || !Classifier.ready) ? Classifier.demo() : Classifier.predict(source);
  $("lat").textContent = (performance.now() - t0).toFixed(0);
  render(smooth(raw));
}

function loop(ts) {
  if (!state.running) return;
  if (ts - state.lastRun >= INTERVAL_MS && video.readyState >= 2) {
    state.lastRun = ts;
    if (state.lastFrame) $("fps").textContent = (1000 / (ts - state.lastFrame)).toFixed(1);
    state.lastFrame = ts;
    classify(video);
  }
  requestAnimationFrame(loop);
}

/* ---------- Sự kiện ---------- */
$("startBtn").onclick = startCamera;
$("stopBtn").onclick = stopCameraWithMessage;
$("flipBtn").onclick = () => { state.facing = state.facing === "environment" ? "user" : "environment"; startCamera(); };

$("file").onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  stopCamera();
  const img = new Image();
  img.onload = () => {
    photo.width = img.naturalWidth; photo.height = img.naturalHeight;
    photo.getContext("2d").drawImage(img, 0, 0);
    photo.hidden = false; $("empty").hidden = true;
    state.buffer = []; resetPredictionHistory(); resetStable();
    classify(photo);
    // Ảnh tĩnh: ghi nhận ngay, không cần giữ yên
    const p = state.buffer[0]; let b = 0; p.forEach((v, i) => { if (v > p[b]) b = i; });
    if (meetsConfidenceThreshold(p[b])) confirmItem(CLASSES[b], p[b]);
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(f); e.target.value = "";
};
$("fileLabel").onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file").click(); } };

$("threshold").oninput = e => {
  settings.threshold = +e.target.value; $("thVal").textContent = settings.threshold + "%";
  store.set("threshold", settings.threshold);
};
$("mirror").onchange = e => { settings.mirror = e.target.checked; stage.classList.toggle("mirror", settings.mirror); store.set("mirror", settings.mirror); };
$("speak").onchange = e => { settings.speak = e.target.checked; store.set("speak", settings.speak); };
$("demo").onchange = e => { settings.demo = e.target.checked; state.buffer = []; resetPredictionHistory(); resetStable(); };

$("themeBtn").onclick = () => { settings.theme = settings.theme === "dark" ? "light" : "dark"; applyTheme(); };
$("fsBtn").onclick = toggleFullscreen;
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (stage.requestFullscreen) stage.requestFullscreen();
}

$("clearBtn").onclick = () => {
  state.history = []; CLASSES.forEach(c => state.counts[c] = 0);
  renderStats(); renderHistory();
};
$("csvBtn").onclick = () => {
  if (!state.history.length) { toast("Chưa có dữ liệu để xuất"); return; }
  const rows = ["thoi_gian,loai,do_tin_cay"].concat(
    state.history.slice().reverse().map(h => `${h.time.toISOString()},${h.label},${h.conf.toFixed(4)}`));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
  a.download = "lich-su-phan-loai.csv"; a.click(); URL.revokeObjectURL(a.href);
};

document.addEventListener("keydown", e => {
  if (e.target.matches("input,textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === "Space") { e.preventDefault(); toggleCamera(); }
  else if (e.key === "f" || e.key === "F") toggleFullscreen();
  else if (e.key === "t" || e.key === "T") $("themeBtn").click();
});
window.addEventListener("beforeunload", stopCamera);

/* ---------- Khởi động ---------- */
applyTheme(); applySettings();
Classifier.load()
  .then(() => setStatus("ok", "Mô hình sẵn sàng"))
  .catch(err => {
    console.error(err);
    settings.demo = true; applySettings();
    setStatus("warn", "Chưa có model/model.json – đang ở chế độ demo");
  });
