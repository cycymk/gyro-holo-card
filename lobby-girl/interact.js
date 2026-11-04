/* Lobby Girl interaction layer: power on/sleep, generated lo-fi music + ambience,
   voice lines (Web Speech), phone-down listening mode and face-detected talk mode. */
(() => {
const LG = window.LG = window.LG || {};
LG.rest = 1; // start asleep

// ---------------- lines (edit freely) ----------------
const LINES = {
  boot:   ["嗯……系統啟動了。你回來啦。", "早安……雖然我不知道現在幾點。"],
  idle:   ["今天的光線很溫柔，適合什麼都不做。", "我的記憶體裡，存著你上次來的時間。", "油又滴下來了。沒關係，那代表我還在運轉。", "音樂再大聲一點？我想多躺一下。"],
  head:   ["頭髮亂了啦……", "嗯？摸頭可以，輕一點。"],
  arm:    ["這隻手臂的關節有點卡，你聽到了嗎？", "要我比個姿勢嗎？好吧。"],
  leg:    ["換個姿勢坐，比較不會生鏽。", "腳有點麻……"],
  body:   ["別一直盯著生鏽的地方看啦。", "嗯……這裡的外殼很久沒保養了。"],
  sleep:  ["我先休息一下……有事再叫醒我。", "進入待機。晚安。"],
  face:   ["啊，你在看我。", "嗨，看得到你喔。", "你拿起手機了，要跟我說話嗎？"],
  listen: ["那我就安靜陪你聽歌。", "放著也好，我會一直在。"],
};
const REPLIES = [
  [/做什麼|在幹嘛|幹嘛/, ["在發呆，順便等你。", "數灰塵，一顆、兩顆……"]],
  [/歌|音樂|聽/, ["這首是我自己哼的，慵懶吧？我幫你調大一點。"], () => setVolume(Math.min(1, vol + 0.15))],
  [/晚安|睡|休息/, ["晚安。我也要進入待機了。"], () => setTimeout(() => setPower(false), 2200)],
  [/妳是誰|你是誰|名字/, ["編號 L-07，大廳的接待員。不過現在只負責陪你。"]],
  [/漂亮|可愛|好看/, ["……謝謝。外殼都生鏽了還這樣說。"]],
  [/./, ["嗯？再說一次嘛。", "我在聽。", "這個我還不懂，但我記下來了。"]],
];
const pick = a => a[Math.random() * a.length | 0];

// ---------------- UI ----------------
const css = document.createElement("style");
css.textContent = `
.dim{position:fixed;inset:0;background:#05040a;opacity:.62;pointer-events:none;transition:opacity 1.6s ease;z-index:2}
body.awake .dim{opacity:0}
.dock{pointer-events:auto;background:var(--panel);backdrop-filter:blur(8px);border:1px solid var(--line);border-radius:12px;padding:8px 10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.pwr{width:38px;height:38px;border-radius:50%;padding:0;font-size:17px;flex:none}
body.awake .pwr{background:var(--cyan);border-color:var(--cyan);color:#082429}
.mode{font-size:12px;display:flex;align-items:center;gap:6px;flex:none;white-space:nowrap}
.ui{z-index:3}
.top,.toast,.camlabel{z-index:4}
.mode i{width:8px;height:8px;border-radius:50%;background:var(--mute);flex:none}
body:not(.awake) .mode i{animation:breathe 3.2s ease-in-out infinite}
body.awake .mode i{background:#6be38a}
body.booting .mode i{background:#ffd166;animation:breathe .6s ease-in-out infinite}
@keyframes breathe{0%,100%{opacity:.25}50%{opacity:1}}
.vol{display:none;align-items:center;gap:6px;font-size:12px;color:var(--mute);flex:1 1 140px}
body.awake .vol{display:flex}
.vol input{flex:1;accent-color:var(--cyan)}
.sense{font-size:12px}
.sense[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#2a0f04}
.sub{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--uih,180px) + 12px);max-width:min(88vw,520px);background:rgba(10,8,14,.72);color:#fff;font-size:14px;line-height:1.5;padding:8px 14px;border-radius:10px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:6;text-align:center}
.sub.on{opacity:1}
body.immersive .sub{bottom:calc(84px + env(safe-area-inset-bottom))}
.mini{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:calc(12px + env(safe-area-inset-bottom));display:none;gap:8px;align-items:center;z-index:6;background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:4px 10px 4px 4px;font-size:12px}
body.immersive .mini{display:flex}
.chat{display:none;flex-direction:column;gap:8px}
body.talk .chat{display:flex}
body.talk .ctl{display:none}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chips button{font-size:12px;padding:5px 10px}
.chat form{display:flex;gap:6px}
.chat input{flex:1;min-width:0;font:inherit;font-size:14px;color:var(--fg);background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:999px;padding:7px 12px}
.camdot{font-size:11px;color:var(--mute)}
`;
document.head.appendChild(css);

const ui = () => document.querySelector(".ui");
function buildUI() {
  const dim = document.createElement("div"); dim.className = "dim"; document.body.insertBefore(dim, document.querySelector(".ui"));
  const sub = document.createElement("div"); sub.className = "sub"; sub.id = "sub"; document.body.appendChild(sub);
  const dock = document.createElement("div"); dock.className = "dock";
  dock.innerHTML = `<button class="pwr" id="pwr" aria-label="開機或休眠">⏻</button>
    <div class="mode"><i></i><span id="modeTxt">休眠待機</span><span class="camdot" id="camdot"></span></div>
    <label class="vol">音量 <input id="vol" type="range" min="0" max="1" step="0.01" value="0.6"></label>
    <button class="sense" id="sense" aria-pressed="false">感應</button>`;
  const chat = document.createElement("div"); chat.className = "dock chat";
  chat.innerHTML = `<div class="chips"><button data-q="妳在做什麼？">妳在做什麼？</button><button data-q="想聽歌">想聽歌</button><button data-q="妳是誰？">妳是誰？</button><button data-q="晚安">晚安</button></div>
    <form id="chatForm"><input id="chatIn" placeholder="跟她說話…" autocomplete="off"><button class="primary" type="submit">送出</button></form>`;
  const u = ui();
  [...u.children].forEach(c => c.classList.add("ctl"));
  u.prepend(chat); u.prepend(dock);
  const mini = document.createElement("div"); mini.className = "mini";
  mini.innerHTML = `<button class="pwr" id="pwr2" aria-label="開機或休眠">⏻</button><span id="modeTxt2">休眠待機</span>`;
  document.body.appendChild(mini);

  $("pwr").onclick = $("pwr2").onclick = () => setPower(!awake);
  $("vol").oninput = e => setVolume(+e.target.value);
  $("sense").onclick = toggleSense;
  chat.querySelectorAll("[data-q]").forEach(b => b.onclick = () => ask(b.dataset.q));
  $("chatForm").onsubmit = e => { e.preventDefault(); const v = $("chatIn").value.trim(); if (v) ask(v); $("chatIn").value = ""; };
  new ResizeObserver(() => document.body.style.setProperty("--uih", u.offsetHeight + "px")).observe(u);
}
const $ = id => document.getElementById(id);
function setMode(t) { $("modeTxt").textContent = t; $("modeTxt2").textContent = t; }

// ---------------- speech + subtitles ----------------
let subT, voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /zh[-_]TW/i.test(v.lang)) || vs.find(v => /zh[-_](HK|CN)|zh/i.test(v.lang)) || null;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
let lastSay = 0;
function say(line, opts = {}) {
  if (!line) return;
  const now = performance.now(); if (!opts.force && now - lastSay < 2500) return; lastSay = now;
  const sub = $("sub"); sub.textContent = line; sub.classList.add("on"); clearTimeout(subT);
  subT = setTimeout(() => sub.classList.remove("on"), 1800 + line.length * 180);
  if (!("speechSynthesis" in window) || !voiceOn) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(line); if (voice) u.voice = voice; u.lang = voice ? voice.lang : "zh-TW";
  u.rate = 0.9; u.pitch = 1.15; u.volume = 1;
  u.onstart = () => duck(true); u.onend = u.onerror = () => duck(false);
  speechSynthesis.speak(u);
}
let voiceOn = true;

// ---------------- audio: generated lo-fi + ambience ----------------
let ac, master, bgmBus, ambBus, bgmLevel = 0, vol = 0.6, playing = false, nextBar = 0, bar = 0, duckOn = false, modeGain = 1;
function initAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
  // reverb from generated impulse
  const rev = ac.createConvolver(), len = ac.sampleRate * 2.8, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  rev.buffer = ir; const revG = ac.createGain(); revG.gain.value = 0.35; rev.connect(revG); revG.connect(master);
  bgmBus = ac.createGain(); bgmBus.gain.value = 0; bgmBus.connect(master); bgmBus.connect(rev);
  ambBus = ac.createGain(); ambBus.gain.value = 0; ambBus.connect(master);
  LG.audio = { ac, rev };
  // ambience: brown-noise air with slow swell + faint machine hum
  const nb = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate), nd = nb.getChannelData(0); let last = 0;
  for (let i = 0; i < nd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; nd[i] = last * 3.5; }
  const air = ac.createBufferSource(); air.buffer = nb; air.loop = true;
  const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
  const airG = ac.createGain(); airG.gain.value = 0.5;
  const lfo = ac.createOscillator(), lfoG = ac.createGain(); lfo.frequency.value = 0.07; lfoG.gain.value = 0.25; lfo.connect(lfoG); lfoG.connect(airG.gain);
  air.connect(lp); lp.connect(airG); airG.connect(ambBus); air.start(); lfo.start();
  const hum = ac.createOscillator(), humG = ac.createGain(); hum.frequency.value = 55; humG.gain.value = 0.025; hum.connect(humG); humG.connect(ambBus); hum.start();
  // vinyl crackle (part of the music)
  const cb = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate), cd = cb.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() < 0.0009 ? (Math.random() * 2 - 1) : 0) + (Math.random() * 2 - 1) * 0.012;
  const cr = ac.createBufferSource(); cr.buffer = cb; cr.loop = true; const crf = ac.createBiquadFilter(); crf.type = "bandpass"; crf.frequency.value = 2500; crf.Q.value = 0.6;
  const crg = ac.createGain(); crg.gain.value = 0.35; cr.connect(crf); crf.connect(crg); crg.connect(bgmBus); cr.start();
  ramp(ambBus.gain, 0.35, 2);
  scheduler();
}
function ramp(param, v, t) { const n = ac.currentTime; param.cancelScheduledValues(n); param.setValueAtTime(param.value, n); param.linearRampToValueAtTime(v, n + t); }
function bgmTarget() { return playing ? vol * (duckOn ? 0.55 : 1) * modeGain : 0; }
function applyBgm(t = 0.8) { if (ac) ramp(bgmBus.gain, bgmTarget() * 0.9, t); }
function setVolume(v) { vol = v; $("vol").value = v; applyBgm(0.3); }
function duck(on) { duckOn = on; applyBgm(0.5); }

