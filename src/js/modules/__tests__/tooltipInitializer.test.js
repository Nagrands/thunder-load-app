import { initTooltips, disposeAllTooltips } from "../tooltipInitializer.js";

const setupBootstrapMock = () => {
  const instances = new Map();

  class MockTooltip {
    constructor(el, config = {}) {
      this._element = el;
      this._config = { ...config };
      this.tip = null;
      this.hide = jest.fn();
      this.dispose = jest.fn();
      this.setContent = jest.fn();
      this._isShown = jest.fn(() => true);
    }

    _queueCallback(callback) {
      if (typeof callback === "function") callback();
    }

    _leave() {
      return;
    }

    _isWithActiveTrigger(trigger) {
      return !!trigger;
    }

    static getOrCreateInstance(el, config = {}) {
      if (!instances.has(el)) {
        instances.set(el, new MockTooltip(el, config));
      }
      return instances.get(el);
    }

    static getInstance(el) {
      return instances.get(el) || null;
    }
  }

  MockTooltip.instances = instances;
  MockTooltip.getOrCreateInstance = jest.fn(MockTooltip.getOrCreateInstance);
  MockTooltip.getInstance = jest.fn(MockTooltip.getInstance);

  const bootstrap = {
    Tooltip: MockTooltip,
    Popover: class MockPopover {
      static getOrCreateInstance() {
        return {
          hide: jest.fn(),
        };
      }
    },
  };

  window.bootstrap = bootstrap;
  global.bootstrap = bootstrap;

  return { MockTooltip, instances };
};

describe("tooltipInitializer", () => {
  afterEach(() => {
    disposeAllTooltips({ force: true });
    document.body.innerHTML = "";
    delete window.bootstrap;
    delete global.bootstrap;
    jest.clearAllMocks();
  });

  test("repeated initTooltips does not duplicate tooltip instances", () => {
    const { MockTooltip } = setupBootstrapMock();
    document.body.innerHTML =
      '<button id="a" data-bs-toggle="tooltip" title="Alpha"></button>';

    initTooltips(document);
    initTooltips(document);

    expect(MockTooltip.getOrCreateInstance).toHaveBeenCalledTimes(1);
  });

  test("updates tooltip content when title changes", () => {
    const { instances } = setupBootstrapMock();
    document.body.innerHTML =
      '<button id="a" data-bs-toggle="tooltip" title="Alpha"></button>';

    const btn = document.getElementById("a");
    initTooltips(document);

    btn.setAttribute("title", "Beta");
    initTooltips(document);

    const instance = instances.get(btn);
    expect(instance.setContent).toHaveBeenCalledWith({
      ".tooltip-inner": "Beta",
    });
  });

  test("fallback title update without setContent does not force dispose", () => {
    const { instances } = setupBootstrapMock();
    document.body.innerHTML =
      '<button id="a" data-bs-toggle="tooltip" title="Alpha"></button>';

    const btn = document.getElementById("a");
    initTooltips(document);

    const instance = instances.get(btn);
    instance.setContent = undefined;
    instance.dispose.mockClear();

    btn.setAttribute("title", "Gamma");
    initTooltips(document);

    expect(btn.getAttribute("data-bs-original-title")).toBe("Gamma");
    expect(instance.dispose).not.toHaveBeenCalled();
  });

  test("keeps tooltip when Bootstrap stores text in data-bs-original-title", () => {
    const { instances } = setupBootstrapMock();
    document.body.innerHTML =
      '<button id="a" data-bs-toggle="tooltip" title="Alpha"></button>';

    const btn = document.getElementById("a");
    initTooltips(document);

    btn.removeAttribute("title");
    btn.setAttribute("data-bs-original-title", "Alpha");

    const instance = instances.get(btn);
    instance.dispose.mockClear();
    initTooltips(document);

    expect(instance.dispose).not.toHaveBeenCalled();
    expect(btn.dataset.tooltipTitle).toBe("Alpha");
  });

  test("cleanup removes disconnected elements from active tooltip map", () => {
    const { instances } = setupBootstrapMock();
    document.body.innerHTML =
      '<button id="a" data-bs-toggle="tooltip" title="Alpha"></button>';

    const btn = document.getElementById("a");
    initTooltips(document);

    const instance = instances.get(btn);
    btn.remove();
    initTooltips(document);

    expect(instance.hide).toHaveBeenCalled();
  });

  test("body click hides shown tooltips", () => {
    const { instances } = setupBootstrapMock();
    document.body.innerHTML =
      '<button id="a" data-bs-toggle="tooltip" title="Alpha"></button>';

    const btn = document.getElementById("a");
    initTooltips(document);

    const instance = instances.get(btn);
    instance.hide.mockClear();
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(instance.hide).toHaveBeenCalled();
  });
});
