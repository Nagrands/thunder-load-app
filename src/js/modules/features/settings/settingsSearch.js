import { t } from "../../i18n.js";

const ITEM_SELECTOR = [
  "[data-settings-search-item]",
  ".settings-card",
  ".settings-control",
  ".shortcut-editor__row",
].join(",");

const TITLE_SELECTOR = [
  ".settings-card__title",
  ".settings-control__meta strong",
  ".settings-choice__meta strong",
  ".shortcut-editor__name",
  ".settings-control-group__title",
  ".settings-control label > span",
  "h3",
  "h4",
].join(",");

const DESCRIPTION_SELECTOR = [
  ".settings-card__desc",
  ".settings-control__meta small",
  ".settings-choice__meta small",
  ".shortcut-editor__description",
  "p",
].join(",");

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getDirectMatch(root, selector) {
  if (!(root instanceof HTMLElement)) return null;
  if (root.matches(selector)) return root;
  return root.querySelector(selector);
}

function getCategoryLabel(pane) {
  const tabId = pane?.getAttribute("aria-labelledby");
  const tab = tabId ? document.getElementById(tabId) : null;
  return String(tab?.textContent || "").trim();
}

function createSearchEntry(node, index) {
  const pane = node.closest(".tab-pane");
  const titleNode = getDirectMatch(node, TITLE_SELECTOR);
  const descriptionNode = getDirectMatch(node, DESCRIPTION_SELECTOR);
  const title = String(titleNode?.textContent || "").trim();
  const description = String(descriptionNode?.textContent || "").trim();
  const category = getCategoryLabel(pane);
  if (!pane?.id || !title) return null;

  const explicitId = node.dataset.settingsSearchId || node.id;
  const id = explicitId || `${pane.id}-${index + 1}`;
  node.dataset.settingsSearchId = id;
  return {
    id,
    node,
    paneId: pane.id,
    title,
    description: description === title ? "" : description,
    category,
    searchable: normalizeSearchText([title, description, category].join(" ")),
  };
}

function appendHighlightedText(root, value, query) {
  const source = String(value || "");
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    root.append(document.createTextNode(source));
    return;
  }

  const normalizedSource = normalizeSearchText(source);
  const matchIndex = normalizedSource.indexOf(normalizedQuery);
  if (matchIndex < 0) {
    root.append(document.createTextNode(source));
    return;
  }

  const before = source.slice(0, matchIndex);
  const match = source.slice(matchIndex, matchIndex + normalizedQuery.length);
  const after = source.slice(matchIndex + normalizedQuery.length);
  root.append(document.createTextNode(before));
  const mark = document.createElement("mark");
  mark.textContent = match;
  root.append(mark, document.createTextNode(after));
}

