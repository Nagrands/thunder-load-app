// src/js/modules/randomizer/ui/items.js

import { DEFAULT_WEIGHT, WEIGHT_MIN, WEIGHT_MAX } from "../helpers.js";

const RARE_STREAK = 5;

export function createItemsRenderer({
  getState,
  listEl,
  getSelected,
  onUpdateCount,
  onUpdateBulk,
  onUpdatePoolHint,
  onUpdateSummary,
  onUpdateVisuals,
  onSelectToggle,
  onRemoveSelected,
  onReplaceItem,
  onMoveItem,
  onSyncWeight,
  onStartInlineEdit,
  onToggleFavorite,
  onToggleExclude,
  favoritesOnly = false,
}) {
  const debounce = (fn, delay = 50) => {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  const throttle = (fn, delay = 50) => {
    let last = 0;
    let queued = null;
    return (...args) => {
      const now = Date.now();
      if (now - last >= delay) {
        last = now;
        fn(...args);
      } else {
        queued = args;
        setTimeout(
          () => {
            if (queued) {
              last = Date.now();
              fn(...queued);
              queued = null;
            }
          },
          delay - (now - last),
        );
      }
    };
  };

  const getItemWeight = (item) =>
    onSyncWeight?.clamp(item?.weight ?? DEFAULT_WEIGHT);
  const getItemHits = (item) => onSyncWeight?.clampHits(item?.hits ?? 0);
  const getItemMisses = (item) => Math.max(0, Math.floor(item?.misses ?? 0));

  const renderItemsDebounced = debounce(() => renderItems(), 40);
  const onMoveThrottled = throttle((from, to) => onMoveItem(from, to), 60);
  const setDragState = (active) => {
    if (!listEl) return;
    listEl.classList.toggle("drag-active", !!active);
  };
  const updateProbabilities = () => {
    const { items, pool, settings } = getState();
    const poolEntries = Array.isArray(pool) ? pool : [];
    const poolCounts = poolEntries.reduce((acc, value) => {
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
    const totalWeight = items.reduce((sum, item) => {
      const available =
        !settings?.noRepeat || (poolCounts[item.value] || 0) > 0;
      return available ? sum + getItemWeight(item) : sum;
    }, 0);
    if (!listEl) return;
    listEl.querySelectorAll(".randomizer-chip").forEach((chip) => {
      const value = chip.dataset.value;
      const item = items.find((entry) => entry.value === value);
      if (!item) return;
      const inPoolCount = poolCounts[value] || 0;
      const isDepleted = settings?.noRepeat && inPoolCount === 0;
      const probability =
        totalWeight > 0 && !isDepleted
          ? (getItemWeight(item) / totalWeight) * 100
          : 0;
      const label = chip.querySelector(".chip-prob-label");
      if (label) {
        label.textContent = `Вероятность: ${
          probability >= 10 ? probability.toFixed(0) : probability.toFixed(1)
        }%`;
      }
      const bar = chip.querySelector(".chip-prob-bar");
      if (bar) {
        const barWidth =
          probability > 0 ? Math.min(100, Math.max(probability, 6)) : 0;
        bar.style.width = `${barWidth}%`;
      }
    });
  };

  return function renderItems() {
    const { items, pool, settings } = getState();
    const onlyFav =
      typeof favoritesOnly === "function" ? favoritesOnly() : favoritesOnly;
    const visibleItems = onlyFav
      ? items.filter((item) => item.favorite)
      : items;
    const poolEntries = Array.isArray(pool) ? pool : [];
    const poolCounts = poolEntries.reduce((acc, value) => {
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
    const totalWeight = items.reduce((sum, item) => {
      const inPoolCount = poolCounts[item.value] || 0;
      const available =
        !item.excluded &&
        (!settings?.noRepeat || (inPoolCount > 0 && !item.excluded));
      return available ? sum + getItemWeight(item) : sum;
    }, 0);
    const selected = getSelected ? getSelected() : new Set();
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!visibleItems.length) {
      const empty = document.createElement("p");
      empty.className = "placeholder";
      empty.textContent = onlyFav
        ? "Нет избранных элементов. Отметьте ★ нужные варианты."
        : "Пока нет вариантов. Добавьте несколько элементов.";
      listEl.appendChild(empty);
      onUpdateCount();
      onUpdateBulk();
      return;
    }

    const fragment = document.createDocumentFragment();
    let dragSource = null;

    visibleItems.forEach((item) => {
      const chip = document.createElement("div");
      chip.className = "randomizer-chip";
      chip.dataset.value = item.value;
      chip.draggable = false;

      const chipMain = document.createElement("div");
      chipMain.className = "chip-main";

      const dragHandle = document.createElement("button");
      dragHandle.type = "button";
      dragHandle.className = "chip-drag-handle";
      dragHandle.setAttribute("aria-label", "Перетащить вариант");
      dragHandle.innerHTML = '<i class="fa-solid fa-grip-lines"></i>';
      dragHandle.draggable = true;

      const textWrap = document.createElement("div");
      textWrap.className = "chip-text";
      const text = document.createElement("span");
      text.className = "text";
      text.textContent = item.value;
      textWrap.appendChild(text);

      const weightWrap = document.createElement("div");
      weightWrap.className = "chip-weight";

      const weightNumber = document.createElement("input");
      weightNumber.type = "number";
      weightNumber.min = WEIGHT_MIN;
      weightNumber.max = WEIGHT_MAX;
      weightNumber.step = 1;
      weightNumber.value = getItemWeight(item);
      weightNumber.className = "chip-weight-number";

      const weightLabel = document.createElement("span");
      weightLabel.className = "chip-weight-label";
      weightLabel.textContent = `x${getItemWeight(item)}`;

      const weightPresets = document.createElement("div");
      weightPresets.className = "chip-weight-presets";
      [1, 2, 3, 5, 10].forEach((val) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip-weight-pill";
        btn.textContent = `x${val}`;
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          syncWeight(val);
        });
        weightPresets.appendChild(btn);
      });

      const statWrap = document.createElement("div");
      statWrap.className = "chip-stats";
      const hitsEl = document.createElement("span");
      hitsEl.className = "chip-stat";
      hitsEl.textContent = `Выпадений: ${getItemHits(item)}`;
      const inPoolCount = poolCounts[item.value] || 0;
      const isDepleted = settings?.noRepeat && inPoolCount === 0;
      const misses = getItemMisses(item);
      const poolEl = document.createElement("span");
      poolEl.className = "chip-stat";
      poolEl.textContent = settings.noRepeat
        ? `В пуле: ${inPoolCount}`
        : "В пуле: ∞";
      const missesEl = document.createElement("span");
      missesEl.className = "chip-stat";
      missesEl.textContent = `Не выпадал: ${misses}`;
      if (!isDepleted && misses >= RARE_STREAK) {
        missesEl.classList.add("rare");
      }
      statWrap.append(hitsEl, poolEl, missesEl);

      const probability =
        totalWeight > 0 && !isDepleted
          ? (getItemWeight(item) / totalWeight) * 100
          : 0;
      const probLabel = document.createElement("span");
      probLabel.className = "chip-stat chip-prob-label";
      probLabel.textContent = `Вероятность: ${
        probability >= 10 ? probability.toFixed(0) : probability.toFixed(1)
      }%`;

      const probTrack = document.createElement("div");
      probTrack.className = "chip-prob-track";
      const probBar = document.createElement("div");
      probBar.className = "chip-prob-bar";
      const barWidth =
        probability > 0 ? Math.min(100, Math.max(probability, 6)) : 0;
      probBar.style.width = `${barWidth}%`;
      probTrack.appendChild(probBar);

      const probWrap = document.createElement("div");
      probWrap.className = "chip-prob";
      probWrap.append(probLabel, probTrack);

      const syncWeight = (nextWeight) => {
        const sanitized = onSyncWeight?.clamp(nextWeight);
        if (!onSyncWeight || sanitized === getItemWeight(item)) {
          weightNumber.value = sanitized;
          weightLabel.textContent = `x${sanitized}`;
          return;
        }
        onSyncWeight.set(item.value, sanitized);
        weightNumber.value = sanitized;
        weightLabel.textContent = `x${sanitized}`;
        renderItemsDebounced();
        updateProbabilities();
      };

      const stopChipEvent = (event) => event.stopPropagation();
      weightNumber.addEventListener("click", stopChipEvent);
      weightNumber.addEventListener("input", (event) => {
        event.stopPropagation();
        syncWeight(event.target.value);
      });
      weightLabel.addEventListener("click", stopChipEvent);
      weightWrap.append(weightNumber, weightPresets);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.setAttribute("aria-label", `Удалить ${item.value}`);
      remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      remove.addEventListener("click", () => {
        onRemoveSelected(new Set([item.value]), { silent: true });
      });

      const quick = document.createElement("div");
      quick.className = "chip-quick";
      const favBtn = document.createElement("button");
      favBtn.type = "button";
      favBtn.className = "chip-quick-btn";
      favBtn.setAttribute("aria-label", "Избранное");
      const favIcon = document.createElement("i");
      favIcon.className = item.favorite
        ? "fa-solid fa-star"
        : "fa-regular fa-star";
      favBtn.appendChild(favIcon);
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = onToggleFavorite(item.value);
        favIcon.className = next ? "fa-solid fa-star" : "fa-regular fa-star";
        chip.classList.toggle("is-favorite", next);
        onUpdateVisuals?.();
        renderItemsDebounced();
      });

      const excludeBtn = document.createElement("button");
      excludeBtn.type = "button";
      excludeBtn.className = "chip-quick-btn";
      excludeBtn.setAttribute("aria-label", "Исключить из пула");
      const excludeIcon = document.createElement("i");
      excludeIcon.className = item.excluded
        ? "fa-solid fa-eye-slash"
        : "fa-solid fa-eye";
      excludeBtn.appendChild(excludeIcon);
      excludeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = onToggleExclude(item.value);
        excludeIcon.className = next
          ? "fa-solid fa-eye-slash"
          : "fa-solid fa-eye";
        chip.classList.toggle("is-excluded", next);
        onUpdateSummary?.();
        onUpdatePoolHint?.();
        onUpdateVisuals?.();
        renderItemsDebounced();
      });

      quick.append(favBtn, excludeBtn, remove);

      chipMain.append(dragHandle, textWrap, weightLabel, quick);
      chip.append(chipMain, weightWrap, statWrap, probWrap);

      chip.addEventListener("click", (event) => {
        if (event.detail > 1) return;
        if (event.target.closest(".chip-remove")) return;
        if (event.target.classList.contains("chip-edit-input")) return;
        onSelectToggle(item.value, chip);
      });

      chip.addEventListener("dblclick", () =>
        onStartInlineEdit(chip, item.value),
      );

      chip.addEventListener("dragover", (event) => {
        if (!dragSource || dragSource === item.value) return;
        event.preventDefault();
        chip.classList.add("drop-target");
      });

      chip.addEventListener("dragleave", () => {
        chip.classList.remove("drop-target");
      });

      chip.addEventListener("drop", (event) => {
        event.preventDefault();
        chip.classList.remove("drop-target");
        if (!dragSource || dragSource === item.value) return;
        onMoveThrottled(dragSource, item.value);
      });

      dragHandle.addEventListener("click", (event) => event.stopPropagation());
      dragHandle.addEventListener("dragstart", (event) => {
        dragSource = item.value;
        chip.classList.add("dragging");
        setDragState(true);
        event.dataTransfer?.setData("text/plain", item.value);
        event.dataTransfer?.setDragImage(chip, 10, 10);
      });

      dragHandle.addEventListener("dragend", () => {
        dragSource = null;
        chip.classList.remove("dragging");
        chip.classList.remove("drop-target");
        setDragState(false);
      });

      if (item.favorite) chip.classList.add("is-favorite");
      if (item.excluded) chip.classList.add("is-excluded");
      if (isDepleted) {
        chip.classList.add("is-depleted");
        chip.dataset.depleted = "1";
      } else if (misses >= RARE_STREAK) {
        chip.classList.add("is-rare");
      }
      if (selected.has(item.value)) chip.classList.add("selected");
      fragment.appendChild(chip);
    });

    listEl.appendChild(fragment);
    onUpdateCount();
    onUpdateBulk();
    onUpdatePoolHint();
    onUpdateSummary();
    updateProbabilities();
  };
}
