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
    const status =
      item.reviewStatus && item.reviewStatus !== "valid"
        ? t(`batchReview.status.${item.reviewStatus}`)
        : "";
    meta.textContent = [
      `#${item.index}`,
      item.uploader,
      formatDuration(item.duration),
      status,
    ]
      .filter(Boolean)
      .join(" · ");
    copy.append(title, meta);
    row.append(checkbox, thumb, copy);
    container.appendChild(row);
  });
}

export { renderBatchReviewItems };
