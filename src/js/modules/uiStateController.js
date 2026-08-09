import { t } from "./i18n.js";

const UI_STATE_KINDS = Object.freeze([
  "idle",
  "loading",
  "success",
  "warning",
  "error",
  "empty",
]);

const UI_STATE_KIND_SET = new Set(UI_STATE_KINDS);
const DEFAULT_ICONS = Object.freeze({
  loading: "fa-solid fa-spinner fa-spin",
  success: "fa-solid fa-circle-check",
  warning: "fa-solid fa-triangle-exclamation",
  error: "fa-solid fa-circle-exclamation",
  empty: "fa-regular fa-folder-open",
});

function resolveText(key, fallback = "", vars = {}) {
  if (key) return t(key, vars);
  return String(fallback || "");
}

function normalizeProgress(progress) {
  if (!progress) return null;
  const mode = progress.mode === "determinate" ? "determinate" : "indeterminate";
  if (mode === "indeterminate") return { mode };
  const max = Math.max(1, Number(progress.max) || 100);
  const value = Math.max(0, Math.min(max, Number(progress.value) || 0));
  return {
    mode,
    value,
    max,
    labelKey: progress.labelKey || "",
    label: progress.label || "",
    vars: progress.vars || {},
  };
}

function normalizeState(nextState = {}) {
  const kind = UI_STATE_KIND_SET.has(nextState.kind)
    ? nextState.kind
    : "idle";
  return {
    kind,
    titleKey: nextState.titleKey || "",
    title: nextState.title || "",
    messageKey: nextState.messageKey || "",
    message: nextState.message || "",
    vars: nextState.vars || {},
    icon: nextState.icon || DEFAULT_ICONS[kind] || "",
    progress: normalizeProgress(nextState.progress),
    actions: Array.isArray(nextState.actions)
      ? nextState.actions.filter((action) => action?.id)
      : [],
    operationId: nextState.operationId || "",
    skeletonLines: Math.max(0, Number(nextState.skeletonLines) || 0),
  };
}

function createStateElement() {
  const element = document.createElement("section");
  element.className = "ui-state";
  element.dataset.ui = "state";
  element.hidden = true;
  return element;
}

function renderProgress(progress) {
  if (!progress) return null;
  const wrapper = document.createElement("div");
  wrapper.className = `ui-state__progress is-${progress.mode}`;
  const bar = document.createElement("div");
  bar.className = "ui-state__progress-bar";
  bar.setAttribute("role", "progressbar");
  if (progress.mode === "determinate") {
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", String(progress.max));
    bar.setAttribute("aria-valuenow", String(progress.value));
    bar.style.setProperty(
      "--ui-progress",
      `${(progress.value / progress.max) * 100}%`,
    );
  } else {
    bar.removeAttribute("aria-valuenow");
  }
  wrapper.appendChild(bar);
  const label = resolveText(progress.labelKey, progress.label, progress.vars);
  if (label) {
    const labelEl = document.createElement("span");
    labelEl.className = "ui-state__progress-label";
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);
  }
  return wrapper;
}

function renderSkeleton(lines) {
  if (!lines) return null;
  const skeleton = document.createElement("div");
  skeleton.className = "ui-state__skeleton";
  skeleton.setAttribute("aria-hidden", "true");
  for (let index = 0; index < lines; index += 1) {
    const line = document.createElement("span");
    line.className = "ui-state__skeleton-line";
    line.style.setProperty("--ui-skeleton-line", String(index));
    skeleton.appendChild(line);
  }
  return skeleton;
}

function createUiStateController({
  root,
  stateElement = null,
  contentElement = null,
  onAction = null,
} = {}) {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError("createUiStateController requires an HTMLElement root");
  }
  const element = stateElement || createStateElement();
  if (!element.isConnected && !root.contains(element)) root.appendChild(element);
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.setAttribute("aria-atomic", "true");
  let state = normalizeState();

  const render = () => {
    const visible = state.kind !== "idle";
    const busy = state.kind === "loading";
    root.dataset.uiState = state.kind;
    root.setAttribute("aria-busy", String(busy));
    if (state.operationId) root.dataset.operationId = state.operationId;
    else delete root.dataset.operationId;
    element.hidden = !visible;
    element.dataset.kind = state.kind;
    element.className = `ui-state ui-state--${state.kind}`;
    element.setAttribute("role", state.kind === "error" ? "alert" : "status");
    element.setAttribute(
      "aria-live",
      state.kind === "error" ? "assertive" : "polite",
    );
    if (contentElement) {
      contentElement.hidden = ["loading", "error", "empty"].includes(
        state.kind,
      );
    }
    element.replaceChildren();
    if (!visible) return;

    const icon = document.createElement("i");
    icon.className = `ui-state__icon ${state.icon}`.trim();
    icon.setAttribute("aria-hidden", "true");
    element.appendChild(icon);

    const body = document.createElement("div");
    body.className = "ui-state__body";
    const title = resolveText(state.titleKey, state.title, state.vars);
    const message = resolveText(state.messageKey, state.message, state.vars);
    if (title) {
      const titleEl = document.createElement("strong");
      titleEl.className = "ui-state__title";
      titleEl.textContent = title;
      body.appendChild(titleEl);
    }
    if (message) {
      const messageEl = document.createElement("p");
      messageEl.className = "ui-state__message";
      messageEl.textContent = message;
      body.appendChild(messageEl);
    }
    const skeleton = renderSkeleton(
      state.kind === "loading" ? state.skeletonLines : 0,
    );
    if (skeleton) body.appendChild(skeleton);
    const progress = renderProgress(state.progress);
    if (progress) body.appendChild(progress);

    if (state.actions.length) {
      const actions = document.createElement("div");
      actions.className = "ui-state__actions";
      state.actions.forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `ui-state__action${
          action.primary ? " is-primary" : ""
        }`;
        button.dataset.action = action.id;
        button.textContent = resolveText(
          action.labelKey,
          action.label || action.id,
          action.vars,
        );
        button.disabled = Boolean(action.disabled);
        button.addEventListener("click", () => onAction?.(action.id, state));
        actions.appendChild(button);
      });
      body.appendChild(actions);
    }
    element.appendChild(body);
  };

  render();
  return {
    setState(nextState) {
      state = normalizeState(nextState);
      render();
      return state;
    },
    getState: () => ({ ...state }),
    reset() {
      state = normalizeState();
      render();
    },
    dispose() {
      root.removeAttribute("aria-busy");
      delete root.dataset.uiState;
      delete root.dataset.operationId;
      if (!stateElement) element.remove();
    },
    element,
  };
}

export { UI_STATE_KINDS, createUiStateController, normalizeState };
