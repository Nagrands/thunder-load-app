export function createRandomizerShell() {
  const element = document.createElement("div");
  element.id = "randomizer-view";
  element.className = "randomizer-view tab-content p-4";
  return { element };
}
