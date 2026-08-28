(() => {
  "use strict";

  const controls = [
    [".highlight-tools .copy-button", "复制代码"],
    [".highlight-tools .expand", "展开或收起代码"],
    [".code-expand-btn", "展开完整代码"],
    ["#post-share-url", "复制文章链接"]
  ];

  const syncControlState = element => {
    if (element.matches(".code-expand-btn")) {
      element.setAttribute("aria-expanded", String(element.classList.contains("expand-done")));
    }

    if (element.matches(".highlight-tools .expand")) {
      element.setAttribute(
        "aria-expanded",
        String(!element.closest(".highlight-tools")?.classList.contains("closed"))
      );
    }
  };

  const makeKeyboardOperable = (element, label) => {
    if (!element.hasAttribute("aria-label")) element.setAttribute("aria-label", label);
    if (!element.hasAttribute("role")) element.setAttribute("role", "button");
    if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "0");
    syncControlState(element);
    if (element.dataset.labKeyboardReady) return;

    element.dataset.labKeyboardReady = "true";
    element.addEventListener("click", () => window.setTimeout(() => syncControlState(element), 0));
    element.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      element.click();
    });
  };

  const enhanceMenu = () => {
    const toggle = document.querySelector("#toggle-menu a");
    const sidebar = document.getElementById("sidebar-menus");
    const mask = document.getElementById("menu-mask");
    if (!toggle || !sidebar || !mask) return;

    const syncMenuState = () => {
      const isOpen = sidebar.classList.contains("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "关闭导航菜单" : "打开导航菜单");
    };

    syncMenuState();
    if (toggle.dataset.labMenuReady) return;
    toggle.dataset.labMenuReady = "true";

    toggle.addEventListener("click", () => {
      window.setTimeout(() => {
        syncMenuState();
        if (sidebar.classList.contains("open")) {
          sidebar.querySelector("a, button, [tabindex]:not([tabindex='-1'])")?.focus();
        }
      }, 0);
    });
    mask.addEventListener("click", () => window.setTimeout(syncMenuState, 0));
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape" || !sidebar.classList.contains("open")) return;
      mask.click();
      toggle.focus();
    });

    new MutationObserver(syncMenuState).observe(sidebar, {
      attributes: true,
      attributeFilter: ["class"]
    });
  };

  let lastSearchTrigger = null;
  let searchListenersReady = false;

  const enhanceSearch = () => {
    if (searchListenersReady) return;
    searchListenersReady = true;

    const restoreSearchTrigger = () => {
      window.setTimeout(() => {
        const fallback = document.querySelector("#search-button > .search");
        const target = lastSearchTrigger?.isConnected ? lastSearchTrigger : fallback;
        target?.focus();
      }, 550);
    };

    document.addEventListener(
      "click",
      event => {
        const trigger = event.target.closest("#search-button > .search, #menu-search");
        if (trigger) {
          lastSearchTrigger = trigger.matches("a")
            ? trigger
            : document.querySelector("#search-button > .search");
        }

        if (event.target.closest(".search-close-button, #search-mask")) {
          restoreSearchTrigger();
        }
      },
      true
    );
    document.addEventListener("keydown", event => {
      const mask = document.getElementById("search-mask");
      if (!mask) return;
      if (event.key !== "Escape" || getComputedStyle(mask).display === "none") return;
      restoreSearchTrigger();
    });
  };

  const enhanceControls = () => {
    controls.forEach(([selector, label]) => {
      document.querySelectorAll(selector).forEach(element => makeKeyboardOperable(element, label));
    });
    enhanceMenu();
    enhanceSearch();
  };

  document.addEventListener("DOMContentLoaded", enhanceControls);
  document.addEventListener("pjax:complete", enhanceControls);
  window.addEventListener("load", enhanceControls, { once: true });

  const observer = new MutationObserver(enhanceControls);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 5000);
})();
