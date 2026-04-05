const MENU_SELECTOR = [
  "a.f-menu__link.f-menu__submenu-link",
  "a.f-menu__link",
  "a.f-menu_link.f-menu_submenu-link"
].join(", ");
const UPDATE_DEBOUNCE_MS = 600;
const CLASS_PATH_FRAGMENT = "/student/classes/";
const CLASS_EXCLUDE_PATHS = ["/student/classes/my"];
const AUTOMATION_KEY = "MB_AUTOMATION_NEXT";
const BATCH_KEY = "MB_AUTOMATION_BATCH";
const TASK_KEYWORDS = ["任务", "Task", "Tasks"];
const TASK_CARD_SELECTOR =
  "div.fusion-card-item.short-assignment.section.hstack.flex-wrap, div.fusion-card-item.short-assignment";
const TASK_TITLE_SELECTORS = [
  ".fusion-card-header-title",
  ".text-truncate",
  "a[href*='/student/tasks/']",
  "h4",
  "h3",
  "strong",
];
const TASK_DUE_SELECTORS = [
  ".due.regular",
  ".fusion-card-due-date",
  "[data-testid*=due]",
  ".assignment-due-date",
];
const TASK_MONTH_SELECTORS = [".month"];
const TASK_DAY_SELECTORS = [".day"];
const CSV_CRITERIA_COLUMNS = [
  { header: "A", matches: (label) => /^A\b/i.test(label) },
  { header: "B", matches: (label) => /^B\b/i.test(label) },
  { header: "C", matches: (label) => /^C\b/i.test(label) },
  { header: "D", matches: (label) => /^D\b/i.test(label) },
  { header: "学校成绩", matches: (label) => /(学校|school)/i.test(label) },
];
const TASK_GRADE_SELECTORS = [
  ".label.label-score",
  ".label-score",
  ".label.label-points",
  ".label-points",
  ".cell.criterion-grade",
  ".criterion-grade",
  ".status",
];
const TEXT_ATTRS = [
  "aria-label",
  "title",
  "data-title",
  "data-original-title",
  "data-score",
  "data-points",
  "data-content",
  "data-status",
  "data-label",
];
const LABEL_NAME_SELECTORS = [
  ".criterion-label",
  ".criterion-name",
  ".criterion-title",
  ".label-title",
  ".fusion-card-subtitle",
  "strong",
];
const STATUS_ICON_SELECTORS = [
  ".status.not-assessed",
  ".status .not-assessed",
  ".status [data-status]",
  ".status-icon",
  "svg.status.not-assessed",
  ".vstack.flex-center.p-2",
  ".status.pending",
];
const TASK_SUMMARY_DEBOUNCE_MS = 500;
const OVERLAY_ROOT_ID = "mb-batch-capture-overlay";
const OVERLAY_STYLE_ID = "mb-batch-capture-overlay-style";
const OVERLAY_UPDATE_INTERVAL_MS = 400;
const BATCH_LOOP_INTERVAL_MS = 900;
const GPA_OPTIONS_KEY = "mbGpaOptions";
const DEFAULT_GPA_OPTIONS = {
  roundingMode: "round",
};

let debouncedTimer = null;
let lastSignature = null;
let taskSummaryTimer = null;
let lastTaskSignature = null;
let lastOverlayRenderKey = "";
let lastOverlayRenderAt = 0;
let batchLoopTimer = null;
let overlayDownloadUrl = null;
let currentGpaOptions = { ...DEFAULT_GPA_OPTIONS };

const safeSendMessage = (message) => {
  try {
    chrome.runtime.sendMessage(message, () => void 0);
  } catch (err) {
    console.warn("无法向后台发送消息：", err);
  }
};

const syncGpaOptionsFromStorage = () => {
  try {
    chrome.storage.local.get([GPA_OPTIONS_KEY], (result) => {
      currentGpaOptions = {
        ...DEFAULT_GPA_OPTIONS,
        ...(result?.[GPA_OPTIONS_KEY] || {}),
      };
    });
  } catch (err) {
    currentGpaOptions = { ...DEFAULT_GPA_OPTIONS };
  }
};

syncGpaOptionsFromStorage();

try {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[GPA_OPTIONS_KEY]) {
      return;
    }
    currentGpaOptions = {
      ...DEFAULT_GPA_OPTIONS,
      ...(changes[GPA_OPTIONS_KEY].newValue || {}),
    };
  });
} catch (err) {
  // ignore
}

