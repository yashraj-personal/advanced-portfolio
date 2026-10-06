import { asset } from "./asset";

// Module-level on purpose: these live outside React, so the sounds keep
// playing even after the Trash window (or the popup) is closed.
// A page refresh is the only thing that stops the loop.

let loopAudio = null;

/** Wrong password: plays the sad sound exactly twice. */
export const playWrongPasswordSound = () => {
  const audio = new Audio(asset("/sounds/tuta-hua-saaz.mp3"));
  let plays = 1;
  audio.addEventListener("ended", () => {
    if (plays < 2) {
      plays += 1;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  });
  audio.play().catch(() => {});
};

/** Correct password: starts the "emotional damage" sound on an endless loop. */
export const startUnstoppableLoop = () => {
  if (loopAudio) return; // already looping, never start a second copy
  loopAudio = new Audio(asset("/sounds/emotional-damage-meme.mp3"));
  loopAudio.loop = true;
  loopAudio.play().catch(() => {});
};
