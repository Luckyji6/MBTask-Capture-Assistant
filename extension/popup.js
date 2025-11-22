const refreshBtn = document.getElementById("refresh-btn");
const batchBtn = document.getElementById("batch-btn");
const exportBtn = document.getElementById("export-btn");
const refreshStatus = document.getElementById("refresh-status");
const batchStatus = document.getElementById("batch-status");
const exportStatus = document.getElementById("export-status");

const CACHE_KEY = "mbMenuCache";
const BATCH_CACHE_KEY = "mbTaskBatch";

const CRITERIA_COLUMNS = [
  { header: "A", matches: (label) => /^A\b/i.test(label) },
  { header: "B", matches: (label) => /^B\b/i.test(label) },
  { header: "C", matches: (label) => /^C\b/i.test(label) },
  { header: "D", matches: (label) => /^D\b/i.test(label) },
  { header: "学校成绩", matches: (label) => /(学校|school)/i.test(label) },
];

let latestBatchData = null;
let step1Completed = false; // 步骤1是否完成

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

const requestScrape = (tabId) =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "MB_MENU_REQUEST_SCRAPE", tabId },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(response);
      }
    );
  });

const requestBatchAutomation = (tabId) =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "MB_TRIGGER_BATCH", tabId },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(response);
      }
    );
  });

const loadBatchResults = () =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "MB_BATCH_GET" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(response?.data || null);
    });
  });

refreshBtn.addEventListener("click", async () => {
  refreshStatus.textContent = "正在获取班级列表...";
  refreshBtn.disabled = true;
  const tab = await getActiveManageBacTab();
  if (!tab) {
    refreshStatus.textContent = "❌ 请先在 ManageBac 页面打开扩展。";
    refreshBtn.disabled = false;
    return;
  }

  try {
    const response = await requestScrape(tab.id);
    if (!response?.ok) {
      const errorMsg = response?.error || "抓取失败";
      // 检查是否是连接错误
      if (errorMsg.includes("Could not establish connection") || errorMsg.includes("Receiving end does not exist")) {
        refreshStatus.textContent = "❌ 连接失败，请刷新 ManageBac 页面后重试。";
      } else {
        refreshStatus.textContent = `❌ ${errorMsg}`;
      }
      step1Completed = false;
    } else {
      const count = response.links?.length || 0;
      if (count > 0) {
        refreshStatus.textContent = `✅ 已获取 ${count} 个班级，现在可以进行步骤 2。`;
        step1Completed = true;
        batchBtn.disabled = false;
      } else {
        refreshStatus.textContent = "❌ 未获取到班级，请确保已登录。";
        step1Completed = false;
      }
    }
  } catch (err) {
    const errorMsg = err.message || "";
    // 检查是否是连接错误
    if (errorMsg.includes("Could not establish connection") || errorMsg.includes("Receiving end does not exist")) {
      refreshStatus.textContent = "❌ 连接失败，请刷新 ManageBac 页面后重试。";
    } else {
      refreshStatus.textContent = `❌ 请求失败：${errorMsg}`;
    }
    step1Completed = false;
  } finally {
    refreshBtn.disabled = false;
  }
});

batchBtn.addEventListener("click", async () => {
  if (!step1Completed) {
    batchStatus.textContent = "❌ 请先完成步骤 1：刷新班级列表。";
    return;
  }
  
  batchBtn.disabled = true;
  exportBtn.disabled = true;
  
  // 先显示提示信息，让用户看几秒
  batchStatus.textContent = "💡 提示：批量抓取过程中，页面会自动跳转。如果页面停止刷新，请打开扩展查看进度！";
  batchStatus.style.color = "#f59e0b";
  batchStatus.style.fontWeight = "600";
  
  // 等待3秒让用户看到提示
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const tab = await getActiveManageBacTab();
  if (!tab) {
    batchStatus.textContent = "❌ 请在 ManageBac 标签页中使用。";
    batchStatus.style.color = "";
    batchStatus.style.fontWeight = "";
    batchBtn.disabled = false;
    return;
  }
  
  try {
    batchStatus.textContent = "正在启动批量抓取...";
    const response = await requestBatchAutomation(tab.id);
    if (!response?.ok) {
      batchStatus.textContent = `❌ ${response?.error || "启动失败"}`;
      batchStatus.style.color = "";
      batchStatus.style.fontWeight = "";
      batchBtn.disabled = false;
    } else {
      batchStatus.textContent = "⏳ 正在批量抓取中，页面会自动跳转...";
      batchStatus.style.color = "";
      batchStatus.style.fontWeight = "";
    }
  } catch (err) {
    batchStatus.textContent = `❌ 请求失败：${err.message}`;
    batchStatus.style.color = "";
    batchStatus.style.fontWeight = "";
    batchBtn.disabled = false;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[BATCH_CACHE_KEY]) {
    const data = changes[BATCH_CACHE_KEY].newValue;
    latestBatchData = data;
    if (data) {
      const processed = data.processed || data.entries?.length || 0;
      const total = data.total || processed;
      if (data.status === "completed" || data.completed) {
        batchStatus.textContent = `✅ 抓取完成！已处理 ${processed} 个班级，现在可以进行步骤 3。`;
        batchStatus.style.color = "#0a7d1e";
        batchStatus.style.fontWeight = "600";
        batchStatus.style.fontSize = "0.95rem";
        exportBtn.disabled = false;
        batchBtn.disabled = false;
        
        // 让整个步骤3的区域高亮提示
        const step3 = exportBtn.closest('.step');
        if (step3) {
          step3.style.borderColor = "#0a7d1e";
          step3.style.borderWidth = "2px";
          step3.style.backgroundColor = "#f0fdf4";
        }
      } else {
        batchStatus.textContent = `⏳ 正在抓取... ${processed}/${total} 个班级`;
        batchStatus.style.color = "";
        batchStatus.style.fontWeight = "";
        batchStatus.style.fontSize = "";
      }
    }
  }
});

