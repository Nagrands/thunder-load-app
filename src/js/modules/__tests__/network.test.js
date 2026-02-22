const mockShowToast = jest.fn();
jest.mock("../toast.js", () => ({
  showToast: (...args) => mockShowToast(...args),
}));

describe("network listeners", () => {
  beforeEach(() => {
    mockShowToast.mockClear();
    document.body.innerHTML = "";
  });

  it("shows error toast on offline event", () => {
    const { initNetworkListeners } = require("../network.js");
    initNetworkListeners();

    window.dispatchEvent(new Event("offline"));

    expect(mockShowToast).toHaveBeenCalledWith(
      "Отсутствует подключение к интернету. Пожалуйста, проверьте соединение.",
      "error",
    );
  });

  it("shows success toast on online event", () => {
    const { initNetworkListeners } = require("../network.js");
    initNetworkListeners();

    window.dispatchEvent(new Event("online"));

    expect(mockShowToast).toHaveBeenCalledWith(
      "Интернет-соединение восстановлено.",
      "success",
    );
  });

  it("does not require network indicator DOM nodes", () => {
    Object.defineProperty(window.navigator, "onLine", {
      value: false,
      configurable: true,
    });

    const { initNetworkListeners } = require("../network.js");
    expect(() => initNetworkListeners()).not.toThrow();
    expect(mockShowToast).toHaveBeenCalledWith(
      "Отсутствует подключение к интернету. Пожалуйста, проверьте соединение.",
      "error",
    );
  });
});
