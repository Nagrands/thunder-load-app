// src/js/modules/toolsInfo.js

/**
 * Модуль рендера секции «Инструменты» (yt-dlp, ffmpeg).
 * Отвечает за первичную разметку, проверку наличия/обновлений и установку/переустановку.
 * Требует `window.electron.tools.*` (preload‑bridge) и Bootstrap tooltips (initTooltips).
 *
 * Особенности:
 *  - Единая основная кнопка: если какого‑то инструмента нет → «Скачать зависимости», иначе → «Проверить обновления».
 *  - Не допускается даунгрейд ffmpeg (7.1 == 7.1.x) и yt‑dlp (сравнение по дате YYYY.MM.DD).
 *  - Сетевые состояния: кнопки отключаются, если нет сети или идёт операция.
 *
 * @module toolsInfo
 */

/**
 * Взять первую строку строки.
 * @param {string} [s=""]
 * @returns {string}
 */
function firstLine(s = "") {
  return s.split("\n")[0];
}

/**
 * Нормализовать строку версии: обрезать префикс `v`, трим, в нижний регистр.
 * Пустые/«—» → пустая строка.
 * @param {string} [v=""]
 * @returns {string}
 */
function normVer(v = "") {
  if (!v || v === "—") return "";
  return String(v).trim().replace(/^v/i, "").toLowerCase();
}

/**
 * Парсинг даты версии yt‑dlp вида YYYY.MM.DD
 * @param {string} v
 * @returns {[number,number,number]|null} [Y, M, D] или null
 */
function parseYtDlpVer(v) {
  v = normVer(v);
  const m = v.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

/**
 * Сравнение дат версий yt‑dlp.
 * @param {string} latest
 * @param {string} current
 * @returns {1|0|-1|null} 1 если latest>current, 0 если равны, -1 если latest<current, null если нераспознано
 */
function cmpYtDlp(latest, current) {
  const L = parseYtDlpVer(latest), C = parseYtDlpVer(current);
  if (!L || !C) return null;
  for (let i = 0; i < 3; i++) {
    if (L[i] > C[i]) return 1;
    if (L[i] < C[i]) return -1;
  }
  return 0;
}

/**
 * Детальный парсинг semver (без пререлизов/метаданных): MAJOR.MINOR[.PATCH]
 * @param {string} v
 * @returns {{major:number,minor:number,patch:number|null,hadPatch:boolean}|null}
 */
function parseSemverDetailed(v) {
  v = normVer(v);
  v = v.split('-')[0].split('+')[0];
  const m = v.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!m) return null;
  return {
    major: parseInt(m[1] || '0', 10),
    minor: parseInt(m[2] || '0', 10),
    patch: m[3] !== undefined ? parseInt(m[3], 10) : null,
    hadPatch: m[3] !== undefined,
  };
}

/**
 * Сравнение версий ffmpeg с правилом: если latest без PATCH (напр. 7.1),
 * то любая 7.1.x считается равной.
 * @param {string} latest
 * @param {string} current
 * @returns {1|0|-1|null}
 */
function cmpFfSemver(latest, current) {
  const L = parseSemverDetailed(latest);
  const C = parseSemverDetailed(current);
  if (!L || !C) return null;
  if (L.major === C.major && L.minor === C.minor && L.patch === null) {
    return 0; // 7.1 == 7.1.x
  }
  const lp = L.patch == null ? 0 : L.patch;
  const cp = C.patch == null ? 0 : C.patch;
  if (L.major !== C.major) return L.major > C.major ? 1 : -1;
  if (L.minor !== C.minor) return L.minor > C.minor ? 1 : -1;
  if (lp !== cp) return lp > cp ? 1 : -1;
  return 0;
}

/**
 * Запуск «аниматора точек» у кнопки (… → …)
 * @param {HTMLElement} labelEl
 * @param {string} base
 * @returns {{stop:() => void}}
 */
function startDotsAnimator(labelEl, base) {
  let dots = 0;
  const id = setInterval(() => {
    dots = (dots + 1) % 4;
    labelEl.textContent = base + ".".repeat(dots);
  }, 400);
  return { stop: () => clearInterval(id) };
}

