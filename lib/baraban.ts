// Звуковые дорожки к прокрутке: барабан под топ-дроп, своя музыка под «Голду».
// Телефоны разрешают звук только после нажатия, поэтому prime() — прямо в обработчике клика.
function track(src: string) {
  let audio: HTMLAudioElement | null = null;
  let fade: ReturnType<typeof setInterval> | undefined;
  const get = () => {
    if (typeof window === "undefined") return null;
    audio ??= new Audio(src);
    audio.preload = "auto";
    return audio;
  };
  return {
    prime() {
      const a = get();
      if (!a || !a.paused) return;
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
        })
        .catch(() => {
          a.muted = false;
        });
    },
    play(volume = 0.85) {
      const a = get();
      if (!a) return;
      clearInterval(fade);
      a.muted = false;
      a.volume = volume;
      a.currentTime = 0;
      a.play().catch(() => {});
    },
    // быстро гасим, чтобы не наложилось на фанфары
    stop() {
      const a = audio;
      if (!a || a.paused) return;
      clearInterval(fade);
      fade = setInterval(() => {
        if (a.volume > 0.08) a.volume = Math.max(0, a.volume - 0.08);
        else {
          clearInterval(fade);
          a.pause();
        }
      }, 30);
    },
  };
}

const baraban = track("/sounds/baraban.mp3");
const gold = track("/sounds/gold.mp3");

export const primeBaraban = () => (baraban.prime(), gold.prime());
export const playBaraban = () => baraban.play();
export const playGold = () => gold.play(0.9);
export const stopBaraban = () => (baraban.stop(), gold.stop());
