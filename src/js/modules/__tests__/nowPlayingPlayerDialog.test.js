jest.mock("../i18n.js", () => ({
  t: (key) => key,
}));

import { createPlayerDialog } from "../nowPlaying/playerDialog.js";

function createFixture() {
  const modal = document.createElement("div");
  modal.dataset.ui = "player-form-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <form data-ui="player-form-modal-form">
      <h2 data-ui="player-form-modal-title"></h2>
      <p data-ui="player-form-modal-hint"></p>
      <section data-ui="player-form-modal-info" hidden>
        <img data-ui="player-form-modal-info-artwork" alt="" hidden />
        <span data-ui="player-form-modal-info-fallback"><i></i></span>
        <h3 data-ui="player-form-modal-info-title"></h3>
        <p data-ui="player-form-modal-info-subtitle" hidden></p>
        <div data-ui="player-form-modal-info-badges" hidden></div>
        <dl>
          ${["duration", "size", "dimensions", "container", "kind", "provider"]
            .map(
              (field) => `
                <div data-info-field="${field}" hidden>
                  <dt>${field}</dt>
                  <dd data-ui="player-form-modal-info-${field}"></dd>
                </div>
              `,
            )
            .join("")}
        </dl>
      </section>
      <label data-ui="player-form-modal-field">
        <span data-ui="player-form-modal-label"></span>
        <input data-ui="player-form-modal-input" />
        <select data-ui="player-form-modal-select" hidden></select>
      </label>
      <div data-ui="player-form-modal-error" hidden></div>
      <button type="button" data-ui="player-form-modal-close">Close</button>
      <button type="button" data-ui="player-form-modal-cancel">Cancel</button>
      <button type="submit" data-ui="player-form-modal-submit"></button>
    </form>
  `;
  document.body.appendChild(modal);
  return modal;
}

describe("Player dialog", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("supports aliases, traps focus and restores the invoking control", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const modal = createFixture();
    const dialog = createPlayerDialog({ element: modal, onSubmit: jest.fn() });

    expect(
      dialog.open("rename", {
        activePlaylist: { title: "Road trip" },
      }),
    ).toBe(true);
    await Promise.resolve();
    const input = modal.querySelector('[data-ui="player-form-modal-input"]');
    const submit = modal.querySelector('[data-ui="player-form-modal-submit"]');
    expect(input.value).toBe("Road trip");
    expect(document.activeElement).toBe(input);

    submit.focus();
    submit.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(document.activeElement).toBe(input);
    dialog.close();
    expect(document.activeElement).toBe(trigger);
    dialog.dispose();
  });

  test("keeps the modal busy during submit and advances YouTube to quality", async () => {
    let resolveAnalysis;
    const onSubmit = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveAnalysis = resolve;
        }),
    );
    const modal = createFixture();
    const dialog = createPlayerDialog({ element: modal, onSubmit });
    dialog.open("youtube");
    const form = modal.querySelector('[data-ui="player-form-modal-form"]');
    const input = modal.querySelector('[data-ui="player-form-modal-input"]');
    const submit = modal.querySelector('[data-ui="player-form-modal-submit"]');
    input.value = "https://youtu.be/demo";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(form.getAttribute("aria-busy")).toBe("true");
    expect(submit.disabled).toBe(true);

    resolveAnalysis({
      step: "quality",
      url: input.value,
      analysis: {
        track: { title: "Demo" },
        qualities: [
          { id: "auto", selector: { mode: "auto" } },
          { id: "720", height: 720, fps: 30, selector: { formatId: "22" } },
        ],
        defaultSelection: { mode: "auto" },
      },
    });
    await Promise.resolve();
    await Promise.resolve();
    const select = modal.querySelector('[data-ui="player-form-modal-select"]');
    expect(select.hidden).toBe(false);
    expect(select.options).toHaveLength(2);
    expect(select.value).toBe("auto");
    expect(form.getAttribute("aria-busy")).toBe("false");
    dialog.dispose();
  });

  test("reports async errors and renders premium track information", async () => {
    const modal = createFixture();
    const dialog = createPlayerDialog({
      element: modal,
      onSubmit: jest.fn().mockRejectedValue(new Error("Network error")),
    });
    dialog.open("create");
    const input = modal.querySelector('[data-ui="player-form-modal-input"]');
    input.value = "Playlist";
    modal
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(modal.querySelector('[data-ui="player-form-modal-error"]').textContent).toBe(
      "Network error",
    );

    dialog.open("trackInfo", {
      posterUrl: "data:image/jpeg;base64,preview",
      track: {
        title: "Original title",
        displayTitle: "Song",
        artist: "Artist",
        album: "Album",
        duration: 65,
        sizeBytes: 576716800,
        kind: "video",
        providerId: "local",
        availability: "available",
        mediaInfo: {
          width: 1920,
          height: 1080,
          container: "matroska",
          videoCodec: "hevc",
          audioCodec: "aac",
        },
      },
    });
    const info = modal.querySelector('[data-ui="player-form-modal-info"]');
    expect(modal.querySelector('[data-ui="player-form-modal-field"]').hidden).toBe(
      true,
    );
    expect(info.hidden).toBe(false);
    expect(
      modal.querySelector('[data-ui="player-form-modal-info-title"]').textContent,
    ).toBe("Song");
    expect(
      modal.querySelector('[data-ui="player-form-modal-info-subtitle"]').textContent,
    ).toBe("Artist · Album");
    expect(
      modal.querySelector('[data-ui="player-form-modal-info-badges"]').textContent,
    ).toContain("1080pHEVCAAC");
    expect(
      modal.querySelector('[data-ui="player-form-modal-info-duration"]').textContent,
    ).toBe("1:05");
    expect(
      modal.querySelector('[data-ui="player-form-modal-info-size"]').textContent,
    ).toBe("550 MB");
    expect(
      modal.querySelector('[data-ui="player-form-modal-info-dimensions"]').textContent,
    ).toBe("1920 × 1080");
    expect(
      modal.querySelector('[data-ui="player-form-modal-info-container"]').textContent,
    ).toBe("MATROSKA");
    expect(
      modal.querySelector('[data-ui="player-form-modal-info-artwork"]').src,
    ).toBe("data:image/jpeg;base64,preview");
    modal
      .querySelector('[data-ui="player-form-modal-info-artwork"]')
      .dispatchEvent(new Event("error"));
    expect(
      modal.querySelector('[data-ui="player-form-modal-info-fallback"]').hidden,
    ).toBe(false);
    expect(
      modal.querySelector('[data-ui="player-form-modal-cancel"]').hidden,
    ).toBe(true);
    expect(modal.getAttribute("aria-describedby")).toBe(
      "player-form-modal-info-title",
    );

    dialog.open("rename", {
      activePlaylist: { title: "Restored form" },
    });
    expect(info.hidden).toBe(true);
    expect(modal.querySelector('[data-ui="player-form-modal-hint"]').hidden).toBe(
      false,
    );
    expect(
      modal.querySelector('[data-ui="player-form-modal-cancel"]').hidden,
    ).toBe(false);
    dialog.dispose();
  });

  test("omits unknown metadata and falls back for unavailable audio", () => {
    const modal = createFixture();
    const dialog = createPlayerDialog({ element: modal });
    dialog.open("trackInfo", {
      track: {
        title: "Audio",
        kind: "audio",
        providerId: "network",
        availability: "unavailable",
        mediaInfo: { audioCodec: "opus" },
      },
    });

    expect(
      modal.querySelector('[data-info-field="duration"]').hidden,
    ).toBe(true);
    expect(modal.querySelector('[data-info-field="size"]').hidden).toBe(true);
    expect(
      modal.querySelector('[data-info-field="dimensions"]').hidden,
    ).toBe(true);
    expect(
      modal.querySelector('[data-ui="player-form-modal-info-badges"]').textContent,
    ).toContain("OpusnowPlaying.info.availability.unavailable");
    expect(
      modal.querySelector('[data-ui="player-form-modal-info-artwork"]').hidden,
    ).toBe(true);
    expect(
      modal.querySelector('[data-ui="player-form-modal-info-fallback"]').hidden,
    ).toBe(false);
    dialog.dispose();
  });
});