/**
 * Применить доступность кнопок по сетевому состоянию/процессам
 * @param {HTMLButtonElement|null} primaryBtn
 * @param {HTMLButtonElement|null} forceBtn
 * @param {boolean} isInstalling
 * @param {boolean} isChecking
 */
function applyNetworkState(primaryBtn, forceBtn, isInstalling, isChecking) {
  const offline = !navigator.onLine;
  if (primaryBtn) primaryBtn.disabled = offline || isInstalling || isChecking;
  if (forceBtn) forceBtn.disabled = offline || isInstalling || isChecking;
}

/**
 * Рендер секции «Инструменты» и навешивание обработчиков.
 * Делает безопасные IPC вызовы через preload‑bridge `window.electron.tools`.
 *
 * @returns {Promise<void>}
 */
export async function renderToolsInfo() {
  const section = document.getElementById("tools-info");
  if (!section) return;

  // Базовая разметка (компактная и читаемая)
  section.innerHTML = `
    <h2>Инструменты</h2>

    <small id="tools-hint" class="muted"></small>

    <div class="tools-footer">
      <button id="open-tools-folder" type="button" title="Открыть папку с инструментами">
        <i class="fa-regular fa-folder-open"></i>
        <span></span>
      </button>
      <small id="tools-status" class="muted"></small>
      <button id="tools-primary-btn" type="button" title="">
        <i class="fa-solid fa-rotate" id="tools-primary-icon"></i>
        <span id="tools-primary-label"></span>
      </button>
      <button id="tools-force-btn" type="button" title="Принудительно переустановить инструменты" data-bs-toggle="tooltip" style="display:none; vertical-align: middle;">
        <i class="fa-solid fa-arrow-rotate-right"></i>
        <span></span>
      </button>
    </div>
  `;

  /** @type {HTMLButtonElement|null} */
  const btnOpenToolsFolder = document.getElementById("open-tools-folder");
  /** @type {HTMLButtonElement|null} */
  const primaryBtn = document.getElementById("tools-primary-btn");
  /** @type {HTMLElement|null} */
  const primaryIcon = document.getElementById("tools-primary-icon");
  /** @type {HTMLElement|null} */
  const primaryLabel = document.getElementById("tools-primary-label");
  /** @type {HTMLButtonElement|null} */
  const forceBtn = document.getElementById("tools-force-btn");
  /** @type {HTMLElement|null} */
  const hintEl = document.getElementById("tools-hint");
  /** @type {HTMLElement|null} */
  const statusEl = document.getElementById("tools-status");

  let isChecking = false;
  let isInstalling = false;

  // init and subscribe to online/offline
  if (window.__toolsInfoNetHandlers) {
    window.removeEventListener("online", window.__toolsInfoNetHandlers.on);
    window.removeEventListener("offline", window.__toolsInfoNetHandlers.off);
  }
  window.__toolsInfoNetHandlers = {
    on: () => applyNetworkState(primaryBtn, forceBtn, isInstalling, isChecking),
    off: () => applyNetworkState(primaryBtn, forceBtn, isInstalling, isChecking),
  };
  window.addEventListener("online", window.__toolsInfoNetHandlers.on);
  window.addEventListener("offline", window.__toolsInfoNetHandlers.off);
  applyNetworkState(primaryBtn, forceBtn, isInstalling, isChecking);

  try {
    const res = await window.electron.tools.getVersions();

    // Кнопка «Открыть папку с инструментами»
    if (btnOpenToolsFolder) {
      const openPath = (res?.ytDlp?.ok && res?.ytDlp?.path) || (res?.ffmpeg?.ok && res?.ffmpeg?.path) || null;
      if (openPath) {
        btnOpenToolsFolder.style.display = "";
        btnOpenToolsFolder.onclick = () => { window.electron.tools.showInFolder(openPath); };
        btnOpenToolsFolder.setAttribute("title", "Открыть папку с инструментами");
        btnOpenToolsFolder.setAttribute("data-bs-toggle", "tooltip");
      } else {
        btnOpenToolsFolder.style.display = "none";
        btnOpenToolsFolder.removeAttribute("title");
        btnOpenToolsFolder.removeAttribute("data-bs-toggle");
      }
    }

    // Хинт
    const missing = !res?.ytDlp?.ok || !res?.ffmpeg?.ok;
    if (hintEl) hintEl.textContent = missing
      ? "Некоторые инструменты не найдены. Установите их или нажмите ‘Скачать зависимости’."
      : "";

    if (forceBtn) forceBtn.style.display = missing ? "none" : "";

    // Настраиваем единую кнопку: скачать зависимости ИЛИ проверить обновления
    if (primaryBtn && primaryLabel && primaryIcon) {
      // reset
      primaryBtn.disabled = !navigator.onLine; // нужна сеть для обеих операций
      primaryBtn.classList.remove("disabled");
      primaryIcon.classList.remove("fa-spin");

      if (missing) {
        primaryBtn.setAttribute("title", "Скачать зависимости");
        primaryBtn.setAttribute("data-bs-toggle", "tooltip");
        primaryLabel.textContent = "Скачать зависимости";
        primaryIcon.className = "fa-solid fa-download";
        if (forceBtn) forceBtn.style.display = "none";

        // handler: install
        primaryBtn.onclick = async () => {
          if (!navigator.onLine) {
            await window.electron.invoke("toast", "Нет сети: проверьте подключение", "warning");
            return;
          }
          const prevText = primaryLabel.textContent;
          isInstalling = true;
          applyNetworkState(primaryBtn, forceBtn, isInstalling, isChecking);
          primaryBtn.setAttribute("aria-busy", "true");
          let dots; // animator controller
          try {
            primaryBtn.disabled = true;
            dots = startDotsAnimator(primaryLabel, "Скачиваю");
            await window.electron.tools.installAll();
            await renderToolsInfo();
          } catch (e) {
            console.error("[toolsInfo] installAll failed:", e);
            primaryBtn.disabled = false;
            primaryLabel.textContent = prevText || "Скачать зависимости";
          } finally {
            isInstalling = false;
            primaryBtn.removeAttribute("aria-busy");
            applyNetworkState(primaryBtn, forceBtn, isInstalling, isChecking);
            if (dots) dots.stop();
          }
        };
      } else {
        primaryBtn.setAttribute("title", "Проверить обновления");
        primaryBtn.setAttribute("data-bs-toggle", "tooltip");
        primaryLabel.textContent = "Проверить обновления";
        primaryIcon.className = "fa-solid fa-rotate";

        const enableForceReinstall = () => {
          if (!forceBtn) return;
          forceBtn.style.display = "";
          forceBtn.onclick = async () => {
            if (!navigator.onLine) {
              await window.electron.invoke("toast", "Нет сети: проверьте подключение", "warning");
              return;
            }
            const prevText = primaryLabel.textContent;
            let dots;
            try {
              isInstalling = true;
              applyNetworkState(primaryBtn, forceBtn, isInstalling, isChecking);
              primaryBtn.setAttribute("aria-busy", "true");
              primaryBtn.disabled = true; if (forceBtn) forceBtn.disabled = true;
              dots = startDotsAnimator(primaryLabel, "Скачиваю");
              await window.electron.tools.installAll();
              await renderToolsInfo();
            } catch (e) {
              console.error("[toolsInfo] force installAll failed:", e);
              primaryBtn.disabled = false; if (forceBtn) forceBtn.disabled = false;
              primaryLabel.textContent = prevText || "Проверить обновления";
            } finally {
              isInstalling = false;
              primaryBtn.removeAttribute("aria-busy");
              applyNetworkState(primaryBtn, forceBtn, isInstalling, isChecking);
              if (dots) dots.stop();
            }
          };
        };

        // handler: check updates
        primaryBtn.onclick = async () => {
          if (isChecking) return;
          if (!navigator.onLine) {
            await window.electron.invoke("toast", "Нет сети: проверьте подключение", "warning");
            return;
          }
          const cur = await window.electron.tools.getVersions();
          if (!cur?.ytDlp?.ok || !cur?.ffmpeg?.ok) { await renderToolsInfo(); return; }

          let promotedToUpdateMode = false;
          isChecking = true;
          primaryBtn.disabled = true;
          applyNetworkState(primaryBtn, forceBtn, isInstalling, isChecking);
          primaryBtn.setAttribute("aria-busy", "true");
          primaryIcon.classList.add("fa-spin");
          const prevText = primaryLabel.textContent;
          primaryLabel.textContent = "Проверяю…";
          try {
            if (statusEl) {
              statusEl.textContent = "Проверяю обновления…";
              statusEl.setAttribute("title", "");
              statusEl.removeAttribute("data-bs-toggle");
            }

            // Свежая проверка обновлений (без кеша)
            const upd = await window.electron.tools.checkUpdates({ noCache: true, forceFetch: true });

            // Собираем версию «current» и «latest»
            const yCurUpd = normVer(upd?.ytDlp?.current || "");
            const fCurUpd = normVer(upd?.ffmpeg?.current || "");
            const yLatN   = normVer(upd?.ytDlp?.latest || "");
            const fLatN   = normVer(upd?.ffmpeg?.latest || "");

            const yCurLocal = normVer(firstLine(cur?.ytDlp?.version || "").replace(/^v/i, ""));
            const fCurLocal = normVer(firstLine(cur?.ffmpeg?.version || "").replace(/^ffmpeg version\s*/i, "").split(" ")[0]);

            const ytCur = yCurUpd || yCurLocal || "";
            const ffCur = fCurUpd || fCurLocal || "";
            const ytLatest = yLatN;
            const ffLatest = fLatN;

            let ytCmp = null, ffCmp = null;
            if (ytCur && ytLatest) ytCmp = cmpYtDlp(ytLatest, ytCur);
            if (ffCur && ffLatest) ffCmp = cmpFfSemver(ffLatest, ffCur);

            // Текст статуса
            const msgs = [];
            if (upd?.ytDlp) {
              if (ytCur && ytLatest) {
                if (ytCmp === 1) msgs.push(`yt-dlp: доступна ${upd.ytDlp.latest} (текущая ${upd.ytDlp.current || upd.ytDlp.local || yCurLocal || "—"})`);
                else msgs.push(`yt-dlp: актуальная (${upd.ytDlp.current || upd.ytDlp.local || yCurLocal || "—"})`);
              } else if (ytCur) {
                msgs.push(`yt-dlp: текущая версия (${ytCur})`);
              }
            }
            if (upd?.ffmpeg) {
              if (ffCur && ffLatest) {
                if (ffCmp === 1) msgs.push(`ffmpeg: доступна ${upd.ffmpeg.latest} (текущая ${upd.ffmpeg.current || upd.ffmpeg.local || fCurLocal || "—"})`);
                else msgs.push(`ffmpeg: актуальная (${upd.ffmpeg.current || upd.ffmpeg.local || fCurLocal || "—"})`);
              } else if (ffCur) {
                msgs.push(`ffmpeg: текущая версия (${ffCur})`);
              }
            }
            const ytMsg = msgs.find((m) => m.startsWith("yt-dlp")) || "";
            const ffMsg = msgs.find((m) => m.startsWith("ffmpeg")) || "";
            if (statusEl) statusEl.innerHTML = [ytMsg, ffMsg].filter(Boolean).join("<br>") || "Обновлений не найдено.";

            const ytCan = ytCmp === 1;
            const ffCan = ffCmp === 1;
            const anyUpdate = ytCan || ffCan;

            if (anyUpdate) {
              if (forceBtn) forceBtn.style.display = "none";

              const updateYt = ytCan && !ffCan;
              const updateFf = ffCan && !ytCan;
              const updateBoth = ytCan && ffCan;
              const btnTitle = updateBoth ? "Обновить инструменты" : updateYt ? "Обновить yt-dlp" : "Обновить ffmpeg";

              primaryBtn.setAttribute("title", btnTitle);
              primaryBtn.setAttribute("data-bs-toggle", "tooltip");
              primaryLabel.textContent = btnTitle;
              primaryIcon.className = "fa-solid fa-download";

              primaryBtn.onclick = async () => {
                isInstalling = true;
                applyNetworkState(primaryBtn, forceBtn, isInstalling, isChecking);
                primaryBtn.setAttribute("aria-busy", "true");
                if (!navigator.onLine) {
                  await window.electron.invoke("toast", "Нет сети: проверьте подключение", "warning");
                  isInstalling = false; primaryBtn.removeAttribute("aria-busy");
                  applyNetworkState(primaryBtn, forceBtn, isInstalling, isChecking);
                  return;
                }
                const prevText2 = primaryLabel.textContent;
                let dots2;
                try {
                  primaryBtn.disabled = true;
                  dots2 = startDotsAnimator(primaryLabel, "Скачиваю");
                  if (updateBoth) { await window.electron.tools.updateYtDlp(); await window.electron.tools.updateFfmpeg(); }
                  else if (updateYt) { await window.electron.tools.updateYtDlp(); }
                  else if (updateFf) { await window.electron.tools.updateFfmpeg(); }
                  await renderToolsInfo();
                } catch (e2) {
                  console.error("[toolsInfo] selective update failed:", e2);
                  primaryBtn.disabled = false;
                  primaryLabel.textContent = prevText2 || btnTitle;
                } finally {
                  isInstalling = false;
                  primaryBtn.removeAttribute("aria-busy");
                  applyNetworkState(primaryBtn, forceBtn, isInstalling, isChecking);
                  if (dots2) dots2.stop();
                }
              };
              promotedToUpdateMode = true;
              await window.electron.invoke("toast", [ytMsg, ffMsg].filter(Boolean).join("; ") || "Доступны обновления", "success");
            } else {
              // Переустановка доступна всегда (на случай кривых бинарей)
              enableForceReinstall();
              await window.electron.invoke("toast", [ytMsg, ffMsg].filter(Boolean).join("; ") || "Обновлений не найдено", "success");
            }
          } catch (err) {
            console.error("[toolsInfo] check updates failed:", err);
            if (statusEl) statusEl.textContent = "Ошибка при проверке обновлений";
            await window.electron.invoke("toast", `Ошибка: ${err.message}`, "error");
          } finally {
            isChecking = false;
            primaryBtn.removeAttribute("aria-busy");
            applyNetworkState(primaryBtn, forceBtn, isInstalling, isChecking);
            primaryIcon.classList.remove("fa-spin");
            if (!promotedToUpdateMode) {
              primaryLabel.textContent = prevText || "Проверить обновления";
            } else {
              primaryLabel.textContent = "Обновить инструменты"; // удерживаем режим обновления
              primaryBtn.setAttribute("title", "Обновить инструменты");
              primaryBtn.setAttribute("data-bs-toggle", "tooltip");
              primaryIcon.className = "fa-solid fa-download";
            }
            primaryBtn.disabled = false;
          }
        };
      }
    }

    // подсказка на статусе: текущие версии
    if (statusEl) {
      if (!missing) {
        const curY = res?.ytDlp?.ok ? firstLine(res.ytDlp.version).replace(/^v/i, "") : "—";
        const curF = res?.ffmpeg?.ok ? firstLine(res.ffmpeg.version).replace(/^ffmpeg version\s*/i, "").split(" ")[0] : "—";
        statusEl.setAttribute("title", `yt-dlp: ${curY}; ffmpeg: ${curF}`);
        statusEl.setAttribute("data-bs-toggle", "tooltip");
      } else {
        statusEl.removeAttribute("title");
        statusEl.removeAttribute("data-bs-toggle");
      }
    }

    // статус внизу блока
    if (statusEl) {
      if (!missing && res?.ytDlp?.ok && res?.ffmpeg?.ok) {
        const curY = firstLine(res.ytDlp.version).replace(/^v/i, "");
        const curF = firstLine(res.ffmpeg.version).replace(/^ffmpeg version\s*/i, "").split(" ")[0];
        statusEl.innerHTML = `yt-dlp: ${curY}<br>ffmpeg: ${curF}`;
      } else {
        const absent = [];
        if (!res?.ytDlp?.ok) absent.push("yt-dlp");
        if (!res?.ffmpeg?.ok) absent.push("ffmpeg");
        statusEl.textContent = absent.length ? `Отсутствует: ${absent.join(", ")}` : "";
      }
    }
  } catch (e) {
    if (hintEl) hintEl.textContent = "Не удалось получить версии инструментов.";
    console.error("[toolsInfo] getVersions failed:", e);
  }

  if (typeof initTooltips === "function") {
    initTooltips();
  }
}