function focusSearchTarget(target) {
  const focusable = target.matches(
    "button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
  )
    ? target
    : target.querySelector(
        "button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
  if (focusable instanceof HTMLElement) {
    focusable.focus({ preventScroll: true });
    return;
  }
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  target.addEventListener(
    "blur",
    () => {
      if (target.getAttribute("tabindex") === "-1") {
        target.removeAttribute("tabindex");
      }
    },
    { once: true },
  );
}

export function initSettingsSearch({
  root,
  activateCategory,
  renderIcons = () => {},
} = {}) {
  const input = root?.querySelector("#settings-search-input");
  const clearButton = root?.querySelector("#settings-search-clear");
  const results = root?.querySelector("#settings-search-results");
  const live = root?.querySelector("#settings-search-live");
  if (!input || !clearButton || !results || !live) return null;

  let entries = [];
  let matches = [];
  let activeIndex = -1;

  const closeResults = () => {
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  };

  const announce = (message) => {
    live.textContent = "";
    queueMicrotask(() => {
      live.textContent = message;
    });
  };

  const rebuild = () => {
    const seen = new Set();
    entries = Array.from(root.querySelectorAll(ITEM_SELECTOR))
      .map(createSearchEntry)
      .filter(Boolean)
      .filter((entry) => {
        const key = `${entry.paneId}:${normalizeSearchText(entry.title)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const syncActiveOption = (nextIndex) => {
    if (!matches.length) return;
    activeIndex = Math.max(0, Math.min(matches.length - 1, nextIndex));
    Array.from(results.children).forEach((option, index) => {
      const active = index === activeIndex;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-selected", String(active));
      if (active) {
        input.setAttribute("aria-activedescendant", option.id);
        option.scrollIntoView?.({ block: "nearest" });
      }
    });
  };

  const selectEntry = (entry) => {
    if (!entry) return;
    closeResults();
    activateCategory?.(entry.paneId);
    entry.node.closest("details")?.setAttribute("open", "");
    requestAnimationFrame(() => {
      entry.node.scrollIntoView?.({
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
      entry.node.classList.remove("is-search-target");
      void entry.node.offsetWidth;
      entry.node.classList.add("is-search-target");
      entry.node.addEventListener(
        "animationend",
        () => entry.node.classList.remove("is-search-target"),
        { once: true },
      );
      focusSearchTarget(entry.node);
    });
  };

  const render = () => {
    const query = normalizeSearchText(input.value);
    clearButton.hidden = !query;
    results.replaceChildren();
    if (!query) {
      matches = [];
      closeResults();
      live.textContent = "";
      return;
    }

    matches = entries
      .filter((entry) => entry.searchable.includes(query))
      .slice(0, 20);

    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "settings-search-results__empty";
      empty.textContent = t("settings.search.empty");
      results.append(empty);
      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
      announce(t("settings.search.count", { count: 0 }));
      return;
    }

    matches.forEach((entry, index) => {
      const option = document.createElement("div");
      option.id = `settings-search-result-${index}`;
      option.className = "settings-search-result";
      option.role = "option";
      option.setAttribute("aria-selected", "false");

      const icon = document.createElement("span");
      icon.className = "settings-search-result__icon";
      icon.setAttribute("aria-hidden", "true");
      const iconNode = document.createElement("i");
      iconNode.dataset.lucide = "corner-down-right";
      icon.append(iconNode);

      const copy = document.createElement("span");
      copy.className = "settings-search-result__copy";
      const title = document.createElement("strong");
      appendHighlightedText(title, entry.title, input.value);
      const meta = document.createElement("small");
      meta.textContent = entry.description
        ? `${entry.category} · ${entry.description}`
        : entry.category;
      copy.append(title, meta);
      option.append(icon, copy);
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.addEventListener("click", () => selectEntry(entry));
      option.addEventListener("pointermove", () => syncActiveOption(index));
      results.append(option);
    });

    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
    renderIcons(results);
    syncActiveOption(0);
    announce(t("settings.search.count", { count: matches.length }));
  };

  const clear = ({ focus = false } = {}) => {
    input.value = "";
    render();
    if (focus) input.focus();
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape" && !results.hidden) {
      event.preventDefault();
      event.stopPropagation();
      closeResults();
      return;
    }
    if (!matches.length || results.hidden) return;
    const targets = {
      ArrowDown: activeIndex + 1 >= matches.length ? 0 : activeIndex + 1,
      ArrowUp: activeIndex <= 0 ? matches.length - 1 : activeIndex - 1,
      Home: 0,
      End: matches.length - 1,
    };
    if (event.key in targets) {
      event.preventDefault();
      syncActiveOption(targets[event.key]);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectEntry(matches[Math.max(0, activeIndex)]);
    }
  };

  const handleDocumentPointer = (event) => {
    if (!event.target.closest(".settings-search")) closeResults();
  };
  const handleI18nChanged = () => {
    rebuild();
    render();
  };
  const handleIndexInvalidated = () => {
    rebuild();
    if (input.value.trim()) render();
  };

  input.addEventListener("input", render);
  input.addEventListener("keydown", handleKeydown);
  clearButton.addEventListener("click", () => clear({ focus: true }));
  document.addEventListener("pointerdown", handleDocumentPointer);
  window.addEventListener("i18n:changed", handleI18nChanged);
  window.addEventListener(
    "settings:search-index-invalidated",
    handleIndexInvalidated,
  );
  rebuild();

  return {
    rebuild,
    clear,
    closeResults,
    isResultsOpen: () => !results.hidden,
    dispose() {
      input.removeEventListener("input", render);
      input.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("pointerdown", handleDocumentPointer);
      window.removeEventListener("i18n:changed", handleI18nChanged);
      window.removeEventListener(
        "settings:search-index-invalidated",
        handleIndexInvalidated,
      );
    },
  };
}

export const __test = {
  appendHighlightedText,
  normalizeSearchText,
};
