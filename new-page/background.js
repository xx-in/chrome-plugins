// 点击浏览器右上角的插件图标时触发
chrome.action.onClicked.addListener(() => {
  openTargetUrl();
});

// 接收来自 content.js 的点击消息时触发
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "open_target_url") {
    openTargetUrl();
  }
});

function openTargetUrl() {
  chrome.tabs.create({
    url: "https://xshare.ccwu.cc",
  });
}