// lazy progression in F: Fmaj9 - Em7 - Dm9 - Cmaj7/G  (70 bpm, 2 bars each)
const BPM = 70, BEAT = 60 / BPM;
const CHORDS = [[53, 57, 60, 64, 67], [52, 55, 59, 62, 64], [50, 53, 57, 60, 64], [43, 55, 59, 60, 64]];
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function ep(t, m, v, dur) {
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
  o1.type = "sine"; o2.type = "triangle"; o1.frequency.value = hz(m); o2.frequency.value = hz(m) * 2.002;
  const g2 = ac.createGain(); g2.gain.value = 0.18; o2.connect(g2); g2.connect(g); o1.connect(g);
  f.type = "lowpass"; f.frequency.value = 1700; g.connect(f); f.connect(bgmBus);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.025); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
}
function bass(t, m, dur) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = hz(m - 12);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(bgmBus); o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf;
function hat(t, v) {
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = 7000;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06); s.connect(f); f.connect(g); g.connect(bgmBus); s.start(t); s.stop(t + 0.1);
}
function kick(t) {
  const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g); g.connect(bgmBus); o.start(t); o.stop(t + 0.4);
}
function scheduleBar(t, i) {
  const ch = CHORDS[(i >> 1) % CHORDS.length], first = i % 2 === 0;
  if (first) ch.forEach((m, k) => ep(t + k * 0.045 + Math.random() * 0.02, m, 0.07, BEAT * 7.5));
  else { [ch[2], ch[3], ch[4], ch[3]].forEach((m, k) => ep(t + BEAT * (k + 0.5) + (k % 2 ? BEAT * 0.12 : 0), m + 12, 0.035, BEAT * 1.8)); }
  bass(t, ch[0], BEAT * 2.2); bass(t + BEAT * 2.5, ch[0], BEAT * 1.4);
  kick(t); kick(t + BEAT * 2.5);
  for (let b = 0; b < 4; b++) hat(t + BEAT * (b + 0.5) + BEAT * 0.1, 0.05 + Math.random() * 0.02);
}
function scheduler() {
  if (!ac) return;
  if (nextBar < ac.currentTime) nextBar = ac.currentTime + 0.1;
  while (nextBar < ac.currentTime + 1.5) { scheduleBar(nextBar, bar++); nextBar += BEAT * 4; }
  setTimeout(scheduler, 400);
}

