import { createRandomizerView } from "../features/randomizer/view/index.js";

export { createRandomizerView };

export default function renderRandomizerView() {
  const instance = createRandomizerView();
  return instance.element;
}
