const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const imageMarkup = (item) =>
  item.thumbnail
    ? `<img class="queue-card__thumbnail" src="${escapeHtml(item.thumbnail)}" alt="" loading="lazy" data-queue-thumbnail>`
    : `<span class="queue-card__thumbnail-fallback" aria-hidden="true">${escapeHtml(item.sourceShort || "S")}</span>`;

const actionButton = (action, icon, label, options = {}) =>
  `<button type="button" class="queue-card__action${options.danger ? " is-danger" : ""}" data-queue-action="${action}"${action === "cancel" ? ' data-queue-cancel-job="1"' : ""}${action === "start" ? ' data-queue-start-job="1"' : ""}${action === "retry" ? ' data-queue-retry-failed="1"' : ""}${action === "remove-error" ? ' data-queue-remove-failed="1"' : ""}${action === "open-recovery" ? ' data-queue-open-recovery="1"' : ""}${action === "reveal-recovery" ? ' data-queue-reveal-recovery="1"' : ""} data-job-id="${escapeHtml(options.id)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"${options.disabled ? ' disabled aria-disabled="true"' : ""}><i data-lucide="${icon}"></i></button>`;

function createActiveCardMarkup(item) {
  return `<li class="queue-card queue-item queue-card--active" role="listitem" data-job-id="${escapeHtml(item.id)}">
    ${imageMarkup(item)}
    <div class="queue-card__content">
      <div class="queue-card__heading"><strong class="queue-card__title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</strong><span class="queue-card__percent" data-queue-progress-label>${escapeHtml(item.progressLabel)}</span></div>
      <div class="queue-card__meta"><span>${escapeHtml(item.source)}</span><span class="queue-quality-chip">${escapeHtml(item.kindQuality)}</span><span data-queue-stage-label>${escapeHtml(item.stageLabel)}</span><span class="queue-status-chip" hidden>${escapeHtml(item.progressLabel)}</span></div>
      <div class="queue-card__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${item.progress}" aria-label="${escapeHtml(item.progressAria)}" data-queue-progress-track><span data-queue-progress-bar style="width:${item.progress}%"></span></div>
      <div class="queue-card__metrics" data-queue-metrics${item.metricsLabel ? "" : " hidden"}>${escapeHtml(item.metricsLabel)}</div>
    </div>
    <div class="queue-card__actions">${actionButton("cancel", "square-x", item.cancelLabel, { id: item.id, disabled: item.cancelling, danger: true })}</div>
  </li>`;
}

function createPendingCardMarkup(item) {
  return `<li class="queue-card queue-item queue-card--pending" role="listitem" data-job-id="${escapeHtml(item.id)}" data-queue-pending-index="${item.pendingIndex}" tabindex="0" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown">
    <button type="button" class="queue-card__grip" draggable="true" data-queue-drag-handle="1" data-job-id="${escapeHtml(item.id)}" title="${escapeHtml(item.dragLabel)}" aria-label="${escapeHtml(item.dragLabel)}"><i data-lucide="grip-vertical"></i></button>
    ${imageMarkup(item)}
    <div class="queue-card__content"><strong class="queue-card__title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</strong><div class="queue-card__meta"><span>${escapeHtml(item.source)}</span><span class="queue-quality-chip">${escapeHtml(item.kindQuality)}</span><span class="queue-status-chip">${escapeHtml(item.pausedLabel || item.pendingLabel)}</span></div></div>
    <div class="queue-card__actions">
      ${actionButton("start", "play", item.startLabel, { id: item.id })}
      ${actionButton("menu", "more-vertical", item.menuLabel, { id: item.id })}
    </div>
  </li>`;
}

function createErrorCardMarkup(item) {
  const secondary = item.secondaryAction
    ? `<button type="button" class="queue-card__text-action" data-queue-action="${item.secondaryAction.id}" data-job-id="${escapeHtml(item.id)}">${escapeHtml(item.secondaryAction.label)}</button>`
    : "";
  const retry = item.retryLabel
    ? `<button type="button" class="queue-card__text-action is-primary" data-queue-action="retry" data-queue-retry-failed="1" data-job-id="${escapeHtml(item.id)}" title="${escapeHtml(item.retryLabel)}" aria-label="${escapeHtml(item.retryLabel)}"${item.retryable ? "" : " disabled"}>${escapeHtml(item.retryLabel)}</button>`
    : "";
  const recovery = item.historyRecovery
    ? `${actionButton("open-recovery", "play", item.openLabel, { id: item.id })}${actionButton("reveal-recovery", "folder-open", item.revealLabel, { id: item.id })}`
    : "";
  return `<li class="queue-card queue-item queue-card--error" role="listitem" data-job-id="${escapeHtml(item.id)}">
    <span class="queue-card__error-icon" aria-hidden="true"><i data-lucide="triangle-alert"></i></span>
    <div class="queue-card__content"><strong class="queue-card__title">${escapeHtml(item.reasonLabel)}</strong><p class="queue-card__error-detail">${escapeHtml(item.errorMessage)}</p><div class="queue-card__meta"><span>${escapeHtml(item.title)}</span><span class="queue-quality-chip">${escapeHtml(item.kindQuality)}</span>${item.retryDelay ? `<span>${escapeHtml(item.retryDelay)}</span>` : ""}</div></div>
    <div class="queue-card__error-actions queue-item-actions">${recovery}${secondary}${retry}${actionButton("remove-error", "x", item.removeLabel, { id: item.id })}</div>
  </li>`;
}

function createQueueCardMarkup(item) {
  if (item.group === "active") return createActiveCardMarkup(item);
  if (item.group === "error") return createErrorCardMarkup(item);
  return createPendingCardMarkup(item);
}

export { createQueueCardMarkup };