const csvEscape = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value).replace(/\r?\n/g, " ").trim();
  if (text.includes(",") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const buildBatchCsv = (data) => {
  if (!data?.entries?.length) {
    return null;
  }
  const rows = [
    [
      "班级",
      "班级链接",
      "任务序号",
      "任务名称",
      "截止日期",
      "状态",
      ...CRITERIA_COLUMNS.map((col) => col.header),
      "提交情况",
      "其他评估细则",
      "任务链接",
    ]
      .map(csvEscape)
      .join(","),
  ];

  data.entries.forEach((entry) => {
    const tasks = entry.summary?.tasks || [];
    if (!tasks.length) {
      rows.push(
        [
          entry.classTitle,
          entry.classHref,
          "",
          "",
          "",
          "",
          ...CRITERIA_COLUMNS.map(() => ""),
          "",
          "",
          "",
        ]
          .map(csvEscape)
          .join(",")
      );
      return;
    }
    tasks.forEach((task, index) => {
      const submissionText = formatSubmissionText(task.submission);
      const criteriaColumns = CRITERIA_COLUMNS.map((col) =>
        getCriterionColumnValue(task.criteria, col)
      );
      const criteriaText = formatRemainingCriteria(task.criteria);
      rows.push(
        [
          entry.classTitle,
          entry.classHref,
          index + 1,
          task.title,
          task.due,
          task.status,
          ...criteriaColumns,
          submissionText,
          criteriaText,
          task.href,
        ]
          .map(csvEscape)
          .join(",")
      );
    });
  });
  return rows.join("\n");
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

const formatRemainingCriteria = (criteria) => {
  const list = Array.isArray(criteria)
    ? criteria.filter((entry) => {
        const label = (entry.label || "").trim();
        return !CRITERIA_COLUMNS.some((col) => col.matches(label));
      })
    : [];
  if (!list.length) {
    return "";
  }
  return list
    .map((c) => {
      const label = c.label || "标准";
      const values = (c.values || []).join("/");
      return values ? `${label}: ${values}` : `${label}: -`;
    })
    .join(" | ");
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

const ensureBatchData = async () => {
  if (latestBatchData && latestBatchData.entries) {
    return latestBatchData;
  }
  return loadBatchResults();
};

exportBtn.addEventListener("click", async () => {
  exportStatus.textContent = "正在准备 CSV...";
  const data = await ensureBatchData();
  if (!data || !data.entries || !data.entries.length) {
    exportStatus.textContent = "❌ 暂无数据可导出，请先完成步骤 2。";
    return;
  }
  const csv = buildBatchCsv(data);
  if (!csv) {
    exportStatus.textContent = "❌ 生成 CSV 失败。";
    return;
  }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `managebac_tasks_${timestamp}.csv`;

  if (chrome.downloads && chrome.downloads.download) {
    chrome.downloads.download(
      {
        url,
        filename,
        saveAs: true,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          if (triggerAnchorDownload(url, filename)) {
            exportStatus.textContent = "✅ 已触发下载，请查看浏览器下载栏。";
          } else {
            openCsvInNewTab(csv);
            exportStatus.textContent = "✅ 已在新标签页打开，请手动保存。";
          }
        } else {
          exportStatus.textContent = "✅ 正在保存，请在下载面板确认。";
        }
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    );
  } else {
    if (triggerAnchorDownload(url, filename)) {
      exportStatus.textContent = "✅ 已触发下载。";
    } else {
      openCsvInNewTab(csv);
      exportStatus.textContent = "✅ 已在新标签页打开。";
    }
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
});

const triggerAnchorDownload = (url, filename) => {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (err) {
    return false;
  }
};

const openCsvInNewTab = (csv) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

(async () => {
  const data = await ensureBatchData();
  if (data && (data.status === "completed" || data.completed)) {
    exportBtn.disabled = false;
    const processed = data.processed || data.entries?.length || 0;
    batchStatus.textContent = `✅ 抓取完成！已处理 ${processed} 个班级，现在可以进行步骤 3。`;
    batchStatus.style.color = "#0a7d1e";
    batchStatus.style.fontWeight = "600";
    batchStatus.style.fontSize = "0.95rem";
    
    // 让整个步骤3的区域高亮提示
    const step3 = exportBtn.closest('.step');
    if (step3) {
      step3.style.borderColor = "#0a7d1e";
      step3.style.borderWidth = "2px";
      step3.style.backgroundColor = "#f0fdf4";
    }
  }
  
  // 检查是否有缓存的班级数据
  chrome.runtime.sendMessage({ type: "MB_MENU_GET" }, (response) => {
    if (response?.data?.links?.length > 0) {
      step1Completed = true;
      batchBtn.disabled = false;
      refreshStatus.textContent = `✅ 已有 ${response.data.links.length} 个班级缓存，可直接进行步骤 2。`;
    }
  });
})();
