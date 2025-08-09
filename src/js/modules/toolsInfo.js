// src/js/modules/toolsInfo.js

function shortenPath(p, max = 80) {
  if (!p) return "";
  if (p.length <= max) return p;
  const head = Math.ceil(max / 2) - 1;
  const tail = Math.floor(max / 2) - 2;
  return p.slice(0, head) + "…" + p.slice(-tail);
}

function firstLine(s = "") {
  return s.split("\n")[0];
}

async function copyToClipboard(text, okMsg = "Скопировано") {
  try {
    await navigator.clipboard.writeText(text);
    window.electron.invoke("toast", okMsg, "success");
  } catch (e) {
    console.warn("copy failed", e);
  }
}

export async function renderToolsInfo() {
  const section = document.getElementById("tools-info");
  if (!section) return;

  // Базовая разметка (компактная и читаемая)
  section.innerHTML = `
    <h2>Инструменты</h2>

    <div class="kv tools-row" id="row-yt">
      <div>yt-dlp:</div>
      <div class="tools-col">
        <div class="tools-line">
          <span id="yt-ver" class="mono">—</span>
          <button id="copy-yt-ver" class="history-action-button" title="Скопировать версию">
            <i class="fa-regular fa-copy"></i>
          </button>
        </div>
        <div class="tools-line small">
          <span id="yt-path" class="mono" title="">—</span>
          <button id="copy-yt-path" class="history-action-button" title="Скопировать путь">
            <i class="fa-regular fa-copy"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="kv tools-row" id="row-ff">
      <div>ffmpeg:</div>
      <div class="tools-col">
        <div class="tools-line">
          <span id="ff-ver" class="mono">—</span>
          <button id="copy-ff-ver" class="history-action-button" title="Скопировать версию">
            <i class="fa-regular fa-copy"></i>
          </button>
        </div>
        <div class="tools-line small">
          <span id="ff-path" class="mono" title="">—</span>
          <button id="copy-ff-path" class="history-action-button" title="Скопировать путь">
            <i class="fa-regular fa-copy"></i>
          </button>
        </div>
      </div>
    </div>

    <small id="tools-hint" class="muted"></small>
  `;

  const ytVerEl = document.getElementById("yt-ver");
  const ytPathEl = document.getElementById("yt-path");
  const ffVerEl = document.getElementById("ff-ver");
  const ffPathEl = document.getElementById("ff-path");
  const hintEl = document.getElementById("tools-hint");

  const btnCopyYtVer = document.getElementById("copy-yt-ver");
  const btnCopyYtPath = document.getElementById("copy-yt-path");
  const btnCopyFfVer = document.getElementById("copy-ff-ver");
  const btnCopyFfPath = document.getElementById("copy-ff-path");

  try {
    const res = await window.electron.tools.getVersions();

    // yt-dlp
    if (res?.ytDlp?.ok) {
      const ver = firstLine(res.ytDlp.version);
      ytVerEl.textContent = ver || "—";
      ytPathEl.textContent = shortenPath(res.ytDlp.path);
      ytPathEl.title = res.ytDlp.path || "";
      btnCopyYtVer.onclick = () => copyToClipboard(ver, "Версия yt-dlp скопирована");
      btnCopyYtPath.onclick = () => copyToClipboard(res.ytDlp.path, "Путь yt-dlp скопирован");
    } else {
      ytVerEl.textContent = "не найдено";
      ytPathEl.textContent = "—";
      btnCopyYtVer.disabled = true;
      btnCopyYtPath.disabled = true;
    }

    // ffmpeg
    if (res?.ffmpeg?.ok) {
      const rawFf = firstLine(res.ffmpeg.version);
      const ver = rawFf.replace(/^ffmpeg version\s*/i, "").split(" ")[0];
      ffVerEl.textContent = ver || "—";
      ffPathEl.textContent = shortenPath(res.ffmpeg.path);
      ffPathEl.title = res.ffmpeg.path || "";
      btnCopyFfVer.onclick = () => copyToClipboard(ver, "Версия ffmpeg скопирована");
      btnCopyFfPath.onclick = () => copyToClipboard(res.ffmpeg.path, "Путь ffmpeg скопирован");
    } else {
      ffVerEl.textContent = "не найдено";
      ffPathEl.textContent = "—";
      btnCopyFfVer.disabled = true;
      btnCopyFfPath.disabled = true;
    }

    // хинт
    const missing = !res?.ytDlp?.ok || !res?.ffmpeg?.ok;
    hintEl.textContent = missing
      ? "Некоторые инструменты не найдены. Установите их или нажмите ‘Скачать зависимости’."
      : "";
  } catch (e) {
    ytVerEl.textContent = ffVerEl.textContent = "ошибка";
    hintEl.textContent = "Не удалось получить версии инструментов.";
    console.error("[toolsInfo] getVersions failed:", e);
  }
}