// ---------------- power ----------------
let awake = false, restTarget = 1, idleTalkT;
function setPower(on) {
  initAudio(); if (ac.state === "suspended") ac.resume();
  if (on === awake) return;
  awake = on;
  if (on) {
    document.body.classList.add("booting"); setMode("啟動中…");
    if ("speechSynthesis" in window) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } // unlock iOS speech
    setTimeout(() => {
      document.body.classList.remove("booting"); document.body.classList.add("awake"); restTarget = 0;
      playing = true; ramp(bgmBus.gain, 0, 0.01); applyBgm(4.5); ramp(ambBus.gain, 0.18, 3);
      setMode(modeLabel()); setTimeout(() => say(pick(LINES.boot), { force: true }), 1600);
      scheduleIdleTalk();
    }, 1400);
  } else {
    say(pick(LINES.sleep), { force: true });
    playing = false; applyBgm(2.2); ramp(ambBus.gain, 0.4, 3);
    document.body.classList.remove("awake", "talk"); restTarget = 1; setMode("休眠待機"); clearTimeout(idleTalkT);
  }
}
function scheduleIdleTalk() { clearTimeout(idleTalkT); idleTalkT = setTimeout(() => { if (awake && mode !== "listen") say(pick(LINES.idle)); scheduleIdleTalk(); }, 35000 + Math.random() * 25000); }
(function restLoop() { LG.rest += (restTarget - LG.rest) * 0.03; requestAnimationFrame(restLoop); })();

