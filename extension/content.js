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

let debouncedTimer = null;
let lastSignature = null;
let taskSummaryTimer = null;
let lastTaskSignature = null;

const safeSendMessage = (message) => {
  try {
    chrome.runtime.sendMessage(message, () => void 0);
  } catch (err) {
    console.warn("无法向后台发送消息：", err);
  }
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

const observer = new MutationObserver(() => {
  scheduleUpdate("mutation");
  scheduleTaskSummary("mutation");
  maybeRunBatchAutomation();
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
  };
  setBatchState(state);
  safeSendMessage({
    type: "MB_BATCH_CLEAR",
    total: queue.length,
    startedAt: state.startedAt,
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
    return;
  }
  const current = state.queue?.[state.currentIndex];
  if (!current) {
    clearBatchState();
    safeSendMessage({
      type: "MB_BATCH_DONE",
      total: state.queue?.length || 0,
      reason: "empty",
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

  safeSendMessage({
    type: "MB_BATCH_RESULT",
    classTitle: current.title,
    classHref: current.href,
    summary,
  });

  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.queue.length) {
    clearBatchState();
    safeSendMessage({
      type: "MB_BATCH_DONE",
      total: state.queue.length,
      reason: "completed",
    });
    return;
  }

  const nextState = {
    ...state,
    currentIndex: nextIndex,
    processing: true,
  };
  setBatchState(nextState);
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
      .filter(Boolean);
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

