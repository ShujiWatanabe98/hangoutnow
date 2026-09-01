/* global document, HTMLElement */
document.documentElement.dataset.coachBootstrap = "ready";

import("/coachgo-demo/dist/mobile/demo.js?v=20260901-7").catch((error) => {
  const status = document.querySelector("#shared-data-status");
  if (!(status instanceof HTMLElement)) return;
  status.dataset.clientError = error instanceof Error ? error.message : "unknown client error";
  status.dataset.state = "unavailable";
  status.textContent = "危険地点データを読み込めませんでした。";
});
