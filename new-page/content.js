(function () {
  // 获取当前网站的域名，作为存储和区分位置的唯一标识
  const hostname = window.location.hostname;

  // 1. 创建外层圆形容器
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.visibility = "hidden"; // 初始隐藏，防止加载保存位置时发生闪烁
  container.style.width = "38px";
  container.style.height = "38px";

  // 核心改动：由 "10px" 改回 "50%"，呈现经典的、极具质感的正圆形样式
  container.style.borderRadius = "50%";

  container.style.cursor = "grab";
  container.style.zIndex = "999999";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.userSelect = "none";

  // 避免宿主网站的全局样式干扰
  container.style.boxSizing = "border-box";
  container.style.padding = "0";
  container.style.margin = "0";
  container.style.border = "1.5px solid transparent"; // 预设边框防止抖动

  // 加入毛玻璃磨砂效果，使其在任何网页背景上都清晰可见
  container.style.backdropFilter = "blur(8px)";
  container.style.webkitBackdropFilter = "blur(8px)";

  // 设置平滑过渡动画，使颜色和缩放变化更自然
  container.style.transition =
    "background-color 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease, border-color 0.25s ease, opacity 0.3s ease";

  // 初始设置为缩放且透明，用于入场动画
  container.style.opacity = "0";
  container.style.transform = "scale(0.7)";

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
  // 【注意】这里不再同步挂载到 body，而是改为在步骤 4 读取配置后按需异步挂载

  // 3. 动态背景色及动效状态维护
  let isHovered = false;
  let isDragging = false;

  const updateTheme = () => {
    const isDark = mediaQuery.matches;
    if (isDark) {
      // 深色模式下：半透明深色 + 悬停时带有微弱的科幻蓝色微光
      container.style.backgroundColor = isHovered
        ? "rgba(45, 45, 45, 0.9)"
        : "rgba(30, 30, 30, 0.8)";
      container.style.boxShadow = isHovered
        ? "0 6px 20px rgba(0, 122, 255, 0.35)"
        : "0 4px 12px rgba(0, 0, 0, 0.5)";
      container.style.borderColor = "rgba(255, 255, 255, 0.2)";
    } else {
      // 浅色模式下：半透明纯白 + 悬停时加深投影
      container.style.backgroundColor = isHovered
        ? "rgba(245, 245, 245, 0.95)"
        : "rgba(255, 255, 255, 0.85)";
      container.style.boxShadow = isHovered
        ? "0 6px 20px rgba(0, 0, 0, 0.18)"
        : "0 4px 12px rgba(0, 0, 0, 0.12)";
      container.style.borderColor = "rgba(0, 0, 0, 0.08)";
    }

    // 只有当加载完成后，才应用鼠标悬停缩放，避免干扰初始入场动画
    if (container.style.visibility === "visible") {
      container.style.transform = isHovered ? "scale(1.1)" : "scale(1)";
    }
  };

  // 监听系统深浅色模式变化
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  updateTheme(); // 预设状态

  try {
    mediaQuery.addEventListener("change", updateTheme);
  } catch (err) {
    mediaQuery.addListener(updateTheme);
  }

  // 悬停交互事件（在拖拽期间不触发，体验更平稳）
  container.addEventListener("mouseenter", () => {
    if (isDragging) return;
    isHovered = true;
    updateTheme();
  });

  container.addEventListener("mouseleave", () => {
    if (isDragging) return;
    isHovered = false;
    updateTheme();
  });

  // 4. 从存储中读取配置（包括：位置、是否开启悬浮窗）并渲染
  chrome.storage.local.get(
    ["buttonPositions", "showFloatingButton"],
    (result) => {
      // 获取悬浮窗开启状态，默认为 false
      const showFloatingButton = result.showFloatingButton == true;

      // 如果未开启悬浮窗，则直接退出，不将其挂载到 DOM 中
      if (!showFloatingButton) {
        return;
      }

      // 只有开启时才将容器添加到页面 body 中
      document.body.appendChild(container);

      const positions = result.buttonPositions || {};
      const sitePosition = positions[hostname]; // 获取当前域名的专属位置

      if (sitePosition) {
        const { left, top } = sitePosition;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const containerWidth = 38;
        const containerHeight = 38;

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
        // 默认初始位置
        container.style.left = "20px";
        container.style.bottom = "20px";
      }

      // 读取完毕后，通过渐显和放大动画平滑出场，吸引视线
      container.style.visibility = "visible";
      setTimeout(() => {
        container.style.opacity = "1";
        updateTheme();
      }, 50);
    },
  );

  // 5. 拖拽逻辑实现
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
      isHovered = false;
      container.style.cursor = "grab";
      updateTheme();

      if (hasMoved) {
        const rect = container.getBoundingClientRect();
        // 获取现有的位置映射表，更新当前域名对应的坐标，再保存回去
        chrome.storage.local.get(["buttonPositions"], (result) => {
          const positions = result.buttonPositions || {};
          positions[hostname] = {
            left: rect.left,
            top: rect.top,
          };
          chrome.storage.local.set({ buttonPositions: positions });
        });
      }
    }
  });

  // 6. 点击事件
  container.addEventListener("click", (e) => {
    if (hasMoved) {
      e.preventDefault();
      return;
    }
    chrome.runtime.sendMessage({ action: "open_target_url" });
  });

  // 7. 全屏状态检测
  const handleFullscreenChange = () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      container.style.display = "none";
    } else {
      container.style.display = "flex";
    }
  };

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

  // 8. 快捷键监听逻辑
  // 拦截 Alt + N (Windows/Linux) 或 Option + N (Mac)
  document.addEventListener(
    "keydown",
    (e) => {
      const isAlt = e.altKey;
      const isN = e.code === "KeyN" || e.keyCode === 78;

      // 确保仅按下 Alt + N，没有同时按下 Ctrl、Cmd(meta) 或 Shift
      if (isAlt && isN && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        chrome.runtime.sendMessage({ action: "open_target_url" });
      }
    },
    true,
  ); // 使用捕获阶段 (true) 尽可能提早拦截事件
})();
