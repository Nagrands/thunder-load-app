// src/js/modules/randomizer/ui/result.js

import { triggerPulse } from "../helpers.js";

export function createResultUI({
  resultCard,
  resultContainer,
  resultText,
  resultMeta,
}) {
  const activate = () => {
    resultCard.classList.add("active");
    resultContainer.classList.add("has-result");
  };

  const clear = () => {
    resultText.textContent = "";
    resultMeta.textContent = "";
    resultCard.classList.remove("active");
    resultContainer.classList.remove("has-result");
  };

  const setResult = (value, meta) => {
    resultText.textContent = value;
    resultMeta.textContent = meta || "";
    activate();
  };

  const pulse = () => triggerPulse(resultContainer, "pop");

  return { activate, clear, setResult, pulse };
}
