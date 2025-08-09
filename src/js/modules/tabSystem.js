// src/js/modules/tabSystem.js  (v5.1 – фикс двойных классов)
// Исправлено: при повторном показе вкладки её элемент очищает класс tab-hide,
// иначе opacity остаётся 0 и экран кажется пустым.

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

  addTab(id, label, iconCls, renderCb, hooks = {}) {
    if (this.tabs.has(id)) return;
    const btn = document.createElement("button");
    btn.classList.add("menu-item");
    btn.dataset.menu = id;
    btn.dataset.tabgen = "true";
    btn.innerHTML = `
      <span class="menu-main">
        <i class="${iconCls}"></i>
        <span class="menu-text">${label}</span>
      </span>`;
    btn.addEventListener("click", () => this.activateTab(id));

    const anchor = Array.from(this.menu.children).find(
      (el) => !el.dataset.tabgen,
    );
    anchor ? this.menu.insertBefore(btn, anchor) : this.menu.appendChild(btn);

    this.tabs.set(id, { button: btn, render: renderCb, ...hooks });
  }

  activateTab(id) {
    if (!this.tabs.has(id) || id === this.activeTabId) return;

    const next = this.tabs.get(id);
    const prev = this.activeTabId ? this.tabs.get(this.activeTabId) : null;

    prev?.button.classList.remove("active");
    next.button.classList.add("active");

    // создаём view один раз
    if (!next.element) {
      const rendered = next.render?.() || document.createElement("div");
      rendered.dataset.tabId = id;
      rendered.classList.add("tab-view");
      this.view.appendChild(rendered);
      next.element = rendered;
    } else {
      if (
        next.element.childNodes.length === 0 &&
        typeof next.render === "function"
      ) {
        const content = next.render();
        if (content instanceof HTMLElement) {
          next.element.appendChild(content);
        }
      }
    }

    // скрываем предыдущий с fade‑out
    if (prev?.element) {
      prev.element.classList.remove("tab-show");
      prev.element.classList.add("tab-hide");
      setTimeout(() => {
        prev.element.style.display = "none";
      }, this.ANIM_MS);
    }

    // показываем следующий
    const el = next.element;
    el.style.display = "";
    el.classList.remove("tab-hide"); //  <<<  важно!
    // небольшая пауза – чтобы transition сработал
    requestAnimationFrame(() => el.classList.add("tab-show"));

    // хуки
    prev?.onHide?.();
    next.onShow?.();

    this.activeTabId = id;
  }
}
