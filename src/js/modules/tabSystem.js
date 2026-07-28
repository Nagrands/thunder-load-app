// src/js/modules/tabSystem.js

import { readDeveloperModeEnabled } from "./developerMode.js";

export default class TabSystem {
  constructor(menuSel, viewSel) {
    this.menu = document.querySelector(menuSel);
    this.view = document.querySelector(viewSel);
    if (!this.menu || !this.view)
      throw new Error("TabSystem: containers not found");

    this.tabs = new Map();
    this.navigationProxies = new Set();
    this.activeTabId = null;
    this.ANIM_MS = 250; // длительность анимации (ms)
    // WG Unlock visibility wiring
    this._WG_ID = "wireguard";
    // Backup visibility wiring
    this._BK_ID = "backup";
    // Developer-only products tab
    this._PRD_ID = "products";
    this._NOW_PLAYING_ID = "now-playing";
    this._applyWgVisibility =
      this._applyWgVisibility?.bind(this) || this._applyWgVisibility;
    this._applyBackupVisibility =
      this._applyBackupVisibility?.bind(this) || this._applyBackupVisibility;
    this._applyProductsVisibility =
      this._applyProductsVisibility?.bind(this) ||
      this._applyProductsVisibility;
    window.addEventListener("wg:toggleDisabled", () =>
      this._applyWgVisibility(),
    );
    window.addEventListener("backup:toggleDisabled", () =>
      this._applyBackupVisibility(),
    );
    window.addEventListener("tools:developer-unlock-changed", () =>
      this._applyProductsVisibility(),
    );
    // применить сразу (если вкладка уже есть)
    this._applyWgVisibility();
    this._applyBackupVisibility();
    this._applyProductsVisibility();
  }

  _syncActiveTabLayoutState(id = "") {
    if (!this.view) return;
    this.view.dataset.activeTab = id || "";
    this.view.classList.toggle(
      "main-view--products-active",
      id === this._PRD_ID,
    );
    this.view.classList.toggle(
      "main-view--now-playing-active",
      id === this._NOW_PLAYING_ID,
    );
    document.body?.classList.toggle(
      "is-now-playing-active",
      id === this._NOW_PLAYING_ID,
    );
  }

  addTab(id, label, iconCls, renderCb, hooks = {}) {
    if (this.tabs.has(id)) return;
    const btn = document.createElement("button");
    btn.classList.add("menu-item");
    btn.type = "button";
    btn.id = `app-tab-${id}`;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", "false");
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
    if (id === this._PRD_ID) this._applyProductsVisibility();
    if (id === this._WG_ID) this._applyWgVisibility();
    if (id === this._BK_ID) this._applyBackupVisibility();
    this._syncNavigationProxies();
  }

  setTabLabel(id, label) {
    const rec = this.tabs.get(id);
    if (!rec?.labelEl) return;
    rec.label = label;
    rec.labelEl.textContent = label;
    this._syncNavigationProxies();
  }

  mountNavigationProxy(container, { excludeIds = [] } = {}) {
    if (!(container instanceof Element)) return () => {};
    const proxy = {
      container,
      excludeIds: new Set(excludeIds),
      buttons: new Map(),
      cleanups: new Map(),
    };
    this.navigationProxies.add(proxy);
    this._syncNavigationProxy(proxy);
    return () => {
      if (!this.navigationProxies.delete(proxy)) return;
      proxy.cleanups.forEach((cleanup) => cleanup());
      proxy.cleanups.clear();
      proxy.buttons.clear();
      container.replaceChildren();
    };
  }

