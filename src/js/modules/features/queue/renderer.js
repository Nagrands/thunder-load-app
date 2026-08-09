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
  if (progressLabel) progressLabel.textContent = data.progressLabel || "";
  if (stageLabel) stageLabel.textContent = data.stageLabel || "";
  if (stageChip) {
    stageChip.textContent = data.stageChipLabel || "";
    stageChip.classList.toggle("hidden", !data.stageChipLabel);
  }
  if (etaLabel) etaLabel.textContent = data.etaLabel || "";
  if (progressBar) progressBar.style.width = `${progress}%`;
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
      reset('<ul role="list" class="queue-items" aria-live="off"></ul>');
      list = container.querySelector(".queue-items");
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
      list.appendChild(row);
    }
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
