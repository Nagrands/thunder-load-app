const getRowNode = (markup) => {
  const template = document.createElement("template");
  template.innerHTML = String(markup || "").trim();
  return template.content.firstElementChild;
};

const patchProgress = (row, data) => {
  const progress = Math.max(0, Math.min(100, Number(data.progress) || 0));
  const progressLabel = row.querySelector("[data-queue-progress-label]");
  const stageLabel = row.querySelector("[data-queue-stage-label]");
  const stageChip = row.querySelector("[data-queue-stage-chip]");
  const etaLabel = row.querySelector("[data-queue-eta-label]");
  const progressBar = row.querySelector("[data-queue-progress-bar]");
  const progressTrack = row.querySelector("[data-queue-progress-track]");
  const metrics = row.querySelector("[data-queue-metrics]");
  if (progressLabel) progressLabel.textContent = data.progressLabel || "";
  if (stageLabel) stageLabel.textContent = data.stageLabel || "";
  if (stageChip) {
    stageChip.textContent = data.stageChipLabel || "";
    stageChip.classList.toggle("hidden", !data.stageChipLabel);
  }
  if (etaLabel) etaLabel.textContent = data.etaLabel || "";
  if (progressBar) progressBar.style.width = `${progress}%`;
  if (progressTrack) progressTrack.setAttribute("aria-valuenow", String(progress));
  if (metrics) {
    metrics.textContent = data.metricsLabel || "";
    metrics.classList.toggle("hidden", !data.metricsLabel);
  }
};

function createIncrementalQueueRenderer(container) {
  let list = null;
  const rowsById = new Map();

  const reset = (markup) => {
    container.innerHTML = markup;
    list = null;
    rowsById.clear();
  };

  const render = ({ rows, emptyMarkup }) => {
    if (!rows.length) {
      reset(emptyMarkup);
      return;
    }
    if (!list || !list.isConnected) {
      reset('<div class="queue-sections" aria-live="off"></div>');
      list = container.querySelector(".queue-sections");
    }
    const nextIds = new Set(rows.map((row) => row.id));
    for (const [id, node] of rowsById) {
      if (nextIds.has(id)) continue;
      node.remove();
      rowsById.delete(id);
    }
    for (const rowData of rows) {
      let row = rowsById.get(rowData.id);
      if (!row || row.dataset.queueStructure !== rowData.structureKey) {
        const replacement = getRowNode(rowData.markup);
        replacement.dataset.queueStructure = rowData.structureKey;
        if (row) row.replaceWith(replacement);
        row = replacement;
        rowsById.set(rowData.id, row);
      }
      patchProgress(row, rowData);
      const section = rowData.section || "pending";
      let sectionList = list.querySelector(`[data-queue-section-list="${section}"]`);
      if (!sectionList) {
        const wrapper = document.createElement("section");
        wrapper.className = `queue-section queue-section--${section}`;
        wrapper.dataset.queueSection = section;
        wrapper.innerHTML = `<header class="queue-section__header"><h4>${rowData.sectionLabel || section}</h4><span>${rowData.sectionCount || 0}</span></header><ul role="list" class="queue-items" data-queue-section-list="${section}"></ul>`;
        list.appendChild(wrapper);
        sectionList = wrapper.querySelector("[data-queue-section-list]");
      } else {
        const count = sectionList.parentElement?.querySelector(
          ".queue-section__header span",
        );
        if (count) count.textContent = String(rowData.sectionCount || 0);
      }
      sectionList.appendChild(row);
    }
    list.querySelectorAll("[data-queue-section]").forEach((section) => {
      if (!section.querySelector("[data-job-id]")) section.remove();
    });
    ["active", "pending", "error"].forEach((sectionName) => {
      const section = list.querySelector(
        `[data-queue-section="${sectionName}"]`,
      );
      if (section) list.appendChild(section);
    });
  };

  const updateProgress = (id, data) => {
    const row = rowsById.get(id);
    if (!row) return false;
    patchProgress(row, data);
    return true;
  };

  return { render, reset, updateProgress };
}

export { createIncrementalQueueRenderer };