  _syncNavigationProxy(proxy) {
    if (!proxy?.container?.isConnected && !proxy?.container) return;
    this.tabs.forEach((rec, id) => {
      if (proxy.excludeIds.has(id)) return;
      let button = proxy.buttons.get(id);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "now-playing__tab-link";
        button.dataset.tabTarget = id;
        button.dataset.bsToggle = "tooltip";
        button.dataset.bsPlacement = "bottom";
        const icon = document.createElement("i");
        icon.className = rec.iconCls;
        icon.setAttribute("aria-hidden", "true");
        button.appendChild(icon);
        const onClick = () => this.activateTab(id);
        button.addEventListener("click", onClick);
        proxy.cleanups.set(id, () =>
          button.removeEventListener("click", onClick),
        );
        proxy.buttons.set(id, button);
        proxy.container.appendChild(button);
      }
      const label = rec.label || rec.labelEl?.textContent || id;
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      button.hidden = rec.button?.style.display === "none";
      button.disabled = button.hidden;
    });
  }

  _syncNavigationProxies() {
    this.navigationProxies.forEach((proxy) =>
      this._syncNavigationProxy(proxy),
    );
  }

  activateTab(id) {
    if (id === this._PRD_ID && this._isProductsDisabled()) {
      const firstVisible = this._findFirstVisibleTabId(id);
      if (firstVisible) return this.activateTab(firstVisible);
      this._clearActiveTab();
      return;
    }
    // Guard: не позволяем активировать WG Unlock, если вкладка отключена
    if (id === this._WG_ID && this._isWgDisabled()) {
      const firstVisible = this._findFirstVisibleTabId(id);
      if (firstVisible) return this.activateTab(firstVisible);
      this._clearActiveTab();
      return; // нет доступных вкладок
    }
    // Guard: не позволяем активировать Backup, если вкладка отключена
    if (id === this._BK_ID && this._isBackupDisabled()) {
      const firstVisible = this._findFirstVisibleTabId(id);
      if (firstVisible) return this.activateTab(firstVisible);
      this._clearActiveTab();
      return; // нет доступных вкладок
    }
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
    this._syncNavigationProxies();
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
  _isWgDisabled() {
    try {
      const raw = localStorage.getItem("wgUnlockDisabled");
      // Дефолт: вкладка отключена, если ключ не задан
      if (raw === null) return true;
      return JSON.parse(raw) === true;
    } catch {
      return true;
    }
  }

  _isProductsDisabled() {
    return !readDeveloperModeEnabled();
  }

  _applyProductsVisibility() {
    const id = this._PRD_ID;
    if (!id || !this.tabs?.has(id)) return;
    const rec = this.tabs.get(id);
    const disabled = this._isProductsDisabled();

    if (rec.button) rec.button.style.display = disabled ? "none" : "";

    if (disabled && this.activeTabId === id) {
      const firstVisible = this._findFirstVisibleTabId(id);
      if (firstVisible) this.activateTab(firstVisible);
      else this._clearActiveTab();
    }

    if (rec.element && disabled) {
      rec.element.classList.remove("tab-show");
      rec.element.classList.add("tab-hide");
      rec.element.style.display = "none";
      rec.onHide?.();
    }
    this._syncNavigationProxies();
  }

  _applyWgVisibility() {
    const id = this._WG_ID;
    if (!id || !this.tabs?.has(id)) return;
    const rec = this.tabs.get(id);
    const disabled = this._isWgDisabled();

    // кнопка вкладки
    if (rec.button) rec.button.style.display = disabled ? "none" : "";

    // если активная вкладка скрывается — переключаемся на первую доступную
    if (disabled && this.activeTabId === id) {
      const firstVisible = this._findFirstVisibleTabId(id);
      if (firstVisible) this.activateTab(firstVisible);
      else this._clearActiveTab();
    }

    // скрываем/показываем сам контейнер вкладки (если уже отрендерен)
    if (rec.element) {
      if (disabled) {
        rec.element.classList.remove("tab-show");
        rec.element.classList.add("tab-hide");
        rec.element.style.display = "none";
        rec.onHide?.();
      } else {
        // не активируем автоматически; просто делаем доступной
        // контейнер отобразится при явной активации через activateTab()
      }
    }
    this._syncNavigationProxies();
  }

  _isBackupDisabled() {
    try {
      const raw = localStorage.getItem("backupDisabled");
      if (raw === null) return false; // по умолчанию Backup включён
      return JSON.parse(raw) === true;
    } catch {
      return false;
    }
  }

  _applyBackupVisibility() {
    const id = this._BK_ID;
    if (!id || !this.tabs?.has(id)) return;
    const rec = this.tabs.get(id);
    const disabled = this._isBackupDisabled();

    if (rec.button) rec.button.style.display = disabled ? "none" : "";

    if (disabled && this.activeTabId === id) {
      const firstVisible = this._findFirstVisibleTabId(id);
      if (firstVisible) this.activateTab(firstVisible);
      else this._clearActiveTab();
    }

    if (rec.element) {
      if (disabled) {
        rec.element.classList.remove("tab-show");
        rec.element.classList.add("tab-hide");
        rec.element.style.display = "none";
        rec.onHide?.();
      }
    }
    this._syncNavigationProxies();
  }

  _findFirstVisibleTabId(excludeId = null) {
    return Array.from(this.tabs.keys()).find((tid) => {
      if (tid === excludeId) return false;
      const r = this.tabs.get(tid);
      return r?.button && r.button.style.display !== "none";
    });
  }

  _clearActiveTab() {
    const prev = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    prev?.button?.classList.remove("active");
    prev?.button?.setAttribute("aria-selected", "false");
    if (prev?.button) prev.button.tabIndex = -1;
    if (prev?.element) {
      prev.element.classList.remove("tab-show");
      prev.element.classList.add("tab-hide");
      prev.element.style.display = "none";
      prev.onHide?.();
    }
    this.activeTabId = null;
    this._syncActiveTabLayoutState("");
    this._syncNavigationProxies();
  }
}