// taps on parts: only react while awake, and speak a line now and then
LG.onPart = g => {
  if (!awake) { LG.toast && LG.toast("休眠中：按 ⏻ 喚醒"); return false; }
  if (Math.random() < 0.6 && LINES[g.key]) say(pick(LINES[g.key]));
};

// ---------------- chat (canned replies; swap ask() for an AI endpoint later) ----------------
function ask(q) {
  if (!awake) setPower(true);
  for (const [re, ans, fx] of REPLIES) if (re.test(q)) { setTimeout(() => say(pick(ans), { force: true }), 400); fx && fx(); return; }
}

// ---------------- sensing: phone down = listen, picked up + face = talk ----------------
let mode = "normal", sensing = false, flatSince = 0, faceAt = 0, ori = { b: 60, g: 0 }, video, detector, lastTalkLine = 0;
function modeLabel() { return mode === "listen" ? "聆聽模式" : mode === "talk" ? "對話模式" : "運作中"; }
function setModeState(m) {
  if (m === mode) return; mode = m;
  modeGain = m === "listen" ? 1.35 : m === "talk" ? 0.7 : 1; applyBgm(1.2);
  document.body.classList.toggle("talk", m === "talk");
  if (awake) setMode(modeLabel());
  if (m === "listen") say(pick(LINES.listen));
  if (m === "talk" && performance.now() - lastTalkLine > 20000) { lastTalkLine = performance.now(); say(pick(LINES.face), { force: true }); }
}
addEventListener("deviceorientation", e => { if (e.beta != null) ori = { b: e.beta, g: e.gamma }; });
function evalMode() {
  if (awake && sensing) {
    const now = performance.now(), flat = Math.abs(ori.b) < 18 && Math.abs(ori.g) < 18;
    if (flat) { if (!flatSince) flatSince = now; } else flatSince = 0;
    if (flatSince && now - flatSince > 1200) setModeState("listen");
    else if (!flat && now - faceAt < 1500) setModeState("talk");
    else if (!flat && mode === "listen") setModeState("normal");
    else if (!flat && mode === "talk" && now - faceAt > 6000) setModeState("normal");
  }
  setTimeout(evalMode, 250);
}
evalMode();

