function formatDuration(value) {
  const seconds = Math.max(0, Number(value) || 0);
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function renderBatchReviewItems({ container, items, selected, emptyKey, t }) {
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "batch-review-modal__empty";
    empty.textContent = t(emptyKey);
    container.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("label");
    row.className = "batch-review-item";
    row.setAttribute("role", "listitem");
    row.classList.toggle("is-unavailable", !item.available);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.has(item.id);
    checkbox.disabled = !item.available;
    checkbox.dataset.itemId = item.id;
    const thumb = document.createElement("span");
    thumb.className = "batch-review-item__thumb";
    const fallback = document.createElement("i");
    fallback.className =
      item.metadataPending && !item.thumbnail
        ? "fa-solid fa-circle-notch fa-spin"
        : "fa-solid fa-film";
    fallback.setAttribute("aria-hidden", "true");
    thumb.appendChild(fallback);
    if (item.thumbnail) {
      const image = document.createElement("img");
      image.src = item.thumbnail;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => image.remove());
      thumb.appendChild(image);
    }
    const copy = document.createElement("span");
    copy.className = "batch-review-item__copy";
    const title = document.createElement("strong");
    title.textContent = item.title || item.url;
    const meta = document.createElement("small");
    const status = item.metadataPending
      ? t("batchReview.status.loading")
      : item.metadataFailed
        ? t("batchReview.status.metadataFailed")
        : item.reviewStatus && item.reviewStatus !== "valid"
          ? t(`batchReview.status.${item.reviewStatus}`)
          : "";
    const badgeKind = item.metadataPending
      ? "loading"
      : item.metadataFailed
        ? "metadata-failed"
        : item.reviewStatus;
    meta.textContent = [
      `#${item.index}`,
      item.uploader,
      formatDuration(item.duration),
    ]
      .filter(Boolean)
      .join(" · ");
    const metaLine = document.createElement("span");
    metaLine.className = "batch-review-item__meta";
    metaLine.appendChild(meta);
    if (status) {
      const badge = document.createElement("span");
      badge.className = `batch-review-item__badge batch-review-item__badge--${badgeKind}`;
      badge.textContent = status;
      metaLine.appendChild(badge);
    }
    copy.append(title, metaLine);
    row.classList.toggle("is-loading", Boolean(item.metadataPending));
    row.classList.toggle("is-selected", checkbox.checked);
    if (item.metadataPending) row.setAttribute("aria-busy", "true");
    row.append(checkbox, thumb, copy);
    container.appendChild(row);
  });
}

export { renderBatchReviewItems };
