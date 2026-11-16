// Звуки рулеток: синтезируются в браузере (Web Audio), без файлов и чужих лицензий.
// Включено/выключено — общая настройка для кейсов, апгрейда и контрактов.

let ctx: AudioContext | null = null;
function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// Браузеры разрешают звук только после нажатия: вызывать прямо в обработчике клика,
// до любого await, — тогда звуки после ответа сервера тоже сыграют.
export function unlockAudio() {
  if (soundOn()) ac();
}

const KEY = "sfx";
export function soundOn() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
}

// Щелчок «трещотки», как когда карточка проходит под стрелкой
export function tick(volume = 0.25) {
  const c = ac();
  if (!c || !soundOn()) return;
  const t = c.currentTime;
  const out = c.createGain();
  out.gain.setValueAtTime(volume, t);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  out.connect(c.destination);

  const o = c.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(1900 + Math.random() * 300, t);
  o.frequency.exponentialRampToValueAtTime(700, t + 0.03);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2200;
  bp.Q.value = 1.2;
  o.connect(bp).connect(out);
  o.start(t);
  o.stop(t + 0.05);
}

// Короткий аккорд — выигрыш / удачный результат
export function win(volume = 0.22) {
  const c = ac();
  if (!c || !soundOn()) return;
  const t = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const g = c.createGain();
    const s = t + i * 0.07;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(volume, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.6);
    g.connect(c.destination);
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    o.connect(g);
    o.start(s);
    o.stop(s + 0.65);
  });
}

// Глухой «бум» — проигрыш
export function lose(volume = 0.3) {
  const c = ac();
  if (!c || !soundOn()) return;
  const t = c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  g.connect(c.destination);
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.4);
  o.connect(g);
  o.start(t);
  o.stop(t + 0.5);
}

// Следит за движущимся элементом и щёлкает каждый раз, когда он проходит очередной «шаг»
// (ширину карточки в ленте или сектор круга). Возвращает функцию остановки.
export function tickWhileMoving(el: HTMLElement, read: (m: DOMMatrix) => number, step: number, ms: number) {
  let last = Math.floor(read(new DOMMatrix(getComputedStyle(el).transform)) / step);
  let raf = 0;
  const end = performance.now() + ms;
  const loop = () => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    const cur = Math.floor(read(m) / step);
    if (cur !== last) {
      last = cur;
      tick();
    }
    if (performance.now() < end) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

export const readX = (m: DOMMatrix) => -m.m41;
// угол поворота в градусах, без скачка через 180°: считаем накопленно
export function angleReader() {
  let prev = 0;
  let total = 0;
  return (m: DOMMatrix) => {
    const a = (Math.atan2(m.m12, m.m11) * 180) / Math.PI;
    let d = a - prev;
    if (d < -180) d += 360;
    if (d > 180) d -= 360;
    prev = a;
    total += d;
    return total;
  };
}

// Для контракта: щелчки, которые постепенно замедляются
export function slowingTicks(ms: number) {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let t = 0;
  let gap = 45;
  while (t < ms - 120) {
    timers.push(setTimeout(() => tick(), t));
    t += gap;
    gap *= 1.12;
  }
  return () => timers.forEach(clearTimeout);
}