async function toggleSense() {
  if (sensing) { sensing = false; $("sense").setAttribute("aria-pressed", false); $("camdot").textContent = ""; if (video && video.srcObject) video.srcObject.getTracks().forEach(t => t.stop()); setModeState("normal"); return; }
  if (DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") { try { await DeviceOrientationEvent.requestPermission(); } catch (e) {} }
  sensing = true; $("sense").setAttribute("aria-pressed", true); $("camdot").textContent = "· 鏡頭啟動中";
  try {
    video = document.createElement("video"); video.playsInline = true; video.muted = true;
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 }, audio: false });
    await video.play();
    detector = await makeDetector();
    $("camdot").textContent = detector ? "· 鏡頭偵測中" : "· 只用姿態判斷";
    if (detector) faceLoop();
  } catch (e) {
    $("camdot").textContent = "· 無法使用鏡頭，只用姿態判斷";
    detector = null;
  }
  if (!detector) { (function fake() { if (!sensing) return; if (Math.abs(ori.b) > 35) faceAt = performance.now(); setTimeout(fake, 300); })(); }
}
async function makeDetector() {
  if ("FaceDetector" in window) { try { const fd = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); return { detect: async v => (await fd.detect(v)).length > 0 }; } catch (e) {} }
  try {
    const base = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
    const mp = await import(base + "/vision_bundle.mjs");
    const files = await mp.FilesetResolver.forVisionTasks(base + "/wasm");
    const fd = await mp.FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite", delegate: "GPU" },
      runningMode: "VIDEO", minDetectionConfidence: 0.5 });
    return { detect: async v => fd.detectForVideo(v, performance.now()).detections.length > 0 };
  } catch (e) { console.warn("face detector unavailable", e); return null; }
}
async function faceLoop() {
  if (!sensing || !detector) return;
  try { if (video.readyState >= 2 && await detector.detect(video)) faceAt = performance.now(); } catch (e) {}
  $("camdot").textContent = performance.now() - faceAt < 800 ? "· 偵測到人臉" : "· 鏡頭偵測中";
  setTimeout(faceLoop, 300);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildUI); else buildUI();
})();
