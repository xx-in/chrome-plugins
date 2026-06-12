// ================= 配置项 =================
// 改为 true 则读取本地开发环境，改为 false 则读取生产环境
const IS_DEV = false;

const BASE_URL = IS_DEV ? "http://localhost:5173" : "https://xshare.ccwu.cc";
const API_APPEND_URL = `${BASE_URL}/api/link/append`;
const API_CATEGORIES_URL = `${BASE_URL}/api/link/categories`;
// ==========================================

// 【性能优化 1】：在脚本加载的第一时间并发调用分类接口
const categoriesPromise = fetch(API_CATEGORIES_URL)
  .then((res) => res.json())
  .catch((err) => {
    console.error("Categories fetch failed", err);
    // 失败时的回退默认分类
    return [{ name: "办公" }, { name: "编程" }];
  });

// 【性能优化 2】：在脚本加载的第一时间并发读取本地配置，最大程度消除视觉闪烁
const defaultCategoryPromise = new Promise((resolve) => {
  chrome.storage.local.get(["defaultCategory"], (result) => {
    resolve(result.defaultCategory || "办公");
  });
});

function updateStatus(msg, color) {
  const s = document.getElementById("status");
  if (s) {
    s.innerText = msg;
    s.style.color = color;
  }
}

function setUIState(loading) {
  const btn = document.getElementById("saveBtn");
  const loader = document.getElementById("loading");
  if (btn) btn.disabled = loading;
  if (loader) loader.className = loading ? "" : "hidden";
}

// 保存多选分类的数组
let selectedCategories = [];

// 写入本地存储的默认分类配置
function setDefaultCategory(val) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ defaultCategory: val }, () => {
      resolve();
    });
  });
}

// 初始化数据
async function init() {
  // 1. 等待本地持久化配置，此时 Promise 极有可能已就绪，从而实现无感知加载
  let defaultCat = "办公";
  try {
    defaultCat = await defaultCategoryPromise;
  } catch (err) {
    console.error("Failed to read default category config", err);
  }

  // 初始化设置面板中的单选框状态
  const radios = document.querySelectorAll('input[name="defaultCategory"]');
  radios.forEach((radio) => {
    if (radio.value === defaultCat) {
      radio.checked = true;
    }
  });

  // 更新隐藏 input 值为读取到的默认分类
  const hiddenInput = document.getElementById("categoryValue");
  if (hiddenInput) {
    hiddenInput.value = defaultCat;
  }

  // 2. 获取当前页面信息
  const tabPromise = chrome.tabs
    .query({
      active: true,
      currentWindow: true,
    })
    .then(([tab]) => {
      if (tab) {
        document.getElementById("url").value = tab.url || "";
        document.getElementById("title").value = tab.title || "";
        document.getElementById("icon").value = tab.favIconUrl || "";

        // 让描述字段默认也拿到标题内容
        const descInput = document.getElementById("description");
        if (descInput) {
          descInput.value = tab.title || "";
        }
      }
    })
    .catch((err) => {
      console.error("Tab query failed", err);
    });

  // 3. 等待先前已经发出的分类数据并渲染
  try {
    const categories = await categoriesPromise;
    renderCustomSelect(categories);
  } catch (err) {
    console.error("Failed to render categories", err);
  }
}

