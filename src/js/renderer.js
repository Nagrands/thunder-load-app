/**
 * @file renderer.js
 * @description Thin renderer entrypoint; orchestration lives in modules/app.
 */

import { startRenderer } from "./modules/app/bootstrapRenderer.js";
import { validateDomElements } from "./modules/domElements.js";

console.time("Renderer → Initialization");

const initializeRenderer = () => {
  validateDomElements();
  void startRenderer();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeRenderer);
} else {
  initializeRenderer();
}
