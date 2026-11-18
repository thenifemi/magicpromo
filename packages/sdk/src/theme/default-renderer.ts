// The banner merchants get when no developer renderer is registered.
// Styled by assets/magicpromo.css.
import type { Renderer } from "../render";

export const defaultRenderer: Renderer = ({ placement, offer, message, progress, href, dismiss, host }) => {
  host.style.setProperty("--mp-bg", offer.settings.background);
  host.style.setProperty("--mp-fg", offer.settings.foreground);
  host.dataset.position = offer.settings.position;

  const content = document.createElement("div");
  content.className = "mp-content";

  const text = document.createElement("span");
  // textContent, never innerHTML: merchant text must not become markup.
  text.textContent = message;
  if (progress) text.setAttribute("role", "status");

  const link = document.createElement("a");
  link.href = href;
  link.textContent = offer.settings.linkText;
  content.append(text, link);

  if (progress) {
    const bar = document.createElement("progress");
    bar.max = offer.minimum;
    bar.value = Math.min(progress.count, offer.minimum);
    bar.setAttribute("aria-label", message);
    content.append(bar);
  }
  if (placement === "announcement") {
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", host.dataset.close ?? "");
    close.addEventListener("click", dismiss);
    content.append(close);
  }
  return content;
};
