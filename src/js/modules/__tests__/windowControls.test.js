import {
  disposeWindowControls,
  initWindowControls,
} from "../windowControls.js";

describe("windowControls", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button data-window-action="minimize"><span>Minimize</span></button>
      <section id="player"></section>
    `;
    window.electron = {
      minimize: jest.fn(),
      close: jest.fn(),
    };
  });

  afterEach(() => {
    disposeWindowControls();
  });

  test("delegates global and dynamically mounted Player controls", () => {
    initWindowControls();
    initWindowControls();

    document.querySelector("[data-window-action='minimize'] span").click();
    document.getElementById("player").innerHTML = `
      <button data-window-action="close"><i></i></button>
    `;
    document.querySelector("[data-window-action='close'] i").click();

    expect(window.electron.minimize).toHaveBeenCalledTimes(1);
    expect(window.electron.close).toHaveBeenCalledTimes(1);
  });

  test("removes the delegated handler on dispose", () => {
    const dispose = initWindowControls();
    dispose();

    document.querySelector("[data-window-action='minimize']").click();

    expect(window.electron.minimize).not.toHaveBeenCalled();
  });
});
