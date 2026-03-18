import {
  isToolsInfoStale,
  refreshToolsInfoState,
  renderToolsInfo,
} from "../../toolsInfo.js";

const TOOLS_INFO_REFRESH_TTL_MS = 20_000;

let toolsInfoRendered = false;
let toolsRenderPromise = null;

export async function ensureToolsInfo(force = false) {
  if (toolsRenderPromise) return toolsRenderPromise;

  const shouldRefresh =
    toolsInfoRendered && (force || isToolsInfoStale(TOOLS_INFO_REFRESH_TTL_MS));
  if (toolsInfoRendered && !shouldRefresh) return null;

  toolsRenderPromise = (
    toolsInfoRendered
      ? refreshToolsInfoState({ force: true })
      : renderToolsInfo()
  )
    .then(() => {
      toolsInfoRendered = true;
    })
    .catch((error) => {
      console.error("[settings] renderToolsInfo failed:", error);
    })
    .finally(() => {
      toolsRenderPromise = null;
    });

  return toolsRenderPromise;
}
