import { createIncrementalQueueRenderer } from "../features/queue/renderer.js";

const createRow = ({ id, progress = 0, title = "Job" }) => ({
  id,
  structureKey: `${id}:${title}`,
  progress,
  progressLabel: `Downloading ${progress}%`,
  stageLabel: " · Downloading",
  stageChipLabel: "Downloading",
  etaLabel: " · 0:10",
  markup: `<li class="queue-item" data-job-id="${id}">
    <strong>${title}</strong>
    <span data-queue-progress-label></span>
    <span data-queue-stage-label></span>
    <span data-queue-stage-chip></span>
    <span data-queue-eta-label></span>
    <span data-queue-progress-bar></span>
  </li>`,
});

describe("incremental queue renderer", () => {
  test("keeps the row node and patches only progress fields", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const renderer = createIncrementalQueueRenderer(container);
    renderer.render({ rows: [createRow({ id: "job-1", progress: 10 })] });
    const firstNode = container.querySelector(".queue-item");

    renderer.render({ rows: [createRow({ id: "job-1", progress: 64 })] });

    expect(container.querySelector(".queue-item")).toBe(firstNode);
    expect(
      firstNode.querySelector("[data-queue-progress-label]").textContent,
    ).toBe("Downloading 64%");
    expect(
      firstNode.querySelector("[data-queue-progress-bar]").style.width,
    ).toBe("64%");
    expect(
      container.querySelector(".queue-items").getAttribute("aria-live"),
    ).toBe("off");
  });

  test("replaces a row when its structural content changes", () => {
    const container = document.createElement("div");
    const renderer = createIncrementalQueueRenderer(container);
    renderer.render({ rows: [createRow({ id: "job-1", title: "First" })] });
    const firstNode = container.querySelector(".queue-item");
    renderer.render({ rows: [createRow({ id: "job-1", title: "Renamed" })] });
    expect(container.querySelector(".queue-item")).not.toBe(firstNode);
  });
});
