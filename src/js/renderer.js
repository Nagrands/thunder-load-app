/**
 * @file renderer.js
 * @description Thin renderer entrypoint; orchestration lives in modules/app.
 */

import { startRenderer } from "./modules/app/bootstrapRenderer.js";

console.time("Renderer → Initialization");

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startRenderer);
} else {
  startRenderer();
}
