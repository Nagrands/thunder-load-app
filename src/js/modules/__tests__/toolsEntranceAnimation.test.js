import {
  ACTIVE_CLASS,
  CARD_CLASS,
  HEADER_CLASS,
  INDEX_PROPERTY,
  ITEM_CLASS,
  PREPARED_CLASS,
  SECONDARY_HEADER_CLASS,
  createToolsEntranceAnimation,
} from "../views/tools/toolsEntranceAnimation.js";

function renderEntranceFixture() {
  document.body.innerHTML = `
    <div id="tools-view">
      <div data-ui="tools-entrance-root">
        <header data-ui="tools-entrance-header">Primary header</header>
        <div data-ui="tools-entrance-header">Secondary header</div>
        <section class="tools-launcher-grid">
          <button data-ui="tools-launcher-card">One</button>
          <button data-ui="tools-launcher-card" class="hidden">Hidden</button>
          <button data-ui="tools-launcher-card">Two</button>
        </section>
        <section class="hidden">
          <button data-ui="tools-launcher-card">Hidden by parent</button>
        </section>
      </div>
    </div>
  `;
  return document.getElementById("tools-view");
}

describe("createToolsEntranceAnimation", () => {
  let rafCallbacks;

  beforeEach(() => {
    jest.useFakeTimers();
    rafCallbacks = new Map();
    let nextRafId = 1;
    window.requestAnimationFrame = jest.fn((callback) => {
      const id = nextRafId++;
      rafCallbacks.set(id, callback);
      return id;
    });
    window.cancelAnimationFrame = jest.fn((id) => {
      rafCallbacks.delete(id);
    });
    window.matchMedia = jest.fn(() => ({ matches: false }));
    document.body.className = "";
    document.documentElement.className = "";
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  const runNextFrame = () => {
    const [id, callback] = rafCallbacks.entries().next().value;
    rafCallbacks.delete(id);
    callback();
  };

  test("prepares visible headers and cards in DOM order", () => {
    const view = renderEntranceFixture();
    const animation = createToolsEntranceAnimation(view);

    expect(animation.prepare()).toBe(true);

    const root = view.querySelector('[data-ui="tools-entrance-root"]');
    const headers = root.querySelectorAll('[data-ui="tools-entrance-header"]');
    const cards = root.querySelectorAll('[data-ui="tools-launcher-card"]');
    expect(root.classList.contains(PREPARED_CLASS)).toBe(true);
    expect(headers[0].classList).toContain(ITEM_CLASS);
    expect(headers[0].classList).toContain(HEADER_CLASS);
    expect(headers[0].classList).not.toContain(SECONDARY_HEADER_CLASS);
    expect(headers[1].classList).toContain(SECONDARY_HEADER_CLASS);
    expect(cards[0].classList).toContain(CARD_CLASS);
    expect(cards[0].style.getPropertyValue(INDEX_PROPERTY)).toBe("0");
    expect(cards[1].classList).not.toContain(CARD_CLASS);
    expect(cards[2].style.getPropertyValue(INDEX_PROPERTY)).toBe("1");
    expect(cards[3].classList).not.toContain(CARD_CLASS);
  });

  test("caps stagger indices for long card lists", () => {
    const view = renderEntranceFixture();
    const grid = view.querySelector(".tools-launcher-grid");
    grid.replaceChildren(
      ...Array.from({ length: 7 }, (_, index) => {
        const card = document.createElement("button");
        card.dataset.ui = "tools-launcher-card";
        card.textContent = String(index);
        return card;
      }),
    );
    const animation = createToolsEntranceAnimation(view, {
      maxStaggerIndex: 3,
    });

    animation.prepare();

    const indices = Array.from(
      grid.querySelectorAll('[data-ui="tools-launcher-card"]'),
      (card) => card.style.getPropertyValue(INDEX_PROPERTY),
    );
    expect(indices).toEqual(["0", "1", "2", "3", "3", "3", "3"]);
  });

  test("refreshes visible card order immediately before playback", () => {
    const view = renderEntranceFixture();
    const animation = createToolsEntranceAnimation(view);
    const grid = view.querySelector(".tools-launcher-grid");
    const [firstCard, hiddenCard, secondCard] = grid.children;

    animation.prepare();
    hiddenCard.classList.remove("hidden");
    grid.prepend(secondCard);

    animation.play();

    expect(secondCard.style.getPropertyValue(INDEX_PROPERTY)).toBe("0");
    expect(firstCard.style.getPropertyValue(INDEX_PROPERTY)).toBe("1");
    expect(hiddenCard.style.getPropertyValue(INDEX_PROPERTY)).toBe("2");
  });

  test("reveals immediately instead of animating a hidden launcher", () => {
    const view = renderEntranceFixture();
    const root = view.querySelector('[data-ui="tools-entrance-root"]');
    const launcher = document.createElement("section");
    launcher.id = "tools-launcher";
    launcher.classList.add("hidden");
    root.appendChild(launcher);
    const animation = createToolsEntranceAnimation(view);

    animation.prepare();

    expect(animation.play()).toBe(false);
    expect(root.classList.contains(PREPARED_CLASS)).toBe(false);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  test("starts only after two animation frames and cleans on animationend", () => {
    const view = renderEntranceFixture();
    const animation = createToolsEntranceAnimation(view);
    const root = view.querySelector('[data-ui="tools-entrance-root"]');

    expect(animation.play()).toBe(true);
    expect(root.classList.contains(ACTIVE_CLASS)).toBe(false);

    runNextFrame();
    expect(root.classList.contains(ACTIVE_CLASS)).toBe(false);

    runNextFrame();
    expect(root.classList.contains(ACTIVE_CLASS)).toBe(true);

    const visibleCards = root.querySelectorAll(
      '.tools-launcher-grid [data-ui="tools-launcher-card"]:not(.hidden)',
    );
    visibleCards[visibleCards.length - 1].dispatchEvent(
      new Event("animationend"),
    );

    expect(root.classList.contains(PREPARED_CLASS)).toBe(false);
    expect(root.classList.contains(ACTIVE_CLASS)).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  test("uses the fallback timer when animationend does not fire", () => {
    const view = renderEntranceFixture();
    const animation = createToolsEntranceAnimation(view, { fallbackMs: 620 });
    const root = view.querySelector('[data-ui="tools-entrance-root"]');

    animation.play();
    runNextFrame();
    runNextFrame();
    jest.advanceTimersByTime(619);
    expect(root.classList.contains(ACTIVE_CLASS)).toBe(true);

    jest.advanceTimersByTime(1);
    expect(root.classList.contains(PREPARED_CLASS)).toBe(false);
    expect(root.classList.contains(ACTIVE_CLASS)).toBe(false);
  });

  test("cancel removes frames, listeners, classes, variables, and timers", () => {
    const view = renderEntranceFixture();
    const animation = createToolsEntranceAnimation(view);
    const root = view.querySelector('[data-ui="tools-entrance-root"]');
    const card = root.querySelector('[data-ui="tools-launcher-card"]');

    animation.play();
    runNextFrame();
    animation.cancel();

    expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(rafCallbacks.size).toBe(0);
    expect(root.classList.contains(PREPARED_CLASS)).toBe(false);
    expect(root.classList.contains(ACTIVE_CLASS)).toBe(false);
    expect(card.classList.contains(ITEM_CLASS)).toBe(false);
    expect(card.style.getPropertyValue(INDEX_PROPERTY)).toBe("");
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each([
    ["system reduced motion", () => (window.matchMedia = () => ({ matches: true }))],
    ["body low effects", () => document.body.classList.add("low-effects")],
    [
      "document low effects",
      () => document.documentElement.classList.add("low-effects"),
    ],
  ])("skips preparation and playback for %s", (_label, enable) => {
    const view = renderEntranceFixture();
    enable();
    const animation = createToolsEntranceAnimation(view);

    expect(animation.prepare()).toBe(false);
    expect(animation.play()).toBe(false);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  test("cancels safely when the root is detached before playback", () => {
    const view = renderEntranceFixture();
    const animation = createToolsEntranceAnimation(view);
    const root = view.querySelector('[data-ui="tools-entrance-root"]');

    animation.play();
    view.remove();
    runNextFrame();
    runNextFrame();

    expect(root.classList.contains(PREPARED_CLASS)).toBe(false);
    expect(root.classList.contains(ACTIVE_CLASS)).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
});
