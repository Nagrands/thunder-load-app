import {
  UI_STATE_KINDS,
  applyUiState,
  createUiStateController,
} from "../uiStateController.js";

describe("ui state controller", () => {
  test("exposes the canonical states", () => {
    expect(UI_STATE_KINDS).toEqual([
      "idle",
      "loading",
      "success",
      "warning",
      "error",
      "empty",
    ]);
  });

  test("renders loading progress and structural skeletons", () => {
    document.body.innerHTML = '<main id="root"><div id="content"></div></main>';
    const root = document.getElementById("root");
    const contentElement = document.getElementById("content");
    const controller = createUiStateController({ root, contentElement });

    controller.setState({
      kind: "loading",
      title: "Loading",
      operationId: "preview-7",
      skeletonLines: 3,
      progress: { mode: "determinate", value: 45, max: 100 },
    });

    expect(root.dataset.uiState).toBe("loading");
    expect(root.dataset.operationId).toBe("preview-7");
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(contentElement.hidden).toBe(true);
    expect(root.querySelectorAll(".ui-state__skeleton-line")).toHaveLength(3);
    expect(
      root.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow"),
    ).toBe("45");
  });

  test("renders actions and uses assertive errors", () => {
    document.body.innerHTML = '<main id="root"></main>';
    const root = document.getElementById("root");
    const onAction = jest.fn();
    const controller = createUiStateController({ root, onAction });
    controller.setState({
      kind: "error",
      title: "Failed",
      actions: [{ id: "retry", label: "Retry", primary: true }],
    });

    const state = root.querySelector(".ui-state");
    expect(state?.getAttribute("role")).toBe("alert");
    expect(state?.getAttribute("aria-live")).toBe("assertive");
    state
      ?.querySelector('[data-action="retry"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).toHaveBeenCalledWith(
      "retry",
      expect.objectContaining({ kind: "error" }),
    );
  });

  test("restores content and attributes on reset/dispose", () => {
    document.body.innerHTML = '<main id="root"><div id="content"></div></main>';
    const root = document.getElementById("root");
    const contentElement = document.getElementById("content");
    const controller = createUiStateController({ root, contentElement });
    controller.setState({ kind: "empty", message: "Nothing here" });
    controller.reset();
    expect(contentElement.hidden).toBe(false);
    expect(controller.element.hidden).toBe(true);
    controller.dispose();
    expect(root.hasAttribute("aria-busy")).toBe(false);
    expect(root.querySelector(".ui-state")).toBeNull();
  });

  test("applies the shared contract to existing status elements", () => {
    const element = document.createElement("div");
    applyUiState(element, { kind: "warning", operationId: "check-1" });
    expect(element.dataset.uiState).toBe("warning");
    expect(element.dataset.tone).toBe("warning");
    expect(element.dataset.operationId).toBe("check-1");
    expect(element.getAttribute("aria-busy")).toBe("false");
  });
});
