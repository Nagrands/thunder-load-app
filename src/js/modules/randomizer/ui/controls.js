// src/js/modules/randomizer/ui/controls.js

export function wireRollControls(wrapper, rollFn) {
  wrapper
    .querySelectorAll(".randomizer-roll")
    .forEach((btn) => btn.addEventListener("click", () => rollFn()));

  wrapper
    .querySelectorAll("#randomizer-roll, #randomizer-roll-hero")
    .forEach((btn) =>
      btn.addEventListener("keyup", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          rollFn();
        }
      }),
    );
}
