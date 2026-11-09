// src/js/modules/tabSystem.js

export default class TabSystem {
  constructor(menuSel, viewSel) {
    this.menu = document.querySelector(menuSel);
    this.view = document.querySelector(viewSel);
    if (!this.menu || !this.view)
      throw new Error("TabSystem: containers not found");

    this.tabs = new Map();
    this.activeTabId = null;
    this.ANIM_MS = 250; // длительность анимации (ms)
  }

  _syncActiveTabLayoutState(id = "") {
    if (!this.view) return;
    this.view.dataset.activeTab = id || "";
  }

  addTab(id, label, iconCls, renderCb, hooks = {}) {
    if (this.tabs.has(id)) return;
    const btn = document.createElement("button");
    btn.classList.add("menu-item");
    btn.type = "button";
    btn.id = `app-tab-${id}`;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", "false");
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
    btn.dataset.bsToggle = "tooltip";
    btn.dataset.bsPlacement = "bottom";
    btn.tabIndex = -1;
    btn.dataset.menu = id;
    btn.dataset.tabgen = "true";
    btn.innerHTML = `
      <span class="menu-progress" aria-hidden="true"></span>
      <span class="menu-main">
        <i class="${iconCls}"></i>
        <span class="menu-text">${label}</span>
        <span class="menu-badge" aria-hidden="true"></span>
      </span>`;
    const labelEl = btn.querySelector(".menu-text");
    btn.addEventListener("click", () => this.activateTab(id));

    const anchor = Array.from(this.menu.children).find(
      (el) => !el.dataset.tabgen,
    );
    anchor ? this.menu.insertBefore(btn, anchor) : this.menu.appendChild(btn);

    this.tabs.set(id, {
      button: btn,
      iconCls,
      label,
      labelEl,
      render: renderCb,
      ...hooks,
    });
  }

  setTabLabel(id, label) {
    const rec = this.tabs.get(id);
    if (!rec?.labelEl) return;
    rec.label = label;
    rec.labelEl.textContent = label;
    rec.button.setAttribute("aria-label", label);
    rec.button.setAttribute("title", label);
  }

  activateTab(id) {
    if (!this.tabs.has(id) || id === this.activeTabId) return;

    const next = this.tabs.get(id);
    const prev = this.activeTabId ? this.tabs.get(this.activeTabId) : null;

    if (next.hideTimer) {
      clearTimeout(next.hideTimer);
      next.hideTimer = null;
    }
    prev?.button.classList.remove("active");
    prev?.button.setAttribute("aria-selected", "false");
    if (prev?.button) prev.button.tabIndex = -1;
    next.button.classList.add("active");
    next.button.setAttribute("aria-selected", "true");
    next.button.tabIndex = 0;

    // создаём view один раз
    if (!next.element) {
      const rendered = next.render?.() || document.createElement("div");
      rendered.dataset.tabId = id;
      rendered.classList.add("tab-view");
      if (!rendered.id) rendered.id = `app-tabpanel-${id}`;
      rendered.setAttribute("role", "tabpanel");
      rendered.setAttribute("aria-labelledby", next.button.id);
      next.button.setAttribute("aria-controls", rendered.id);
      this.view.appendChild(rendered);
      next.element = rendered;
    } else {
      if (
        next.element.childNodes.length === 0 &&
        typeof next.render === "function"
      ) {
        const content = next.render();
        if (content instanceof HTMLElement && content !== next.element) {
          next.element.appendChild(content);
        }
      }
    }

    // скрываем предыдущий с fade‑out
    if (prev?.element) {
      if (prev.hideTimer) clearTimeout(prev.hideTimer);
      prev.element.classList.remove("tab-show");
      prev.element.classList.add("tab-hide");
      prev.hideTimer = setTimeout(() => {
        prev.hideTimer = null;
        if (
          this.activeTabId !== prev.element.dataset.tabId &&
          prev.element.classList.contains("tab-hide")
        ) {
          prev.element.style.display = "none";
        }
      }, this.ANIM_MS);
    }

    // показываем следующий
    const el = next.element;
    el.style.display = "";
    el.classList.remove("tab-hide"); //  <<<  важно!
    this.activeTabId = id;
    this._syncActiveTabLayoutState(id);
    // небольшая пауза – чтобы transition сработал
    requestAnimationFrame(() => {
      if (this.activeTabId === id && !el.classList.contains("tab-hide")) {
        el.classList.add("tab-show");
      }
    });

    // хуки
    prev?.onHide?.();
    next.onShow?.();

    try {
      window.dispatchEvent(
        new CustomEvent("tabs:activated", { detail: { id } }),
      );
    } catch {}
  }
}
