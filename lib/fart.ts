// Звук пука, синтезированный в браузере (Web Audio) — без файлов.
// Низкий «пилообразный» тон с дрожанием + шум через фильтр, несколько «сбоев» по ходу.
export function playFart(volume = 0.8) {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const now = ctx.currentTime;
  const dur = 0.9 + Math.random() * 0.4;

  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(ctx.destination);

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(900, now);
  lowpass.frequency.exponentialRampToValueAtTime(250, now + dur);
  lowpass.Q.value = 4;
  lowpass.connect(out);

  // основной тон
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  const base = 85 + Math.random() * 30;
  osc.frequency.setValueAtTime(base * 1.4, now);
  osc.frequency.exponentialRampToValueAtTime(base * 0.6, now + dur);

  // «трепыхание» частоты
  const flutter = ctx.createOscillator();
  flutter.frequency.value = 22 + Math.random() * 10;
  const flutterGain = ctx.createGain();
  flutterGain.gain.value = base * 0.35;
  flutter.connect(flutterGain).connect(osc.frequency);

  // огибающая с «сбоями»
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.9, now + 0.03);
  let t = now + 0.08;
  while (t < now + dur - 0.1) {
    const step = 0.06 + Math.random() * 0.12;
    env.gain.linearRampToValueAtTime(0.25 + Math.random() * 0.75, t + step);
    t += step;
  }
  env.gain.linearRampToValueAtTime(0, now + dur);
  osc.connect(env).connect(lowpass);

  // шум для «влажности»
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.linearRampToValueAtTime(0.35, now + 0.05);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  noise.connect(noiseGain).connect(lowpass);

  osc.start(now);
  flutter.start(now);
  noise.start(now);
  osc.stop(now + dur + 0.05);
  flutter.stop(now + dur + 0.05);
  noise.stop(now + dur + 0.05);
  setTimeout(() => ctx.close(), (dur + 0.3) * 1000);
}
