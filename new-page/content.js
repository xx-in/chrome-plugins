(function () {
  // 1. 创建外层圆形容器
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.visibility = "hidden"; // 初始隐藏，防止加载保存位置时发生闪烁
  container.style.width = "38px";
  container.style.height = "38px";
  container.style.backgroundColor = "#ffffff"; // 纯白不透明背景
  container.style.borderRadius = "50%";
  container.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
  container.style.cursor = "grab";
  container.style.zIndex = "999999";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.userSelect = "none";
  container.style.opacity = "1";

  // 避免宿主网站的全局样式干扰
  container.style.boxSizing = "border-box";
  container.style.padding = "0";
  container.style.margin = "0";
  container.style.border = "none";

  // 2. 创建内层图标
  const img = document.createElement("img");
  img.src = chrome.runtime.getURL("icon.png");
  img.style.width = "24px";
  img.style.height = "24px";
  img.style.webkitUserDrag = "none";
  img.style.pointerEvents = "none";

  img.style.boxSizing = "border-box";
  img.style.padding = "0";
  img.style.margin = "0";
  img.style.border = "none";
  img.style.borderRadius = "0";

  container.appendChild(img);
  document.body.appendChild(container);

  // 3. 从存储中读取位置并还原
  chrome.storage.local.get(["buttonPosition"], (result) => {
    if (result.buttonPosition) {
      const { left, top } = result.buttonPosition;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const containerWidth = 38;
      const containerHeight = 38;

      // 边界检测：防止因为调整窗口大小导致按钮越界不可见
      let targetLeft = Math.max(
        0,
        Math.min(left, windowWidth - containerWidth),
      );
      let targetTop = Math.max(
        0,
        Math.min(top, windowHeight - containerHeight),
      );

      container.style.bottom = "auto";
      container.style.right = "auto";
      container.style.left = `${targetLeft}px`;
      container.style.top = `${targetTop}px`;
    } else {
      // 默认在左下角
      container.style.left = "20px";
      container.style.bottom = "20px";
    }
    // 读取或设置完毕后展示
    container.style.visibility = "visible";
  });

  // 4. 拖拽逻辑实现
  let isDragging = false;
  let hasMoved = false;
  let startX, startY;
  let initialLeft, initialTop;

  container.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;

    isDragging = true;
    hasMoved = false;
    container.style.cursor = "grabbing";

    startX = e.clientX;
    startY = e.clientY;

    const rect = container.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    container.style.bottom = "auto";
    container.style.right = "auto";
    container.style.left = `${initialLeft}px`;
    container.style.top = `${initialTop}px`;

    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMoved = true;
    }

    let newLeft = initialLeft + dx;
    let newTop = initialTop + dy;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    newLeft = Math.max(0, Math.min(newLeft, windowWidth - containerWidth));
    newTop = Math.max(0, Math.min(newTop, windowHeight - containerHeight));

    container.style.left = `${newLeft}px`;
    container.style.top = `${newTop}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      container.style.cursor = "grab";

      // 拖动结束后，如果位置改变了，保存最新的位置到存储
      if (hasMoved) {
        const rect = container.getBoundingClientRect();
        chrome.storage.local.set({
          buttonPosition: {
            left: rect.left,
            top: rect.top,
          },
        });
      }
    }
  });

  // 5. 点击事件
  container.addEventListener("click", (e) => {
    if (hasMoved) {
      e.preventDefault();
      return;
    }
    chrome.runtime.sendMessage({ action: "open_target_url" });
  });

  // 6. 全屏状态检测
  const handleFullscreenChange = () => {
    // 检查是否存在全屏元素（如全屏看视频或按 F11 全屏）
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      container.style.display = "none";
    } else {
      container.style.display = "flex";
    }
  };

  // 注册标准及 webkit 兼容的全屏事件监听
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
})();
