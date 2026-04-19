const runBtn = document.getElementById("run-btn");
const runStatus = document.getElementById("run-status");
const roundingSelect = document.getElementById("rounding-select");
const BATCH_CACHE_KEY = "mbTaskBatch";
const GPA_OPTIONS_KEY = "mbGpaOptions";

const getActiveManageBacTab = () =>
  new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        resolve(null);
        return;
      }
      try {
        const url = new URL(tab.url);
        if (url.hostname.endsWith("managebac.cn")) {
          resolve(tab);
          return;
        }
      } catch (err) {
        // ignore
      }
      resolve(null);
    });
  });

const requestRuntime = (payload) =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });

const loadGpaOptions = () =>
  new Promise((resolve) => {
    chrome.storage.local.get([GPA_OPTIONS_KEY], (result) => {
      resolve(result[GPA_OPTIONS_KEY] || { roundingMode: "round" });
    });
  });

const saveGpaOptions = (options) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [GPA_OPTIONS_KEY]: options }, resolve);
  });

const ensureClassLinks = async (tabId) => {
  runStatus.textContent = "正在自动刷新班级列表...";
  const cacheResp = await requestRuntime({ type: "MB_MENU_GET" });
  const cachedCount = cacheResp?.data?.links?.length || 0;
  const scrapeResp = await requestRuntime({ type: "MB_MENU_REQUEST_SCRAPE", tabId });
  const scrapedCount = scrapeResp?.links?.length || 0;
  if (scrapeResp?.ok && scrapedCount > 0) {
    return scrapedCount;
  }
  if (cachedCount > 0) {
    runStatus.textContent = "实时刷新失败，已回退到缓存班级列表。";
    return cachedCount;
  }
  if (!scrapeResp?.ok) {
    throw new Error(scrapeResp?.error || "自动刷新班级失败");
  }
  throw new Error("未获取到班级，请确认左侧菜单已加载并已登录。");
};

const startAutoBatch = async () => {
  runBtn.disabled = true;
  try {
    await saveGpaOptions({
      roundingMode: roundingSelect?.value === "raw" ? "raw" : "round",
    });
    runStatus.textContent = "正在检查当前标签页...";
    const tab = await getActiveManageBacTab();
    if (!tab?.id) {
      throw new Error("请先打开 ManageBac 页面，再点击一键抓取。");
    }
    const classCount = await ensureClassLinks(tab.id);
    runStatus.textContent = `已获取 ${classCount} 个班级，正在自动开始抓取分数...`;
    const batchResp = await requestRuntime({ type: "MB_TRIGGER_BATCH", tabId: tab.id });
    if (!batchResp?.ok) {
      throw new Error(batchResp?.error || "启动批量抓取失败");
    }
    runStatus.textContent = "已启动批量抓取，网页遮罩会显示进度和下载入口。";
  } catch (err) {
    runStatus.textContent = `❌ ${err.message || "执行失败，请重试。"}`;
    runBtn.disabled = false;
  }
};

runBtn.addEventListener("click", startAutoBatch);

roundingSelect?.addEventListener("change", async () => {
  await saveGpaOptions({
    roundingMode: roundingSelect.value === "raw" ? "raw" : "round",
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[BATCH_CACHE_KEY]) {
    return;
  }
  const data = changes[BATCH_CACHE_KEY].newValue;
  if (!data) return;
  const processed = data.processed || data.entries?.length || 0;
  const total = data.total || processed;
  if (data.status === "completed" || data.completed) {
    runStatus.textContent = `✅ 抓取完成：${processed}/${total}。请在网页遮罩中查看 GPA 并下载 CSV。`;
    runBtn.disabled = false;
    return;
  }
  runStatus.textContent = `⏳ 抓取中：${processed}/${total}...`;
});

(async () => {
  const options = await loadGpaOptions();
  if (roundingSelect) {
    roundingSelect.value = options.roundingMode === "raw" ? "raw" : "round";
  }
})();
