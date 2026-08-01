import fs from "fs";
import path from "path";
import createDOMPurify from "dompurify";

function setupDom() {
  document.body.innerHTML = `
    <button class="version-container"></button>
    <div
      id="whats-new-modal"
      style="display:none"
      aria-hidden="true"
      aria-labelledby="whats-new-title"
    >
      <div class="whats-modal-content">
        <h2 id="whats-new-title">Что нового?</h2>
        <button class="close-whats-new" data-ui="whats-close"></button>
        <section data-ui="whats-presentation">
          <span data-ui="whats-slide-count"></span>
          <span data-ui="whats-slide-summary"></span>
          <div id="whats-new-content" data-ui="whats-slide-viewport"></div>
          <button type="button" data-ui="whats-prev">Назад</button>
          <div data-ui="whats-dots"></div>
          <button type="button" data-ui="whats-next">Далее</button>
          <button type="button" data-ui="whats-continue">Продолжить</button>
        </section>
      </div>
    </div>
  `;
}

async function importWithDomMocks() {
  const versionContainer = document.querySelector(".version-container");
  const whatsNewModal = document.getElementById("whats-new-modal");
  const whatsNewContent = document.getElementById("whats-new-content");
  const closeWhatsNewBtn = document.querySelector(".close-whats-new");

  jest.doMock("../domElements.js", () => ({
    versionContainer,
    whatsNewModal,
    whatsNewContent,
    closeWhatsNewBtn,
    confirmationModal: null,
    settingsModal: null,
  }));
  jest.doMock("../modalManager.js", () => ({
    closeAllModals: jest.fn(),
  }));

  return import("../whatsNewModal.js");
}

describe("whatsNew sanitizer", () => {
  let sanitize;

  beforeEach(async () => {
    jest.resetModules();
    setupDom();
    window.DOMPurify = createDOMPurify(window);
    const mod = await importWithDomMocks();
    sanitize = mod.__test_sanitizeWhatsNewHtml;
  });

  test("keeps allowed tags", () => {
    expect(sanitize("<p>ok</p>")).toBe("<p>ok</p>");
  });

  test("removes script tags", () => {
    expect(sanitize("<script>alert(1)</script><p>x</p>")).toBe("<p>x</p>");
  });

  test("keeps h1 and table tags for rich markdown", () => {
    const input =
      '<h1>Title</h1><table><thead><tr><th align="right">A</th></tr></thead><tbody><tr><td align="center">B</td></tr></tbody></table>';
    const output = sanitize(input);
    expect(output).toContain("<h1>Title</h1>");
    expect(output).toContain("<table>");
    expect(output).toContain("<th>A</th>");
    expect(output).toContain("<td>B</td>");
  });

  test("strips javascript: href", () => {
    expect(sanitize('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
  });
});

describe("whatsNew presentation slides", () => {
  beforeEach(() => {
    jest.resetModules();
    setupDom();
    window.DOMPurify = createDOMPurify(window);
    localStorage.setItem("uiLanguage", "ru");
  });

  test("builds overview and feature slides from release notes table", async () => {
    const mod = await importWithDomMocks();
    const slides = mod.__test_buildSlidesFromHtml(
      [
        `
          <h1>Thunder Spark — 1.6.0</h1>
          <table>
            <thead><tr><th>Изменения</th><th>Что это даёт</th></tr></thead>
            <tbody>
              <tr><td><strong>Запущен</strong> бренд</td><td>Новый бренд без редизайна рабочих экранов</td></tr>
              <tr><td><strong>Исправлена</strong> проверка</td><td>Без повторной проверки Python.framework</td></tr>
            </tbody>
          </table>
        `,
      ],
      "1.6.0",
    );

    expect(slides).toHaveLength(3);
    expect(slides[0]).toMatchObject({
      type: "overview",
      titleText: "Thunder Spark — 1.6.0",
      featureCount: 2,
    });
    expect(slides[1]).toMatchObject({
      type: "feature",
      bodyHtml: "Новый бренд без редизайна рабочих экранов",
    });
  });

  test("adds and removes modal overlay class when modal opens and closes", async () => {
    window.electron = {
      invoke: jest.fn(async (channel) => {
        if (channel === "get-version") return "1.6.0";
        if (channel === "get-whats-new") {
          return {
            version: "1.6.0",
            changes: [
              `
                <h1>Thunder Spark — 1.6.0</h1>
                <table>
                  <tbody>
                    <tr><td><strong>Первое</strong></td><td>Описание первого</td></tr>
                    <tr><td><strong>Второе</strong></td><td>Описание второго</td></tr>
                  </tbody>
                </table>
              `,
            ],
          };
        }
        return undefined;
      }),
      onShowWhatsNew: jest.fn(),
    };

    const mod = await importWithDomMocks();
    mod.initWhatsNewModal();

    document.querySelector(".version-container").click();
    await Promise.resolve();
    await Promise.resolve();

    const modal = document.getElementById("whats-new-modal");
    const content = document.getElementById("whats-new-content");
    const dots = modal.querySelectorAll(".whats-slide-dot");

    expect(modal.style.display).toBe("flex");
    expect(modal.getAttribute("aria-hidden")).toBe("false");
    expect(document.body.classList.contains("modal-overlay-active")).toBe(true);
    expect(content.textContent).toContain("Thunder Spark — 1.6.0");
    expect(dots).toHaveLength(3);

    modal.querySelector('[data-ui="whats-next"]').click();
    expect(content.textContent).toContain("Первое");
    const featureBody = content.querySelector(".whats-feature-body");
    const featureTitle = content.querySelector(".whats-slide--feature h2");
    expect(featureBody.getAttribute("role")).toBe("region");
    expect(featureBody.tabIndex).toBe(0);
    expect(featureBody.getAttribute("aria-labelledby")).toBe(featureTitle.id);

    dots[2].click();
    expect(content.textContent).toContain("Второе");
    expect(modal.querySelector('[data-ui="whats-continue"]').textContent).toBe(
      "Закрыть",
    );

    modal.querySelector('[data-ui="whats-continue"]').click();
    expect(modal.style.display).toBe("none");
    expect(modal.getAttribute("aria-hidden")).toBe("true");
    expect(document.body.classList.contains("modal-overlay-active")).toBe(
      false,
    );
  });

  test("template keeps accessible label and carousel hooks", () => {
    const templatePath = path.resolve(
      process.cwd(),
      "templates/partials/modals/whats-new.njk",
    );
    const template = fs.readFileSync(templatePath, "utf8");

    expect(template).toContain('aria-labelledby="whats-new-title"');
    expect(template).toContain('id="whats-new-title"');
    expect(template).toContain('id="whats-new-content"');
    expect(template).toContain('data-ui="whats-prev"');
    expect(template).toContain('data-ui="whats-next"');
    expect(template).toContain('data-ui="whats-dots"');
    expect(template).toContain('data-ui="whats-continue"');
  });
});