// 渲染自定义多选下拉框逻辑
function renderCustomSelect(data) {
  const container = document.getElementById("categoryOptions");
  const trigger = document.getElementById("categoryTrigger");
  const triggerText = document.getElementById("categoryTriggerText");
  const hiddenInput = document.getElementById("categoryValue");
  const group = document.getElementById("categoryGroup");

  if (!container || !trigger || !triggerText || !hiddenInput || !group) return;

  container.innerHTML = "";

  // 初始化选中状态（从 HTML 的隐藏 input 读取默认值）
  const initialVal = hiddenInput.value || "办公";
  selectedCategories = initialVal
    ? initialVal
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // 更新 UI 文本及隐藏输入框的值
  function updateCategoryUI() {
    if (selectedCategories.length === 0) {
      triggerText.innerText = "选择分类";
      hiddenInput.value = "";
    } else {
      // 当选择的分类超过 2 个时，只显示前 2 个并加上“等 X 个”，避免撑破界面
      if (selectedCategories.length > 2) {
        triggerText.innerText = `${selectedCategories.slice(0, 2).join(", ")} 等${selectedCategories.length}个`;
      } else {
        triggerText.innerText = selectedCategories.join(", ");
      }

      // 传递给后端的数据依然是完整的、用逗号分隔的字符串
      hiddenInput.value = selectedCategories.join(",");
    }
  }

  // 渲染选项
  data.forEach((item) => {
    const div = document.createElement("div");
    div.className = "option";
    div.innerText = item.name;

    // 如果默认值里包含该分类，则高亮
    if (selectedCategories.includes(item.name)) {
      div.classList.add("selected");
    }

    div.onclick = (e) => {
      e.stopPropagation(); // 阻止冒泡，避免关闭下拉框，实现连续多选

      if (selectedCategories.includes(item.name)) {
        // 已选中则取消选择
        selectedCategories = selectedCategories.filter(
          (name) => name !== item.name,
        );
        div.classList.remove("selected");
      } else {
        // 未选中则添加
        selectedCategories.push(item.name);
        div.classList.add("selected");
      }

      updateCategoryUI();
    };
    container.appendChild(div);
  });

  // 首次渲染后同步一次 UI
  updateCategoryUI();

  // 点击触发器切换显示
  trigger.onclick = (e) => {
    e.stopPropagation();
    group.classList.toggle("open");
  };

  // 点击外部关闭
  document.addEventListener("click", () => group.classList.remove("open"));
}

document.addEventListener("DOMContentLoaded", () => {
  init();

  // 齿轮按钮：显示/隐藏设置面板
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsPanel = document.getElementById("settingsPanel");
  if (settingsBtn && settingsPanel) {
    settingsBtn.onclick = () => {
      settingsPanel.classList.toggle("hidden");
    };
  }

  // 监听默认分类单选按钮切换
  const radios = document.querySelectorAll('input[name="defaultCategory"]');
  radios.forEach((radio) => {
    radio.onchange = async (e) => {
      const selectedVal = e.target.value;
      await setDefaultCategory(selectedVal);

      // 同步更新当前的选择框内容，提供即时、顺畅的交互反馈
      const hiddenInput = document.getElementById("categoryValue");
      if (hiddenInput) {
        hiddenInput.value = selectedVal;
      }
      try {
        const categories = await categoriesPromise;
        renderCustomSelect(categories);
      } catch (err) {
        console.error("Failed to re-render custom select", err);
      }
    };
  });

  const saveBtn = document.getElementById("saveBtn");
  if (!saveBtn) return;

  saveBtn.onclick = async () => {
    const formData = {
      url: document.getElementById("url").value.trim(),
      title: document.getElementById("title").value.trim(),
      category: document.getElementById("categoryValue").value, // 获取拼接后的多选分类字符串
      icon: document.getElementById("icon").value.trim(),
      description: document.getElementById("description").value.trim(),
      style: "bg-transparent",
    };

    if (!formData.url || !formData.title) {
      updateStatus("请填写必填项", "#ef4444");
      return;
    }

    setUIState(true);
    updateStatus("保存中...", "#2563eb"); // 配合蓝色按钮更新提示颜色

    try {
      const res = await fetch(API_APPEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        updateStatus("✅ 导航新增成功", "#16a34a");
        setTimeout(() => window.close(), 1000);
      } else {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
    } catch (err) {
      updateStatus("❌ 失败: " + err.message, "#ef4444");
      setUIState(false);
    }
  };
});
