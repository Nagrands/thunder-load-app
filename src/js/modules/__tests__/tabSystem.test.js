import TabSystem from "../tabSystem.js";

describe("TabSystem", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="group-menu"></div>
      <div id="main-view"></div>
    `;
  });

  test("does not append a tab wrapper into itself when re-rendering an emptied tab", () => {
    const tabs = new TabSystem(".group-menu", "#main-view");
    const wrapper = document.createElement("div");
    wrapper.id = "tools-wrapper";

    const render = jest.fn(() => {
      if (!wrapper.hasChildNodes()) {
        const content = document.createElement("section");
        content.textContent = "tools";
        wrapper.appendChild(content);
      }
      return wrapper;
    });

    tabs.addTab("tools", "Tools", "fa-solid fa-toolbox", render);
    tabs.addTab("other", "Other", "fa-solid fa-circle", () => {
      const el = document.createElement("div");
      el.textContent = "other";
      return el;
    });

    tabs.activateTab("tools");
    expect(wrapper.childNodes).toHaveLength(1);

    wrapper.replaceChildren();
    tabs.activateTab("other");

    expect(() => tabs.activateTab("tools")).not.toThrow();
    expect(render).toHaveBeenCalledTimes(2);
    expect(wrapper.childNodes).toHaveLength(1);
    expect(document.getElementById("main-view").contains(wrapper)).toBe(true);
  });
});
