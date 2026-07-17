function setupDom(value = "") {
  document.body.innerHTML = `
    <button id="url-source-link" type="button">
      <i id="icon-url-globe" class="fas fa-globe search-icon" aria-hidden="true"></i>
    </button>
    <button id="clear-url" type="button">Clear</button>
    <input id="url" value="${value}" />
  `;
}

describe("iconUpdater", () => {
  beforeEach(() => {
    jest.resetModules();
    setupDom();
  });

  test.each([
    ["youtube.com/watch?v=123", "youtube"],
    ["https://music.youtube.com/watch?v=123", "youtube"],
    ["https://youtu.be/123", "youtube"],
    ["twitch.tv/channel", "twitch"],
    ["https://www.vkvideo.ru/video-1_2", "vkvideo"],
    ["https://vk.com/video-1_2", "vkvideo"],
    ["https://coub.com/view/123", "coub"],
    ["https://example.com/video", "default"],
    ["ftp://youtube.com/video", "default"],
    ["https://youtube.com.example.com/video", "default"],
    ["not a url", "default"],
    ["", "default"],
  ])("detects %s as %s", async (url, expectedService) => {
    const { detectUrlService } = await import("../iconUpdater.js");

    expect(detectUrlService(url)).toBe(expectedService);
  });

  test("updates the existing icon immediately while typing and restores globe on clear", async () => {
    const { initIconUpdater } = await import("../iconUpdater.js");
    const input = document.getElementById("url");
    const icon = document.getElementById("icon-url-globe");

    initIconUpdater();
    input.value = "https://youtube.com/watch?v=123";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(icon.dataset.service).toBe("youtube");
    expect(icon.classList.contains("fa-youtube")).toBe(true);

    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(icon.dataset.service).toBe("default");
    expect(icon.classList.contains("fa-globe")).toBe(true);
  });

  test("uses the current input value during initialization", async () => {
    jest.resetModules();
    setupDom("https://twitch.tv/channel");
    const { initIconUpdater } = await import("../iconUpdater.js");

    initIconUpdater();

    expect(document.getElementById("icon-url-globe").dataset.service).toBe(
      "twitch",
    );
  });

  test("restores the globe after programmatic clear actions", async () => {
    const input = document.getElementById("url");
    input.value = "https://coub.com/view/123";
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") input.value = "";
    });
    document.getElementById("clear-url").addEventListener("click", () => {
      input.value = "";
    });
    const { initIconUpdater, updateIcon } = await import("../iconUpdater.js");
    initIconUpdater();

    updateIcon(input.value);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("icon-url-globe").dataset.service).toBe(
      "default",
    );

    input.value = "https://vkvideo.ru/video-1_2";
    updateIcon(input.value);
    document.getElementById("clear-url").click();
    expect(document.getElementById("icon-url-globe").dataset.service).toBe(
      "default",
    );
  });
});
