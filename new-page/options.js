document.addEventListener("DOMContentLoaded", () => {
  const checkbox = document.getElementById("toggle-floating-btn");
  const statusMessage = document.getElementById("status-message");

  // 1. 初始化时：从本地存储读取配置（未配置时默认开启为 true）
  chrome.storage.local.get("showFloatingButton", (result) => {
    const isEnabled = result.showFloatingButton !== false;
    checkbox.checked = isEnabled;
  });

  // 2. 状态改变时：实时监听并保存到本地存储
  checkbox.addEventListener("change", () => {
    const isChecked = checkbox.checked;

    chrome.storage.local.set({ showFloatingButton: isChecked }, () => {
      statusMessage.textContent = "设置已自动保存，刷新网页后生效";
      statusMessage.style.color = "#34c759"; // 提示成功后的绿色反馈

      setTimeout(() => {
        statusMessage.textContent = "保存将在刷新网页后生效";
        statusMessage.style.color = "#86868b";
      }, 2000);
    });
  });
});
