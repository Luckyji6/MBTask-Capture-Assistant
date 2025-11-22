const CACHE_KEY = "mbMenuCache";
const TASK_CACHE_KEY = "mbTaskSummary";
const BATCH_CACHE_KEY = "mbTaskBatch";

const setCache = (data) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [CACHE_KEY]: data }, resolve);
  });

const getCache = () =>
  new Promise((resolve) => {
    chrome.storage.local.get([CACHE_KEY], (result) => {
      resolve(result[CACHE_KEY] || null);
    });
  });

const setTaskSummary = (data) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [TASK_CACHE_KEY]: data }, resolve);
  });

const getTaskSummary = () =>
  new Promise((resolve) => {
    chrome.storage.local.get([TASK_CACHE_KEY], (result) => {
      resolve(result[TASK_CACHE_KEY] || null);
    });
  });

const setBatchCache = (data) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [BATCH_CACHE_KEY]: data }, resolve);
  });

const getBatchCache = () =>
  new Promise((resolve) => {
    chrome.storage.local.get([BATCH_CACHE_KEY], (result) => {
      resolve(result[BATCH_CACHE_KEY] || null);
    });
  });

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(CACHE_KEY);
  chrome.storage.local.remove(TASK_CACHE_KEY);
  chrome.storage.local.remove(BATCH_CACHE_KEY);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message?.type) {
    case "MB_MENU_UPDATE": {
      const payload = {
        links: message.links || [],
        timestamp: message.timestamp || Date.now(),
        reason: message.reason || "unknown",
        sourceUrl: message.sourceUrl || sender.tab?.url || null,
        error: message.error || null,
      };
      setCache(payload).then(() => sendResponse({ ok: true }));
      return true;
    }
    case "MB_MENU_GET": {
      getCache().then((data) => sendResponse({ ok: true, data }));
      return true;
    }
    case "MB_MENU_REQUEST_SCRAPE": {
      const targetTabId = message.tabId || sender.tab?.id;
      if (!targetTabId) {
        sendResponse({ ok: false, error: "缺少 tabId，无法请求内容脚本。" });
        return false;
      }
      chrome.tabs.sendMessage(
        targetTabId,
        { type: "MB_MENU_SCRAPE" },
        (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              ok: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          sendResponse(response || { ok: true });
        }
      );
      return true;
    }
    case "MB_TASK_SUMMARY": {
      const payload = {
        summary: message.summary || null,
        timestamp: message.timestamp || Date.now(),
        sourceUrl: message.sourceUrl || sender.tab?.url || null,
        reason: message.reason || "unknown",
      };
      setTaskSummary(payload).then(() => sendResponse({ ok: true }));
      return true;
    }
    case "MB_TASK_SUMMARY_GET": {
      getTaskSummary().then((data) => sendResponse({ ok: true, data }));
      return true;
    }
    case "MB_BATCH_CLEAR": {
      const payload = {
        entries: [],
        startedAt: message.startedAt || Date.now(),
        total: message.total || 0,
        processed: 0,
        status: "running",
        completed: false,
      };
      setBatchCache(payload).then(() => sendResponse({ ok: true }));
      return true;
    }
    case "MB_BATCH_RESULT": {
      getBatchCache().then((current) => {
        const entries = current?.entries ? [...current.entries] : [];
        entries.push({
          classTitle: message.classTitle,
          classHref: message.classHref,
          summary: message.summary,
          timestamp: message.timestamp || Date.now(),
        });
        const wasCompleted =
          current?.status === "completed" || current?.completed === true;
        const payload = {
          ...(current || {}),
          entries,
          processed: entries.length,
          total: current?.total || entries.length,
          status: wasCompleted ? "completed" : "running",
          completed: wasCompleted,
        };
        setBatchCache(payload).then(() => sendResponse({ ok: true }));
      });
      return true;
    }
    case "MB_BATCH_DONE": {
      getBatchCache().then((current) => {
        const payload = {
          ...(current || {}),
          status: "completed",
          completed: true,
          finishedAt: Date.now(),
        };
        setBatchCache(payload).then(() => sendResponse({ ok: true }));
      });
      return true;
    }
    case "MB_BATCH_GET": {
      getBatchCache().then((data) => sendResponse({ ok: true, data }));
      return true;
    }
    case "MB_TRIGGER_CLASS_TASKS": {
      const targetTabId = message.tabId || sender.tab?.id;
      if (!targetTabId) {
        sendResponse({ ok: false, error: "缺少 tabId，无法执行自动化。" });
        return false;
      }
      chrome.tabs.sendMessage(
        targetTabId,
        { type: "MB_TRIGGER_CLASS_TASKS" },
        (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              ok: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          sendResponse(response || { ok: true });
        }
      );
      return true;
    }
    case "MB_TRIGGER_BATCH": {
      const targetTabId = message.tabId || sender.tab?.id;
      if (!targetTabId) {
        sendResponse({ ok: false, error: "缺少 tabId，无法执行批量抓取。" });
        return false;
      }
      chrome.tabs.sendMessage(
        targetTabId,
        { type: "MB_TRIGGER_BATCH" },
        (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              ok: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          sendResponse(response || { ok: true });
        }
      );
      return true;
    }
    default:
      break;
  }
  return false;
});

