(() => {
  "use strict";

  if (window.__jiangnanGiscusManagerReady) return;
  window.__jiangnanGiscusManagerReady = true;

  const repository = "jiangnanqing188/jiangnanqing188.github.io";
  const discussionPath = /^\/jiangnanqing188\/jiangnanqing188\.github\.io\/discussions\/\d+\/?$/;

  const addManageLink = discussion => {
    if (discussion?.repository?.nameWithOwner !== repository) return;

    let discussionUrl;
    try {
      discussionUrl = new URL(discussion.url);
    } catch {
      return;
    }

    if (discussionUrl.origin !== "https://github.com" || !discussionPath.test(discussionUrl.pathname)) {
      return;
    }

    const commentHead = document.querySelector("#post-comment .comment-head");
    if (!commentHead) return;

    let manageLink = commentHead.querySelector(".giscus-manage-link");
    if (!manageLink) {
      manageLink = document.createElement("a");
      manageLink.className = "giscus-manage-link";
      manageLink.target = "_blank";
      manageLink.rel = "noopener";
      manageLink.textContent = "管理评论 ↗";
      manageLink.setAttribute("aria-label", "在 GitHub Discussions 管理本文评论");
      commentHead.querySelector(".comment-headline")?.insertAdjacentElement("afterend", manageLink);
    }

    manageLink.href = discussionUrl.href;
  };

  window.addEventListener("message", event => {
    if (event.origin !== "https://giscus.app") return;

    const frame = document.querySelector("#giscus-wrap iframe.giscus-frame");
    if (!frame || event.source !== frame.contentWindow) return;

    const payload = event.data?.giscus;
    if (!payload || typeof payload !== "object" || !("discussion" in payload)) return;
    addManageLink(payload.discussion);
  });
})();
