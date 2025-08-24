// src/js/modules/toolsInfo.js

function firstLine(s = "") {
  return s.split("\n")[0];
}

function normVer(v = "") {
  if (!v || v === "—") return "";
  return String(v).trim().replace(/^v/i, "").toLowerCase();
}

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

  const hintEl = document.getElementById("tools-hint");
  const statusEl = document.getElementById("tools-status");
  const btnOpenToolsFolder = document.getElementById("open-tools-folder");
  const primaryBtn = document.getElementById("tools-primary-btn");
  const primaryIcon = document.getElementById("tools-primary-icon");
  const primaryLabel = document.getElementById("tools-primary-label");
  const forceBtn = document.getElementById("tools-force-btn");
  let isChecking = false;
  let isInstalling = false;

  function applyNetworkState() {
    const offline = !navigator.onLine;
    if (primaryBtn) primaryBtn.disabled = offline || isInstalling || isChecking;
    if (forceBtn) forceBtn.disabled = offline || isInstalling || isChecking;
  }

  // init and subscribe to online/offline
  if (window.__toolsInfoNetHandlers) {
    window.removeEventListener("online", window.__toolsInfoNetHandlers.on);
    window.removeEventListener("offline", window.__toolsInfoNetHandlers.off);
  }
  window.__toolsInfoNetHandlers = {
    on: () => applyNetworkState(),
    off: () => applyNetworkState(),
  };
  window.addEventListener("online", window.__toolsInfoNetHandlers.on);
  window.addEventListener("offline", window.__toolsInfoNetHandlers.off);
  applyNetworkState();

  try {
    const res = await window.electron.tools.getVersions();

    if (btnOpenToolsFolder) {
      const openPath =
        (res?.ytDlp?.ok && res?.ytDlp?.path) ||
        (res?.ffmpeg?.ok && res?.ffmpeg?.path) ||
        null;
      if (openPath) {
        btnOpenToolsFolder.style.display = "";
        btnOpenToolsFolder.onclick = () => {
          window.electron.tools.showInFolder(openPath);
        };
        btnOpenToolsFolder.setAttribute(
          "title",
          "Открыть папку с инструментами",
        );
        btnOpenToolsFolder.setAttribute("data-bs-toggle", "tooltip");
      } else {
        btnOpenToolsFolder.style.display = "none";
        btnOpenToolsFolder.removeAttribute("title");
        btnOpenToolsFolder.removeAttribute("data-bs-toggle");
      }
    }

    // хинт
    const missing = !res?.ytDlp?.ok || !res?.ffmpeg?.ok;
    hintEl.textContent = missing
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
            await window.electron.invoke(
              "toast",
              "Нет сети: проверьте подключение",
              "warning",
            );
            return;
          }
          const prevText = primaryLabel.textContent;
          isInstalling = true;
          applyNetworkState();
          primaryBtn.setAttribute("aria-busy", "true");
          let dotsTimer;
          try {
            primaryBtn.disabled = true;
            primaryLabel.textContent = "Скачиваю";
            let dots = 0;
            dotsTimer = setInterval(() => {
              dots = (dots + 1) % 4;
              primaryLabel.textContent = "Скачиваю" + ".".repeat(dots);
            }, 400);
            await window.electron.tools.installAll();
            await renderToolsInfo();
          } catch (e) {
            console.error("[toolsInfo] installAll failed:", e);
            primaryBtn.disabled = false;
            primaryLabel.textContent = prevText || "Скачать зависимости";
          } finally {
            isInstalling = false;
            primaryBtn.removeAttribute("aria-busy");
            applyNetworkState();
            if (dotsTimer) clearInterval(dotsTimer);
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
            let dotsTimer;
            try {
              isInstalling = true;
              applyNetworkState();
              primaryBtn.setAttribute("aria-busy", "true");
              primaryBtn.disabled = true;
              if (forceBtn) forceBtn.disabled = true;
              primaryLabel.textContent = "Скачиваю";
              let dots = 0;
              dotsTimer = setInterval(() => {
                dots = (dots + 1) % 4;
                primaryLabel.textContent = "Скачиваю" + ".".repeat(dots);
              }, 400);
              await window.electron.tools.installAll();
              await renderToolsInfo();
            } catch (e) {
              console.error("[toolsInfo] force installAll failed:", e);
              primaryBtn.disabled = false;
              if (forceBtn) forceBtn.disabled = false;
              primaryLabel.textContent = prevText || "Проверить обновления";
            } finally {
              isInstalling = false;
              primaryBtn.removeAttribute("aria-busy");
              applyNetworkState();
              if (dotsTimer) clearInterval(dotsTimer);
            }
          };
        };

        // handler: check updates (uses existing logic)
        primaryBtn.onclick = async () => {
          if (isChecking) return;
          if (!navigator.onLine) {
            await window.electron.invoke(
              "toast",
              "Нет сети: проверьте подключение",
              "warning",
            );
            return;
          }
          // быстрый контроль: если в процессе рендера что-то исчезло
          const cur = await window.electron.tools.getVersions();
          if (!cur?.ytDlp?.ok || !cur?.ffmpeg?.ok) {
            await renderToolsInfo();
            return;
          }
          let promotedToUpdateMode = false;
          isChecking = true;
          primaryBtn.disabled = true;
          applyNetworkState();
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
            // Some environments return stale "latest"; request a fresh fetch
            // Ask main to bypass any cached metadata if supported
            const upd = await window.electron.tools.checkUpdates({ noCache: true, forceFetch: true });

            // --- Version comparison helpers
            function parseYtDlpVer(v) {
              // Expects YYYY.MM.DD or vYYYY.MM.DD
              v = normVer(v);
              const m = v.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
              if (!m) return null;
              return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
            }
            function cmpYtDlp(a, b) {
              // Returns 1 if a > b, 0 if equal, -1 if a < b
              const va = parseYtDlpVer(a), vb = parseYtDlpVer(b);
              if (!va || !vb) return null;
              for (let i = 0; i < 3; ++i) {
                if (va[i] > vb[i]) return 1;
                if (va[i] < vb[i]) return -1;
              }
              return 0;
            }
            function parseSemverDetailed(v) {
              v = normVer(v);
              v = v.split('-')[0].split('+')[0];
              const m = v.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
              if (!m) return null;
              return {
                major: parseInt(m[1] || '0', 10),
                minor: parseInt(m[2] || '0', 10),
                patch: m[3] !== undefined ? parseInt(m[3], 10) : null, // null => patch was absent
                hadPatch: m[3] !== undefined,
              };
            }
            // Compare LATEST vs CURRENT with special rule: if LATEST has no patch (e.g. 7.1) and CURRENT is 7.1.X -> treat as equal
            function cmpFfSemver(latest, current) {
              const L = parseSemverDetailed(latest);
              const C = parseSemverDetailed(current);
              if (!L || !C) return null;
              if (L.major === C.major && L.minor === C.minor && L.patch === null) {
                // Latest lacks a patch component: consider any 7.1.x as equal to 7.1
                return 0;
              }
              const lp = L.patch == null ? 0 : L.patch;
              const cp = C.patch == null ? 0 : C.patch;
              if (L.major !== C.major) return L.major > C.major ? 1 : -1;
              if (L.minor !== C.minor) return L.minor > C.minor ? 1 : -1;
              if (lp !== cp) return lp > cp ? 1 : -1;
              return 0;
            }

            // Use executed local versions from `upd.*.current` (main runs binaries), compare to latest
            const yCurUpd = normVer(upd?.ytDlp?.current || "");
            const fCurUpd = normVer(upd?.ffmpeg?.current || "");
            const yLatN = normVer(upd?.ytDlp?.latest || "");
            const fLatN = normVer(upd?.ffmpeg?.latest || "");

            // Also compute local versions from the previously fetched `cur` (getVersions)
            const yCurLocal = normVer(
              firstLine(cur?.ytDlp?.version || "").replace(/^v/i, "")
            );
            const fCurLocal = normVer(
              firstLine(cur?.ffmpeg?.version || "")
                .replace(/^ffmpeg version\s*/i, "")
                .split(" ")[0]
            );

            // --- Comparison logic
            // yt-dlp: use yCurUpd for real current, fallback to yCurLocal if missing
            // ffmpeg: same
            const ytCur = yCurUpd || yCurLocal || "";
            const ffCur = fCurUpd || fCurLocal || "";
            const ytLatest = yLatN;
            const ffLatest = fLatN;

            // Compare: latest > current?
            let ytCmp = null, ffCmp = null;
            if (ytCur && ytLatest) ytCmp = cmpYtDlp(ytLatest, ytCur);
            if (ffCur && ffLatest) ffCmp = cmpFfSemver(ffLatest, ffCur);
            // Safety: if latest has no patch and major/minor match, treat as equal even if comparator returned -1
            if (ffCur && ffLatest) {
              const Ld = parseSemverDetailed(ffLatest);
              const Cd = parseSemverDetailed(ffCur);
              if (ffCmp === -1 && Ld && Cd && Ld.major === Cd.major && Ld.minor === Cd.minor && Ld.patch === null) {
                ffCmp = 0;
              }
            }

            // Update is available only if latest > current
            const ytCan = ytCmp === 1;
            const ffCan = ffCmp === 1;
            const anyUpdate = ytCan || ffCan;
            const unknownLatest = !!(upd?.ytDlp?.unknownLatest || upd?.ffmpeg?.unknownLatest);

            // Message building
            const msgs = [];
            if (upd?.ytDlp) {
              if (ytCur && ytLatest) {
                if (ytCmp === 1) {
                  msgs.push(
                    `yt-dlp: доступна ${upd.ytDlp.latest} (текущая ${upd.ytDlp.current || upd.ytDlp.local || yCurLocal || "—"})`
                  );
                } else if (ytCmp === 0) {
                  msgs.push(
                    `yt-dlp: актуальная (${upd.ytDlp.current || upd.ytDlp.local || yCurLocal || "—"})`
                  );
                } else if (ytCmp === -1) {
                  const curTxt = upd.ytDlp.current || upd.ytDlp.local || yCurLocal || "—";
                  msgs.push(`yt-dlp: актуальная (${curTxt})`);
                }
              } else if (ytCur) {
                msgs.push(`yt-dlp: текущая версия (${ytCur})`);
              }
            }
            if (upd?.ffmpeg) {
              if (ffCur && ffLatest) {
                if (ffCmp === 1) {
                  msgs.push(
                    `ffmpeg: доступна ${upd.ffmpeg.latest} (текущая ${upd.ffmpeg.current || upd.ffmpeg.local || fCurLocal || "—"})`
                  );
                } else if (ffCmp === 0) {
                  msgs.push(
                    `ffmpeg: актуальная (${upd.ffmpeg.current || upd.ffmpeg.local || fCurLocal || "—"})`
                  );
                } else if (ffCmp === -1) {
                  const curTxt = upd.ffmpeg.current || upd.ffmpeg.local || fCurLocal || "—";
                  msgs.push(`ffmpeg: актуальная (${curTxt})`);
                }
              } else if (ffCur) {
                msgs.push(`ffmpeg: текущая версия (${ffCur})`);
              }
            }
            if (upd?.ytDlp && upd.ytDlp.unknownLatest && !upd.ytDlp.latest) {
              msgs.push("yt-dlp: не удалось получить последнюю версию (GitHub API)");
            }
            if (upd?.ffmpeg && upd.ffmpeg.unknownLatest && !upd.ffmpeg.latest) {
              msgs.push("ffmpeg: не удалось определить последнюю версию");
            }
            const ytMsg = msgs.find((m) => m.startsWith("yt-dlp")) || "";
            const ffMsg = msgs.find((m) => m.startsWith("ffmpeg")) || "";
            const summaryHtml = [ytMsg, ffMsg].filter(Boolean).join("<br>");
            if (statusEl) statusEl.innerHTML = summaryHtml || "Обновлений не найдено.";

            if (anyUpdate) {
              if (forceBtn) forceBtn.style.display = "none";

              // Decide what to update
              const updateYt = ytCan && !ffCan;
              const updateFf = ffCan && !ytCan;
              const updateBoth = ytCan && ffCan;

              // Configure primary button UI
              const btnTitle = updateBoth
                ? "Обновить инструменты"
                : updateYt
                ? "Обновить yt-dlp"
                : "Обновить ffmpeg";
              const btnLabel = btnTitle;
              primaryBtn.setAttribute("title", btnTitle);
              primaryBtn.setAttribute("data-bs-toggle", "tooltip");
              primaryLabel.textContent = btnLabel;
              primaryIcon.className = "fa-solid fa-download";

              // Rebind click to update only the needed tool(s)
              primaryBtn.onclick = async () => {
                isInstalling = true;
                applyNetworkState();
                primaryBtn.setAttribute("aria-busy", "true");
                if (!navigator.onLine) {
                  await window.electron.invoke("toast", "Нет сети: проверьте подключение", "warning");
                  isInstalling = false;
                  primaryBtn.removeAttribute("aria-busy");
                  applyNetworkState();
                  return;
                }
                const prevText2 = primaryLabel.textContent;
                let dotsTimer2;
                try {
                  primaryBtn.disabled = true;
                  primaryLabel.textContent = "Скачиваю";
                  let dots = 0;
                  dotsTimer2 = setInterval(() => {
                    dots = (dots + 1) % 4;
                    primaryLabel.textContent = "Скачиваю" + ".".repeat(dots);
                  }, 400);

                  if (updateBoth) {
                    // Update both sequentially to keep logs tidy
                    await window.electron.tools.updateYtDlp();
                    await window.electron.tools.updateFfmpeg();
                  } else if (updateYt) {
                    await window.electron.tools.updateYtDlp();
                  } else if (updateFf) {
                    await window.electron.tools.updateFfmpeg();
                  }

                  await renderToolsInfo();
                } catch (e2) {
                  console.error("[toolsInfo] selective update failed:", e2);
                  primaryBtn.disabled = false;
                  primaryLabel.textContent = prevText2 || btnLabel;
                } finally {
                  isInstalling = false;
                  primaryBtn.removeAttribute("aria-busy");
                  applyNetworkState();
                  if (dotsTimer2) clearInterval(dotsTimer2);
                }
              };
              promotedToUpdateMode = true;
              await window.electron.invoke(
                "toast",
                [ytMsg, ffMsg].filter(Boolean).join("; ") || "Доступны обновления",
                "success",
              );
            } else {
              // If latest is unknown (rate limit / network issue), still allow force reinstall
              if (unknownLatest) {
                enableForceReinstall();
              } else {
                enableForceReinstall(); // keep available for manual downgrade fix
              }
              await window.electron.invoke(
                "toast",
                [ytMsg, ffMsg].filter(Boolean).join("; ") || "Обновлений не найдено",
                "success",
              );
            }
          } catch (err) {
            console.error("[toolsInfo] check updates failed:", err);
            if (statusEl)
              statusEl.textContent = "Ошибка при проверке обновлений";
            await window.electron.invoke(
              "toast",
              `Ошибка: ${err.message}`,
              "error",
            );
          } finally {
            isChecking = false;
            primaryBtn.removeAttribute("aria-busy");
            applyNetworkState();
            primaryIcon.classList.remove("fa-spin");
            if (!promotedToUpdateMode) {
              primaryLabel.textContent = prevText || "Проверить обновления";
            } else {
              // keep the button in update mode
              primaryLabel.textContent = "Обновить инструменты";
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
        const curY = res?.ytDlp?.ok
          ? firstLine(res.ytDlp.version).replace(/^v/i, "")
          : "—";
        const curF = res?.ffmpeg?.ok
          ? firstLine(res.ffmpeg.version)
              .replace(/^ffmpeg version\s*/i, "")
              .split(" ")[0]
          : "—";
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
        const curF = firstLine(res.ffmpeg.version)
          .replace(/^ffmpeg version\s*/i, "")
          .split(" ")[0];
        statusEl.innerHTML = `yt-dlp: ${curY}<br>ffmpeg: ${curF}`;
      } else {
        const absent = [];
        if (!res?.ytDlp?.ok) absent.push("yt-dlp");
        if (!res?.ffmpeg?.ok) absent.push("ffmpeg");
        statusEl.textContent = absent.length
          ? `Отсутствует: ${absent.join(", ")}`
          : "";
      }
    }
  } catch (e) {
    hintEl.textContent = "Не удалось получить версии инструментов.";
    console.error("[toolsInfo] getVersions failed:", e);
  }
  if (typeof initTooltips === "function") {
    initTooltips();
  }
}
