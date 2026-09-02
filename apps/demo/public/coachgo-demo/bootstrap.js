/* global document, HTMLElement, window */
document.documentElement.dataset.coachBootstrap = "ready";

import("/coachgo-demo/dist/mobile/demo.js?v=20260902-1").catch((error) => {
  const mapStatus = document.querySelector("#map-load-state");
  if (mapStatus instanceof HTMLElement) {
    const message = document.createElement("span");
    message.textContent = "地図を読み込めませんでした。通信状況を確認して、もう一度お試しください。";
    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.textContent = "再読み込み";
    retryButton.addEventListener("click", () => window.location.reload());
    mapStatus.hidden = false;
    mapStatus.classList.add("error");
    mapStatus.replaceChildren(message, retryButton);
  }
  const status = document.querySelector("#shared-data-status");
  if (!(status instanceof HTMLElement)) return;
  status.dataset.clientError = error instanceof Error ? error.message : "unknown client error";
  status.dataset.state = "unavailable";
  status.textContent = "危険地点データを読み込めませんでした。";
});