const ensureCaptureOverlayStyle = () => {
  if (document.getElementById(OVERLAY_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = OVERLAY_STYLE_ID;
  style.textContent = `
    #${OVERLAY_ROOT_ID} {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", Arial, sans-serif;
      pointer-events: none;
      padding: 16px;
      box-sizing: border-box;
      overflow-y: auto;
    }
    #${OVERLAY_ROOT_ID} .mb-overlay-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.52);
      backdrop-filter: blur(1.5px);
    }
    #${OVERLAY_ROOT_ID}.mb-overlay--running,
    #${OVERLAY_ROOT_ID}.mb-overlay--done {
      pointer-events: auto;
      display: flex;
    }
    .mb-overlay-card {
      position: relative;
      width: min(96vw, 780px);
      padding: 20px;
      border-radius: 14px;
      border: 1px solid #d6d6dc;
      background: #ffffff;
      color: #111827;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.32);
      pointer-events: auto;
      animation: mbOverlayFadeIn 0.2s ease;
      max-height: calc(100vh - 32px);
      overflow-y: auto;
    }
    .mb-overlay-title {
      margin: 0 0 8px;
      font-size: 18px;
      line-height: 1.35;
      color: #0f766e;
    }
    .mb-overlay-title.done {
      color: #166534;
    }
    .mb-overlay-status {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
      color: #334155;
    }
    .mb-overlay-progress {
      margin: 12px 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .mb-overlay-progress-text {
      font-size: 13px;
      color: #334155;
    }
    .mb-overlay-track {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }
    .mb-overlay-fill {
      display: block;
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #0f766e, #15803d);
      transition: width 0.25s ease;
      border-radius: 999px;
    }
    .mb-overlay-tip {
      margin: 8px 0 0;
      color: #475569;
      line-height: 1.5;
      font-size: 13px;
    }
    .mb-overlay-result {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #d7e3d8;
      background: #f7faf7;
      color: #1f2937;
      display: none;
      white-space: pre-line;
      font-size: 13px;
      line-height: 1.5;
    }
    .mb-overlay-class-row {
      border: 1px solid #dbe7dc;
      background: #ffffff;
      border-radius: 10px;
      padding: 10px;
      margin-bottom: 8px;
    }
    .mb-overlay-class-title {
      font-size: 14px;
      font-weight: 800;
      color: #14532d;
      margin-bottom: 8px;
    }
    .mb-overlay-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .mb-overlay-metric-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid #cfe3d1;
      background: #f5fbf6;
      border-radius: 999px;
      padding: 3px 9px;
      color: #1f2937;
      font-size: 12px;
      font-weight: 600;
    }
    .mb-overlay-metric-chip .v {
      font-weight: 800;
      color: #166534;
    }
    .mb-overlay-metric-chip--estimate {
      border-color: #facc15;
      background: #fffbeb;
      color: #92400e;
    }
    .mb-overlay-metric-chip--estimate .v {
      color: #b45309;
    }
    .mb-overlay-metric-chip--empty {
      border-color: #d1d5db;
      background: #f3f4f6;
      color: #4b5563;
    }
    .mb-overlay-summary-line {
      margin-top: 6px;
      font-size: 13px;
      color: #334155;
      font-weight: 600;
    }
    .mb-overlay-gpa-highlight {
      margin-top: 12px;
      display: none;
      align-items: center;
      gap: 8px;
      border: 1px solid #86efac;
      background: #ecfdf3;
      border-radius: 10px;
      padding: 10px 12px;
      color: #14532d;
      font-weight: 700;
      font-size: 15px;
    }
    .mb-overlay-gpa-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 56px;
      padding: 2px 8px;
      border-radius: 999px;
      background: #166534;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
    }
    #${OVERLAY_ROOT_ID}.mb-overlay--done .mb-overlay-result {
      display: block;
    }
    #${OVERLAY_ROOT_ID}.mb-overlay--done .mb-overlay-gpa-highlight {
      display: flex;
    }
    .mb-overlay-download {
      margin-top: 10px;
      display: none;
      color: #166534;
      font-size: 13px;
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    #${OVERLAY_ROOT_ID}.mb-overlay--done .mb-overlay-download {
      display: inline-block;
    }
    .mb-overlay-download:hover {
      color: #15803d;
    }
    .mb-overlay-actions {
      margin-top: 14px;
      text-align: right;
    }
    .mb-overlay-close {
      border: none;
      border-radius: 10px;
      padding: 8px 14px;
      font-size: 13px;
      cursor: pointer;
      background: #166534;
      color: #fff;
      display: none;
    }
    #${OVERLAY_ROOT_ID}.mb-overlay--done .mb-overlay-close {
      display: inline-flex;
    }
    .mb-overlay-close:hover {
      background: #15803d;
    }
    @keyframes mbOverlayFadeIn {
      from {
        transform: translateY(8px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `;
  const container = document.head || document.documentElement;
  container.appendChild(style);
};

const getCaptureOverlay = () => {
  ensureCaptureOverlayStyle();
  let root = document.getElementById(OVERLAY_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = OVERLAY_ROOT_ID;
    root.innerHTML = `
      <div class="mb-overlay-backdrop"></div>
      <div class="mb-overlay-card" role="dialog" aria-live="polite">
        <h3 class="mb-overlay-title">抓取进行中</h3>
        <p class="mb-overlay-status">正在连接页面，请稍等...</p>
        <div class="mb-overlay-progress">
          <span class="mb-overlay-progress-text">已处理 0 / 0 个班级</span>
          <div class="mb-overlay-track">
            <span class="mb-overlay-fill"></span>
          </div>
        </div>
        <p class="mb-overlay-tip">抓取完成后会自动弹出保存提醒。</p>
        <div class="mb-overlay-gpa-highlight">
          <span class="mb-overlay-gpa-badge">GPA</span>
          <span class="mb-overlay-gpa-value">-</span>
        </div>
        <div class="mb-overlay-result"></div>
        <a class="mb-overlay-download" href="#" download>下载 CSV 文件</a>
        <div class="mb-overlay-actions">
          <button class="mb-overlay-close" type="button">我知道了</button>
        </div>
      </div>
    `;
    root.querySelector(".mb-overlay-close").addEventListener("click", () => {
      root.style.display = "none";
      root.classList.remove("mb-overlay--running", "mb-overlay--done");
    });
    document.body.appendChild(root);
  }
  return root;
};

const setBatchCaptureOverlay = (message = {}) => {
  const {
    total = 0,
    processed = 0,
    currentClass = "",
    statusText = "正在抓取数据，请稍候...",
    tipText = "抓取完成后会自动弹出保存提醒。",
    done = false,
    taskCount = 0,
    gpaText = "",
    gpaHtml = "",
    totalGpaValue = null,
    totalGpa425Value = null,
    downloadUrl = "",
    downloadName = "",
  } = message;

  const root = getCaptureOverlay();
  const title = root.querySelector(".mb-overlay-title");
  const status = root.querySelector(".mb-overlay-status");
  const progressText = root.querySelector(".mb-overlay-progress-text");
  const fill = root.querySelector(".mb-overlay-fill");
  const tip = root.querySelector(".mb-overlay-tip");
  const gpaValue = root.querySelector(".mb-overlay-gpa-value");
  const result = root.querySelector(".mb-overlay-result");
  const download = root.querySelector(".mb-overlay-download");

  const safeTotal = Number(total) || 0;
  const safeProcessed = Number(processed) || 0;
  const percent = safeTotal > 0 ? Math.min(100, Math.round((safeProcessed / safeTotal) * 100)) : 0;
  const renderKey = JSON.stringify({
    safeTotal,
    safeProcessed,
    currentClass,
    statusText,
    tipText,
    done: !!done,
    percent,
    taskCount,
    gpaText,
    gpaHtml,
    totalGpaValue,
    totalGpa425Value,
    downloadName,
  });
  const now = Date.now();
  if (
    renderKey === lastOverlayRenderKey &&
    now - lastOverlayRenderAt < OVERLAY_UPDATE_INTERVAL_MS
  ) {
    return;
  }
  lastOverlayRenderKey = renderKey;
  lastOverlayRenderAt = now;

  root.classList.remove("mb-overlay--running", "mb-overlay--done");
  root.classList.add(done ? "mb-overlay--done" : "mb-overlay--running");
  root.style.display = "flex";
  root.style.pointerEvents = "auto";

  title.textContent = done ? "抓取已完成" : "正在批量抓取任务";
  title.classList.toggle("done", !!done);
  status.textContent = done
    ? `抓取完成，共处理 ${safeProcessed} 个班级。`
    : `进度 ${safeProcessed}/${safeTotal}，${statusText}`;
  progressText.textContent = done
    ? `已统计任务 ${taskCount || 0} 个。`
    : `当前班级：${currentClass || "未知"}`;
  fill.style.width = `${percent}%`;
  tip.textContent = tipText;
  if (done) {
    result.innerHTML = gpaHtml || "";
    if (!gpaHtml) {
      result.textContent = gpaText || "未提取到可计算的成绩数据。";
    }
    gpaValue.textContent = `总 GPA(7分)：${formatScore(totalGpaValue)} / 总 GPA(4.25)：${formatScore(
      totalGpa425Value
    )}`;
    if (downloadUrl) {
      download.href = downloadUrl;
      download.download = downloadName || "managebac_tasks.csv";
      download.textContent = `下载 CSV：${download.download}`;
    } else {
      download.removeAttribute("href");
      download.removeAttribute("download");
      download.textContent = "CSV 生成失败，请稍后重试";
    }
  } else {
    gpaValue.textContent = "-";
    result.textContent = "";
    download.removeAttribute("href");
    download.removeAttribute("download");
    download.textContent = "";
  }
};

const showBatchCaptureRunning = (options = {}) => {
  setBatchCaptureOverlay({
    ...options,
    done: false,
    statusText: "请保持 ManageBac 标签页前台，页面会自动跳转。",
    tipText: "抓取过程中将持续显示当前进度。",
  });
};

const showBatchCaptureDone = (options = {}) => {
  setBatchCaptureOverlay({
    ...options,
    done: true,
    statusText: "抓取完成。",
    tipText: "可直接点击下方链接下载 CSV，并查看 GPA 汇总。",
  });
};

const hideBatchCaptureOverlay = () => {
  const root = document.getElementById(OVERLAY_ROOT_ID);
  if (!root) return;
  root.style.display = "none";
  root.classList.remove("mb-overlay--running", "mb-overlay--done");
  if (overlayDownloadUrl) {
    URL.revokeObjectURL(overlayDownloadUrl);
    overlayDownloadUrl = null;
  }
  lastOverlayRenderKey = "";
  lastOverlayRenderAt = 0;
};

const average = (list = []) => {
  const valid = Array.isArray(list) ? list.filter((n) => Number.isFinite(n)) : [];
  if (!valid.length) return null;
  const sum = valid.reduce((acc, n) => acc + n, 0);
  return sum / valid.length;
};

const applyRoundingMode = (value, options = currentGpaOptions) => {
  if (!Number.isFinite(value)) {
    return null;
  }
  return options?.roundingMode === "raw" ? value : Math.round(value);
};

const toMbSubjectLevel = (total) => {
  if (!Number.isFinite(total)) {
    return null;
  }
  if (total <= 5) return 1;
  if (total <= 9) return 2;
  if (total <= 14) return 3;
  if (total <= 18) return 4;
  if (total <= 23) return 5;
  if (total <= 27) return 6;
  return 7;
};

const toGpa425 = (level7) => {
  if (!Number.isFinite(level7)) {
    return null;
  }
  const table = {
    1: 1,
    2: 1.5,
    3: 2,
    4: 3,
    5: 3.5,
    6: 4,
    7: 4.25,
  };
  return table[level7] ?? null;
};

const extractScoreNumbers = (value) => {
  if (value === null || value === undefined) return [];
  const text = String(value).trim();
  if (!text) return [];
  const slashMatch = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (slashMatch) {
    return [Number(slashMatch[1])];
  }
  const numbers = text.match(/-?\d+(?:\.\d+)?/g) || [];
  return numbers.map((item) => Number(item)).filter((n) => Number.isFinite(n));
};

const formatScore = (value) => (Number.isFinite(value) ? value.toFixed(2) : "-");
const formatIntegerScore = (value) =>
  Number.isFinite(value) ? String(Math.round(value)) : "-";
const formatCriterionDisplay = (value, summary) => {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return summary?.roundingMode === "raw" ? value.toFixed(2) : String(Math.round(value));
};

const CRITERION_KEYS = ["A", "B", "C", "D"];

const computeBatchGpaSummary = (entries = [], options = currentGpaOptions) => {
  const classRows = entries.map((entry) => {
    const pool = { A: [], B: [], C: [], D: [] };
    const tasks = Array.isArray(entry?.summary?.tasks) ? entry.summary.tasks : [];
    tasks.forEach((task) => {
      const criteria = Array.isArray(task.criteria) ? task.criteria : [];
      criteria.forEach((criterion) => {
        const label = (criterion.label || "").trim();
        const key = /^[ABCD]\b/i.test(label) ? label.charAt(0).toUpperCase() : null;
        if (!key || !pool[key]) return;
        const values = Array.isArray(criterion.values) ? criterion.values : [];
        values.forEach((raw) => {
          extractScoreNumbers(raw).forEach((n) => pool[key].push(n));
        });
      });
    });
    const avgA = average(pool.A);
    const avgB = average(pool.B);
    const avgC = average(pool.C);
    const avgD = average(pool.D);
    const A = applyRoundingMode(avgA, options);
    const B = applyRoundingMode(avgB, options);
    const C = applyRoundingMode(avgC, options);
    const D = applyRoundingMode(avgD, options);
    const criterionValues = { A, B, C, D };
    const knownCriteria = CRITERION_KEYS.filter((key) =>
      Number.isFinite(criterionValues[key])
    );
    const missingCriteria = CRITERION_KEYS.filter(
      (key) => !Number.isFinite(criterionValues[key])
    );
    const hasAnyScore = knownCriteria.length > 0;
    const isComplete = hasAnyScore && missingCriteria.length === 0;
    const rawKnownTotal = hasAnyScore
      ? [A, B, C, D].reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0)
      : null;
    const criterionTotal = isComplete ? rawKnownTotal : null;
    const subjectLevel7 = isComplete ? toMbSubjectLevel(criterionTotal) : null;
    const gpa425 = isComplete ? toGpa425(subjectLevel7) : null;
    const knownAverage = average(knownCriteria.map((key) => criterionValues[key]));
    const estimatedCriterionTotal =
      knownCriteria.length && missingCriteria.length
        ? rawKnownTotal + knownAverage * missingCriteria.length
        : criterionTotal;
    const estimatedSubjectLevel7 =
      knownCriteria.length && missingCriteria.length
        ? toMbSubjectLevel(estimatedCriterionTotal)
        : subjectLevel7;
    const estimatedGpa425 =
      knownCriteria.length && missingCriteria.length
        ? toGpa425(estimatedSubjectLevel7)
        : gpa425;
    const isEstimated = knownCriteria.length > 0 && missingCriteria.length > 0;
    return {
      classTitle: entry.classTitle || "(未命名班级)",
      classHref: entry.classHref || "",
      taskCount: Number(entry?.summary?.count) || tasks.length || 0,
      avgA,
      avgB,
      avgC,
      avgD,
      A,
      B,
      C,
      D,
      knownCriteria,
      missingCriteria,
      isComplete,
      criterionTotal,
      subjectLevel7,
      gpa425,
      estimatedCriterionTotal,
      estimatedSubjectLevel7,
      estimatedGpa425,
      isEstimated,
      hasAnyScore,
    };
  });
  const totalTaskCount = classRows.reduce((acc, row) => acc + (row.taskCount || 0), 0);
  const totalGpa = average(classRows.filter((row) => row.isComplete).map((row) => row.subjectLevel7));
  const totalGpa425 = average(classRows.filter((row) => row.isComplete).map((row) => row.gpa425));
  const estimatedTotalGpa = average(
    classRows
      .filter((row) => row.hasAnyScore)
      .map((row) => row.estimatedSubjectLevel7 ?? row.subjectLevel7)
  );
  const estimatedTotalGpa425 = average(
    classRows.filter((row) => row.hasAnyScore).map((row) => row.estimatedGpa425 ?? row.gpa425)
  );
  const hasEstimatedRows = classRows.some((row) => row.isEstimated);
  return {
    classRows,
    totalTaskCount,
    totalGpa,
    totalGpa425,
    estimatedTotalGpa,
    estimatedTotalGpa425,
    hasEstimatedRows,
    roundingMode: options?.roundingMode === "raw" ? "raw" : "round",
  };
};

const buildOverlayGpaText = (summary) => {
  if (!summary.classRows.length) {
    return "未提取到可计算的成绩数据。";
  }
  const roundingText =
    summary.roundingMode === "raw" ? "保留平均值直接换算" : "ABCD 平均值四舍五入后换算";
  const lines = summary.classRows.map(
    (row) => {
      if (!row.hasAnyScore) {
        return `${row.classTitle}\n暂无评分数据  任务:${row.taskCount}`;
      }
      const parts = row.knownCriteria.map(
        (key) => `${key}:${formatCriterionDisplay(row[key], summary)}`
      );
      parts.push(`已统计:${row.knownCriteria.length}/4`);
      if (row.isEstimated) {
        parts.push(`预估MB总评:${formatIntegerScore(row.estimatedSubjectLevel7)}`);
        parts.push(`预估4.25:${formatScore(row.estimatedGpa425)}`);
      } else {
        parts.push(`MB总评:${formatIntegerScore(row.subjectLevel7)}`);
        parts.push(`4.25 GPA:${formatScore(row.gpa425)}`);
      }
      parts.push(`任务:${row.taskCount}`);
      return `${row.classTitle}\n${parts.join("  ")}`;
    }
  );
  lines.push(`换算方式: ${roundingText}`);
  lines.push(`总任务数: ${summary.totalTaskCount}`);
  lines.push(`总 GPA(7分): ${formatScore(summary.totalGpa)}`);
  lines.push(`总 GPA(4.25): ${formatScore(summary.totalGpa425)}`);
  if (summary.hasEstimatedRows) {
    lines.push(`预估总 GPA(7分): ${formatScore(summary.estimatedTotalGpa)}`);
    lines.push(`预估总 GPA(4.25): ${formatScore(summary.estimatedTotalGpa425)}`);
  }
  return lines.join("\n\n");
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildOverlayGpaHtml = (summary) => {
  if (!summary.classRows.length) {
    return '<div class="mb-overlay-summary-line">未提取到可计算的成绩数据。</div>';
  }
  const roundingText =
    summary.roundingMode === "raw" ? "保留平均值直接换算" : "ABCD 平均值四舍五入后换算";
  const rows = summary.classRows
    .map((row) => {
      if (!row.hasAnyScore) {
        return `
          <div class="mb-overlay-class-row">
            <div class="mb-overlay-class-title">${escapeHtml(row.classTitle)}</div>
            <div class="mb-overlay-metrics">
              <span class="mb-overlay-metric-chip mb-overlay-metric-chip--empty">暂无评分数据</span>
              <span class="mb-overlay-metric-chip">任务数 <span class="v">${row.taskCount}</span></span>
            </div>
          </div>
        `;
      }
      const criterionChips = row.knownCriteria
        .map(
          (key) =>
            `<span class="mb-overlay-metric-chip">${key} <span class="v">${formatCriterionDisplay(
              row[key],
              summary
            )}</span></span>`
        )
        .join("");
      const estimateChips = row.isEstimated
        ? `
            <span class="mb-overlay-metric-chip mb-overlay-metric-chip--estimate">已统计 <span class="v">${row.knownCriteria.length}/4</span></span>
            <span class="mb-overlay-metric-chip mb-overlay-metric-chip--estimate">预估 MB总评 <span class="v">${formatIntegerScore(
              row.estimatedSubjectLevel7
            )}</span></span>
            <span class="mb-overlay-metric-chip mb-overlay-metric-chip--estimate">预估 4.25 <span class="v">${formatScore(
              row.estimatedGpa425
            )}</span></span>
          `
        : `
            <span class="mb-overlay-metric-chip">ABCD合计 <span class="v">${formatCriterionDisplay(
              row.criterionTotal,
              summary
            )}</span></span>
            <span class="mb-overlay-metric-chip">MB总评 <span class="v">${formatIntegerScore(
              row.subjectLevel7
            )}</span></span>
            <span class="mb-overlay-metric-chip">4.25 GPA <span class="v">${formatScore(
              row.gpa425
            )}</span></span>
          `;
      return `
        <div class="mb-overlay-class-row">
          <div class="mb-overlay-class-title">${escapeHtml(row.classTitle)}</div>
          <div class="mb-overlay-metrics">
            ${criterionChips}
            ${estimateChips}
            <span class="mb-overlay-metric-chip">任务数 <span class="v">${row.taskCount}</span></span>
          </div>
        </div>
      `;
    })
    .join("");
  return `
    ${rows}
    <div class="mb-overlay-summary-line">换算方式：${escapeHtml(roundingText)}</div>
    <div class="mb-overlay-summary-line">总任务数：${summary.totalTaskCount}</div>
    <div class="mb-overlay-summary-line">总 GPA(7分)：${formatScore(summary.totalGpa)}</div>
    <div class="mb-overlay-summary-line">总 GPA(4.25)：${formatScore(summary.totalGpa425)}</div>
    ${
      summary.hasEstimatedRows
        ? `<div class="mb-overlay-summary-line">预估总 GPA(7分)：${formatScore(
            summary.estimatedTotalGpa
          )}</div>
           <div class="mb-overlay-summary-line">预估总 GPA(4.25)：${formatScore(
             summary.estimatedTotalGpa425
           )}</div>
           <div class="mb-overlay-summary-line">预估规则：对缺失的 A/B/C/D，按已有维度平均值补齐后再换算。</div>`
        : ""
    }
    <div class="mb-overlay-summary-line">说明：总 GPA 仅统计 A/B/C/D 完整的科目；缺失维度的科目只计入预估总 GPA。</div>
  `;
};

const csvEscape = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\r?\n/g, " ").trim();
  if (text.includes(",") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const formatSubmissionText = (submission) => {
  const list = Array.isArray(submission) ? submission : [];
  if (!list.length) {
    return "";
  }
  return list
    .map((item) => {
      const text = (item.text || "").trim();
      const color = item.colorClass
        ? item.colorClass.replace("color-box-", "")
        : item.isOverdue
        ? "orange"
        : item.isSubmitted
        ? "green"
        : "";
      if (text && color) {
        return `${text} (${color})`;
      }
      return text || color;
    })
    .filter(Boolean)
    .join(" / ");
};

const getCriterionColumnValue = (criteria, column) => {
  const list = Array.isArray(criteria) ? criteria : [];
  for (const entry of list) {
    const label = (entry.label || "").trim();
    if (column.matches(label)) {
      const values = Array.isArray(entry.values) ? entry.values : [];
      return values.length ? values.join("/") : "";
    }
  }
  return "";
};

const formatRemainingCriteria = (criteria) => {
  const list = Array.isArray(criteria)
    ? criteria.filter((entry) => {
        const label = (entry.label || "").trim();
        return !CSV_CRITERIA_COLUMNS.some((col) => col.matches(label));
      })
    : [];
  if (!list.length) {
    return "";
  }
  return list
    .map((entry) => {
      const label = entry.label || "标准";
      const values = Array.isArray(entry.values) ? entry.values.join("/") : "";
      return values ? `${label}: ${values}` : `${label}: -`;
    })
    .join(" | ");
};

const formatDueDisplay = (task) => {
  const parts = [task.dueBadge, task.due].filter(Boolean);
  return parts.join(" | ");
};

const buildBatchCsvContent = (entries, summary) => {
  const rows = [
    [
      "任务名称",
      "班级",
      "任务序号",
      "日期信息",
      "状态",
      ...CSV_CRITERIA_COLUMNS.map((col) => col.header),
      "提交情况",
      "其他评估细则",
      "任务链接",
      "班级链接",
    ]
      .map(csvEscape)
      .join(","),
  ];

  entries.forEach((entry) => {
    const tasks = Array.isArray(entry?.summary?.tasks) ? entry.summary.tasks : [];
    if (!tasks.length) {
      return;
    }
    tasks.forEach((task, index) => {
      const criteriaColumns = CSV_CRITERIA_COLUMNS.map((col) =>
        getCriterionColumnValue(task.criteria, col)
      );
      rows.push(
        [
          task.title || "",
          entry.classTitle || "",
          index + 1,
          formatDueDisplay(task),
          task.status || "",
          ...criteriaColumns,
          formatSubmissionText(task.submission),
          formatRemainingCriteria(task.criteria),
          task.href || "",
          entry.classHref || "",
        ]
          .map(csvEscape)
          .join(",")
      );
    });
  });

  rows.push("");
  rows.push(
    [
      "班级",
      "任务数量",
      "已统计项",
      "ABCD 合计",
      "MB总评(7分)",
      "4.25 GPA",
      "预估MB总评(7分)",
      "预估4.25 GPA",
      "结果类型",
      "A 平均",
      "B 平均",
      "C 平均",
      "D 平均",
      "班级链接",
    ]
      .map(csvEscape)
      .join(","),
  );
  summary.classRows.forEach((row) => {
    rows.push(
      [
        row.classTitle,
        row.taskCount,
        `${row.knownCriteria.length}/4`,
        row.isComplete ? formatCriterionDisplay(row.criterionTotal, summary) : "",
        row.isComplete ? formatIntegerScore(row.subjectLevel7) : "",
        row.isComplete ? formatScore(row.gpa425) : "",
        row.isEstimated ? formatIntegerScore(row.estimatedSubjectLevel7) : "",
        row.isEstimated ? formatScore(row.estimatedGpa425) : "",
        row.hasAnyScore ? (row.isEstimated ? "预估" : "完整") : "无评分",
        row.hasAnyScore ? formatCriterionDisplay(row.A, summary) : "",
        row.hasAnyScore ? formatCriterionDisplay(row.B, summary) : "",
        row.hasAnyScore ? formatCriterionDisplay(row.C, summary) : "",
        row.hasAnyScore ? formatCriterionDisplay(row.D, summary) : "",
        row.classHref,
      ]
        .map(csvEscape)
        .join(",")
    );
  });
  rows.push(
    [
      "总计",
      summary.totalTaskCount,
      "",
      "",
      formatScore(summary.totalGpa),
      formatScore(summary.totalGpa425),
      summary.hasEstimatedRows ? formatScore(summary.estimatedTotalGpa) : "",
      summary.hasEstimatedRows ? formatScore(summary.estimatedTotalGpa425) : "",
      summary.hasEstimatedRows ? "含预估" : "完整",
      "",
      "",
      "",
      "",
      "",
    ]
      .map(csvEscape)
      .join(",")
  );
  return rows.join("\n");
};

const buildOverlayDonePayload = (entries) => {
  const summary = computeBatchGpaSummary(entries);
  const gpaText = buildOverlayGpaText(summary);
  const gpaHtml = buildOverlayGpaHtml(summary);
  const csvContent = buildBatchCsvContent(entries, summary);
  if (overlayDownloadUrl) {
    URL.revokeObjectURL(overlayDownloadUrl);
    overlayDownloadUrl = null;
  }
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  overlayDownloadUrl = URL.createObjectURL(blob);
  const filename = `managebac_tasks_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  return {
    taskCount: summary.totalTaskCount,
    gpaText,
    gpaHtml,
    totalGpaValue: summary.totalGpa,
    totalGpa425Value: summary.totalGpa425,
    downloadUrl: overlayDownloadUrl,
    downloadName: filename,
  };
};

const isBatchProcessing = (state = getBatchState()) =>
  Boolean(state && state.processing);

const startBatchLoop = () => {
  if (batchLoopTimer) {
    return;
  }
  batchLoopTimer = setInterval(() => {
    maybeRunBatchAutomation();
  }, BATCH_LOOP_INTERVAL_MS);
};

const stopBatchLoop = () => {
  if (!batchLoopTimer) {
    return;
  }
  clearInterval(batchLoopTimer);
  batchLoopTimer = null;
};

const isOverlayMutationOnly = (mutations = []) => {
  const root = document.getElementById(OVERLAY_ROOT_ID);
  if (!root || !mutations.length) {
    return false;
  }
  return mutations.every((mutation) => {
    const targetInside = root.contains(mutation.target);
    const addedInside = Array.from(mutation.addedNodes || []).every(
      (node) => node === root || root.contains(node)
    );
    const removedInside = Array.from(mutation.removedNodes || []).every(
      (node) => node === root || root.contains(node)
    );
    return targetInside && addedInside && removedInside;
  });
};

const getNodeText = (node) => {
  if (!node) return null;
  const text = (node.textContent || "").trim();
  if (text) return text;
  if (node.dataset) {
    for (const value of Object.values(node.dataset)) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }
  for (const attr of TEXT_ATTRS) {
    if (typeof node.getAttribute === "function") {
      const value = node.getAttribute(attr);
      if (value && value.trim()) {
        return value.trim();
      }
    }
  }
  return null;
};

const getPseudoContent = (node, pseudo = "::after") => {
  if (!node) return null;
  try {
    const style = window.getComputedStyle(node, pseudo);
    if (!style) return null;
    const content = style.getPropertyValue("content");
    if (!content || content === "none") {
      return null;
    }
    return content.replace(/^"(.*)"$/, "$1").trim();
  } catch (err) {
    return null;
  }
};

const pickFirstText = (root, selectors) => {
  for (const selector of selectors) {
    const node = root.querySelector(selector);
    const text = getNodeText(node) || getPseudoContent(node);
    if (text) return text;
  }
  return null;
};

const normalizeStatusText = (value) => {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;
  if (/not[-_\s]?assessed/i.test(text) || text.includes("未评估")) {
    return "未评估";
  }
  if (/pending/i.test(text) || text.includes("待评估")) {
    return "待评估";
  }
  return text;
};

const detectStatusIcon = (card) => {
  for (const selector of STATUS_ICON_SELECTORS) {
    const node = card.querySelector(selector);
    if (!node) continue;
    const label =
      getNodeText(node) ||
      node.getAttribute?.("aria-label") ||
      node.getAttribute?.("title") ||
      node.dataset?.status ||
      node.dataset?.label;
    const normalized = normalizeStatusText(label);
    if (normalized) {
      return normalized;
    }
    const classList = node.classList ? Array.from(node.classList) : [];
    if (classList.some((cls) => /not[-_\s]?assessed/i.test(cls))) {
      return "未评估";
    }
    if (classList.some((cls) => /pending/i.test(cls))) {
      return "待评估";
    }
  }
  return null;
};

const isClassHref = (href = "") => {
  if (!href.includes(CLASS_PATH_FRAGMENT)) {
    return false;
  }
  return !CLASS_EXCLUDE_PATHS.some((exclude) => href.includes(exclude));
};

const appendCoreTasksPath = (href = "") => {
  if (!href) return href;
  let normalized = href.trim();
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.endsWith("/core_tasks")) {
    return normalized;
  }
  return `${normalized}/core_tasks`;
};

const extractLinks = () => {
  return Array.from(document.querySelectorAll(MENU_SELECTOR))
    .map((link) => ({
      text: (link.textContent || "").trim() || "(无标题)",
      href: link.href || link.getAttribute("href") || "",
    }))
    .filter(
      (item) =>
        typeof item.href === "string" &&
        isClassHref(item.href) &&
        !item.text.includes("全部")
    )
    .map((item) => ({
      ...item,
      href: appendCoreTasksPath(item.href),
    }));
};

const buildPayload = (reason = "observer") => {
  const links = extractLinks();
  return {
    type: "MB_MENU_UPDATE",
    links,
    reason,
    timestamp: Date.now(),
    sourceUrl: location.href,
    error: links.length
      ? null
      : "未找到菜单链接，可能尚未登录或页面尚未完成加载。",
  };
};

const scheduleUpdate = (reason = "observer") => {
  if (debouncedTimer) {
    clearTimeout(debouncedTimer);
  }
  debouncedTimer = setTimeout(() => {
    debouncedTimer = null;
    const payload = buildPayload(reason);
    const signature = JSON.stringify(payload.links);
    if (signature === lastSignature && !payload.error) {
      return;
    }
    lastSignature = signature;
    safeSendMessage(payload);
  }, UPDATE_DEBOUNCE_MS);
};

const observer = new MutationObserver((mutations) => {
  if (isOverlayMutationOnly(mutations)) {
    return;
  }
  if (isBatchProcessing()) {
    return;
  }
  scheduleUpdate("mutation");
  scheduleTaskSummary("mutation");
});

const init = () => {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  scheduleUpdate("init");
  scheduleTaskSummary("init");
  maybeRunPendingAutomation();
  maybeRunBatchAutomation();
  if (isBatchProcessing()) {
    startBatchLoop();
  }
  setupHistoryListeners();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "MB_MENU_SCRAPE") {
    const payload = buildPayload("manual");
    safeSendMessage(payload); // 确保后台缓存最新数据
    sendResponse({
      ok: true,
      links: payload.links,
      timestamp: payload.timestamp,
      sourceUrl: payload.sourceUrl,
      error: payload.error,
    });
    return true;
  }
  if (message?.type === "MB_TRIGGER_CLASS_TASKS") {
    const result = triggerAutomation();
    sendResponse(result);
    return true;
  }
  if (message?.type === "MB_TRIGGER_BATCH") {
    const result = triggerBatchAutomation();
    sendResponse(result);
    return true;
  }
  return false;
});

function getClassAnchors() {
  return Array.from(document.querySelectorAll(MENU_SELECTOR)).filter((link) => {
    const href = link.href || link.getAttribute("href") || "";
    const text = (link.textContent || "").trim();
    return isClassHref(href) && !text.includes("全部");
  });
}

function triggerAutomation() {
  const classAnchors = getClassAnchors();
  const first = classAnchors[0];
  if (!first) {
    return { ok: false, error: "未找到班级链接，请确认已展开菜单。" };
  }

  const targetUrl = appendCoreTasksPath(
    first.href || first.getAttribute("href") || ""
  );

  const payload = {
    action: "openTasks",
    targetHref: targetUrl || null,
    startedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(AUTOMATION_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("无法写入自动化标记：", err);
  }

  if (targetUrl) {
    window.location.assign(targetUrl);
  } else {
    first.click();
  }
  setTimeout(() => {
    maybeRunPendingAutomation();
  }, 800);
  return { ok: true, message: "已打开第一个班级，稍后将尝试进入任务。", step: "class" };
}

function triggerBatchAutomation() {
  const existingState = getBatchState();
  if (existingState) {
    return {
      ok: false,
      error: "批量任务正在进行，请等待完成。",
    };
  }
  const classes = extractLinks();
  if (!classes.length) {
    return { ok: false, error: "未找到班级链接，无法开始批量抓取。" };
  }
  const queue = classes.map((item) => ({
    title: item.text,
    href: appendCoreTasksPath(item.href),
  }));
  const state = {
    queue,
    currentIndex: 0,
    processing: true,
    startedAt: Date.now(),
    results: [],
  };
  setBatchState(state);
  startBatchLoop();
  safeSendMessage({
    type: "MB_BATCH_CLEAR",
    total: queue.length,
    startedAt: state.startedAt,
  });
  showBatchCaptureRunning({
    total: queue.length,
    processed: 0,
    currentClass: queue[0]?.title || "",
  });
  navigateToTarget(queue[0].href);
  return {
    ok: true,
    message: `已开始批量抓取 ${queue.length} 个班级，请保持页面打开。`,
  };
}

function maybeRunPendingAutomation() {
  let payload = null;
  try {
    payload = JSON.parse(sessionStorage.getItem(AUTOMATION_KEY));
  } catch (err) {
    sessionStorage.removeItem(AUTOMATION_KEY);
    return;
  }

  if (!payload || payload.action !== "openTasks") {
    return;
  }

  const clearFlag = () => sessionStorage.removeItem(AUTOMATION_KEY);

  const tryComplete = () => {
    if (isOnCoreTasksPage()) {
      const summary = buildTaskSummary();
      if (summary.ready) {
        notifyTaskSummary("automation");
        clearFlag();
        safeSendMessage({
          type: "MB_AUTOMATION_RESULT",
          status: "tasks-opened",
          count: summary.count,
          timestamp: Date.now(),
          sourceUrl: location.href,
        });
        return true;
      }
    } else {
      const target = findTaskLink();
      if (target) {
        target.click();
        return false;
      }
    }
    return false;
  };

  const start = Date.now();
  const loop = () => {
    if (tryComplete()) {
      return;
    }
    if (Date.now() - start > 15000) {
      clearFlag();
      safeSendMessage({
        type: "MB_AUTOMATION_RESULT",
        status: "timeout",
        timestamp: Date.now(),
        sourceUrl: location.href,
      });
      return;
    }
    requestAnimationFrame(loop);
  };
  loop();
}

function maybeRunBatchAutomation() {
  const state = getBatchState();
  if (!state || !state.processing) {
    stopBatchLoop();
    hideBatchCaptureOverlay();
    return;
  }
  const current = state.queue?.[state.currentIndex];
  const total = state.queue?.length || 0;
  const processed = Number.isInteger(state.currentIndex) ? state.currentIndex : 0;
  showBatchCaptureRunning({
    total,
    processed,
    currentClass: current?.title || "",
  });

  if (!current) {
    const existingResults = Array.isArray(state.results) ? state.results : [];
    const donePayload =
      existingResults.length > 0 ? buildOverlayDonePayload(existingResults) : null;
    clearBatchState();
    stopBatchLoop();
    safeSendMessage({
      type: "MB_BATCH_DONE",
      total: total || processed,
      reason: "empty",
    });
    showBatchCaptureDone({
      total,
      processed,
      ...(donePayload || {}),
    });
    return;
  }

  if (!isOnTargetClass(current.href)) {
    return;
  }

  const summary = buildTaskSummary();
  if (!summary.ready) {
    return;
  }

  const currentEntry = {
    classTitle: current.title,
    classHref: current.href,
    summary,
    timestamp: Date.now(),
  };
  const currentResults = Array.isArray(state.results)
    ? [...state.results, currentEntry]
    : [currentEntry];

  safeSendMessage({
    type: "MB_BATCH_RESULT",
    classTitle: currentEntry.classTitle,
    classHref: currentEntry.classHref,
    summary: currentEntry.summary,
  });

  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.queue.length) {
    const donePayload = buildOverlayDonePayload(currentResults);
    clearBatchState();
    stopBatchLoop();
    safeSendMessage({
      type: "MB_BATCH_DONE",
      total: state.queue.length,
      reason: "completed",
    });
    showBatchCaptureDone({
      total: state.queue.length,
      processed: state.queue.length,
      ...donePayload,
    });
    return;
  }

  const nextState = {
    ...state,
    currentIndex: nextIndex,
    processing: true,
    results: currentResults,
  };
  setBatchState(nextState);
  showBatchCaptureRunning({
    total: state.queue.length,
    processed: nextIndex,
    currentClass: state.queue[nextIndex].title || "",
  });
  navigateToTarget(state.queue[nextIndex].href);
}

function findTaskLink() {
  const selectors = [
    "a.dropdown-item",
    "button.dropdown-item",
    "a[data-testid]",
  ];
  for (const selector of selectors) {
    const candidates = document.querySelectorAll(selector);
    for (const node of candidates) {
      const text = (node.textContent || "").trim();
      if (
        text &&
        TASK_KEYWORDS.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()))
      ) {
        return node;
      }
    }
  }
  return null;
}

function handleHistoryChange() {
  if (isBatchProcessing()) {
    maybeRunPendingAutomation();
    maybeRunBatchAutomation();
    return;
  }
  scheduleUpdate("history");
  scheduleTaskSummary("history");
  maybeRunPendingAutomation();
  maybeRunBatchAutomation();
}

function setupHistoryListeners() {
  if (setupHistoryListeners.initialized) {
    return;
  }
  setupHistoryListeners.initialized = true;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;

  history.pushState = function (...args) {
    const result = originalPush.apply(this, args);
    handleHistoryChange();
    return result;
  };

  history.replaceState = function (...args) {
    const result = originalReplace.apply(this, args);
    handleHistoryChange();
    return result;
  };

  window.addEventListener("popstate", handleHistoryChange);
}

function isOnTargetClass(targetHref) {
  if (!targetHref) return false;
  try {
    const target = new URL(targetHref);
    const current = new URL(location.href);
    return current.pathname.startsWith(target.pathname.replace(/\/$/, ""));
  } catch (err) {
    return location.href.includes(targetHref);
  }
}

function navigateToTarget(href) {
  if (!href) return;
  try {
    window.location.assign(href);
  } catch (err) {
    console.warn("无法导航到目标班级：", href, err);
  }
}

function getBatchState() {
  try {
    const raw = sessionStorage.getItem(BATCH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    sessionStorage.removeItem(BATCH_KEY);
    return null;
  }
}

function setBatchState(state) {
  try {
    sessionStorage.setItem(BATCH_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("无法写入批量状态：", err);
  }
}

function clearBatchState() {
  sessionStorage.removeItem(BATCH_KEY);
}

function isOnCoreTasksPage() {
  return location.pathname.includes("/core_tasks");
}

function collectTaskCards() {
  return Array.from(document.querySelectorAll(TASK_CARD_SELECTOR));
}

function buildTaskSummary() {
  if (!isOnCoreTasksPage()) {
    return { ready: false, count: 0, tasks: [] };
  }
  const cards = collectTaskCards();
  return {
    ready: true,
    count: cards.length,
    tasks: cards.slice(0, 20).map(extractTaskDetails),
  };
}

function extractTaskDetails(card, index) {
  const title =
    pickFirstText(card, TASK_TITLE_SELECTORS) ||
    card.textContent.trim() ||
    `任务 ${index + 1}`;
  const due = pickFirstText(card, TASK_DUE_SELECTORS);
  const month = pickFirstText(card, TASK_MONTH_SELECTORS);
  const day = pickFirstText(card, TASK_DAY_SELECTORS);
  const dueBadge = [month, day].filter(Boolean).join(" ");
  const grade = pickFirstText(card, [
    ".label.label-score",
    ".label-score",
    ".cell.criterion-grade",
    ".criterion-grade",
  ]);
  const points = pickFirstText(card, [".label.label-points", ".label-points"]);
  let status =
    pickFirstText(card, [".status", "svg.status"]) ||
    getPseudoContent(card.querySelector(".status"), "::after") ||
    detectStatusIcon(card);
  const anchor =
    card.querySelector("a[href*='/student/tasks/']") ||
    card.querySelector("a[href]");
  const href = anchor ? anchor.href || anchor.getAttribute("href") : null;
  const submission = extractSubmissionBadges(card);
  return {
    title,
    due,
    month: month || null,
    day: day || null,
    dueBadge: dueBadge || null,
    grade: grade || null,
    points: points || null,
    status: status || null,
    href,
    criteria: extractCriteriaScores(card),
    submission,
  };
}

function extractSubmissionBadges(card) {
  const badges = Array.from(
    card.querySelectorAll(
      ".badge.color-box-gray, .badge.color-box-green, .badge.color-box-orange, .badge.color-box-red, .color-box-gray, .color-box-green, .color-box-orange, .color-box-red"
    )
  )
    .map((badge) => {
      const text = getNodeText(badge);
      if (!text) {
        return null;
      }
      const colorClass =
        Array.from(badge.classList).find((cls) => cls.startsWith("color-box-")) ||
        null;
      return {
        text,
        colorClass,
        isOverdue: colorClass?.includes("orange") || text.includes("逾期"),
        isSubmitted:
          colorClass?.includes("green") ||
          /已交|submitted|complete/i.test(text),
      };
    })
    .filter(Boolean);
  if (!badges.length) {
    return null;
  }
  return badges;
}

function extractCriteriaScores(card) {
  const criteria = [];
  const sets = card.querySelectorAll(".labels-set, .criterion-scores");
  sets.forEach((set) => {
    const values = Array.from(
      set.querySelectorAll(".label, .cell, .criterion-grade, .label-score")
    )
      .map((el) => getNodeText(el))
      .filter(Boolean)
      .filter((value) => !/^(summative|formative)$/i.test(String(value).trim()));
    if (!values.length) {
      return;
    }
    criteria.push({
      label: resolveCriterionLabel(set),
      values,
    });
  });
  return criteria;
}

function resolveCriterionLabel(set) {
  const selectors = LABEL_NAME_SELECTORS.join(", ");

  // 1) direct attribute hints
  const attrLabel =
    set.getAttribute?.("data-label") ||
    (set.dataset && set.dataset.label) ||
    null;
  if (attrLabel && attrLabel.trim()) {
    return attrLabel.trim().replace(/[:：]\s*$/, "");
  }

  // 2) previous siblings (including text nodes)
  let sibling = set.previousSibling;
  let hops = 0;
  while (sibling && hops < 4) {
    let text = "";
    if (sibling.nodeType === Node.TEXT_NODE) {
      text = sibling.textContent.trim();
    } else if (sibling.nodeType === Node.ELEMENT_NODE) {
      text = getNodeText(sibling);
    }
    if (text) {
      return text.replace(/[:：]\s*$/, "");
    }
    sibling = sibling.previousSibling;
    hops += 1;
  }

  // 3) closest ancestor containing label selector
  let ancestor = set;
  for (let depth = 0; depth < 4 && ancestor; depth += 1) {
    const labelEl = ancestor.querySelector?.(selectors);
    if (labelEl) {
      const text = getNodeText(labelEl);
      if (text) {
        return text.replace(/[:：]\s*$/, "");
      }
    }
    ancestor = ancestor.parentElement;
  }

  // 4) parent-level preceding text
  if (set.parentElement) {
    let prev = set.parentElement.previousSibling;
    let tries = 0;
    while (prev && tries < 3) {
      let text = "";
      if (prev.nodeType === Node.TEXT_NODE) {
        text = prev.textContent.trim();
      } else if (prev.nodeType === Node.ELEMENT_NODE) {
        text = getNodeText(prev);
      }
      if (text) {
        return text.replace(/[:：]\s*$/, "");
      }
      prev = prev.previousSibling;
      tries += 1;
    }
  }

  return null;
}

function sendTaskSummary(reason = "observer") {
  if (!isOnCoreTasksPage()) {
    lastTaskSignature = null;
    return;
  }
  const summary = buildTaskSummary();
  const signature = JSON.stringify({
    count: summary.count,
    first: summary.tasks[0]?.title || "",
    grade: summary.tasks[0]?.grade || summary.tasks[0]?.points || "",
    criteria:
      summary.tasks[0]?.criteria
        ?.map((c) => `${c.label || ""}:${(c.values || []).join("/")}`)
        .join("|") || "",
    submission:
      summary.tasks[0]?.submission
        ?.map((badge) => `${badge.text}:${badge.colorClass || ""}`)
        .join("|") || "",
  });
  if (signature === lastTaskSignature) {
    return;
  }
  lastTaskSignature = signature;
  safeSendMessage({
    type: "MB_TASK_SUMMARY",
    summary,
    reason,
    timestamp: Date.now(),
    sourceUrl: location.href,
  });
}

function scheduleTaskSummary(reason = "observer") {
  if (!isOnCoreTasksPage()) {
    return;
  }
  if (taskSummaryTimer) {
    clearTimeout(taskSummaryTimer);
  }
  taskSummaryTimer = setTimeout(() => {
    taskSummaryTimer = null;
    sendTaskSummary(reason);
  }, TASK_SUMMARY_DEBOUNCE_MS);
}

function notifyTaskSummary(reason = "manual") {
  sendTaskSummary(reason);
}
