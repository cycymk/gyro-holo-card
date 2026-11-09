/* Lobby Girl interaction layer: power on/sleep, generated lo-fi music + ambience,
   voice lines (Web Speech), phone-down listening mode and face-detected talk mode. */
(() => {
const LG = window.LG = window.LG || {};
LG.rest = 1; // start asleep

// ---------------- lines (edit freely) ----------------
const LINES = {
  boot:   ["嗯……系統啟動了。你回來啦。"],
  // greetings by the phone's clock (picked on wake-up)
  morning:  ["早安，今天也一起慢慢開始吧。", "早上好，窗外的光剛剛好。"],          // 05–11
  noon:     ["午安，記得吃飯喔。", "中午了，要不要休息一下？"],                  // 11–14
  afternoon:["下午好，累了就靠在這裡吧。", "午後的時間，最適合發呆了。"],        // 14–18
  evening:  ["晚上好，今天辛苦了。", "你回來啦，晚上想聽點什麼？"],              // 18–22
  bedtime:  ["這麼晚了還沒睡呀？", "睡前陪你一下，等你睡著我再休息。"],          // 22–05
  idle:   ["今天的光線很溫柔，適合什麼都不做。", "我的記憶體裡，存著你上次來的時間。", "油又滴下來了。沒關係，那代表我還在運轉。", "音樂再大聲一點？我想多躺一下。"],
  head:   ["哎，頭髮都亂了啦。", "嗯？摸頭可以，輕一點。"],
  arm:    ["這隻手臂的關節有點卡，你聽到了嗎？", "要我比個姿勢嗎？好吧。"],
  leg:    ["換個姿勢坐，比較不會生鏽。", "腳有點麻……"],
  body:   ["別一直盯著生鏽的地方看啦。", "嗯……這裡的外殼很久沒保養了。"],
  sleep:  ["我先休息一下……有事再叫醒我。", "進入待機。晚安。"],
  face:   ["啊，你在看我。", "嗨，看得到你喔。", "你拿起手機了，要跟我說話嗎？"],
  listen: ["那我就安靜陪你聽歌。", "放著也好，我會一直在。"],
  near:   ["……靠這麼近，我小聲一點說喔。", "噓，這樣就只有你聽得到了。"],
  headRub: ["嗯？摸頭可以，輕一點。"],
  headGood:["好舒服……再摸一下。"],
  headLove:["最喜歡你了！", "嘿嘿，今天被摸得好開心。"],
  chest:  ["欸，你在碰哪裡啦。", "……不要一直碰那裡。"],
  angry:  ["再碰我就要生氣了！", "哼，不理你了。"],
  waist:  ["哈哈，好癢！", "好癢，不要碰腰啦。"],
  heard:  ["嗯？我在。", "叫我嗎？我醒著喔。"],
  music:  ["好，幫你打開 Music。"],
  ownMusic:["好，換回我的輕音樂。"],
  podcast:["好，幫你打開 Podcast。"],
};
const REPLIES = [
  [/做什麼|在幹嘛|幹嘛/, ["在發呆，順便等你呀。", "我在發呆，看灰塵飄來飄去。"]],
  [/關.{0,2}(音樂|music)|停.{0,2}(音樂|music)|不聽了/i, [], () => stopExtMusic()],
  [/想聽歌|聽歌|播.{0,2}(音樂|歌)|放.{0,2}(音樂|歌)|打開.{0,2}music/i, [], () => openApp("music", true)],
  [/大聲/, ["這首是我自己哼的，慵懶吧？我幫你調大一點。"], () => setVolume(Math.min(1, vol + 0.15))],
  [/晚安|睡|休息/, ["晚安。我也要進入待機了。"], () => setTimeout(() => setPower(false), 2200)],
  [/妳是誰|你是誰|名字/, ["編號 L-07，大廳的接待員。不過現在只負責陪你。"]],
  [/漂亮|可愛|好看/, ["……謝謝。外殼都生鏽了還這樣說。"]],
  [/./, ["嗯？再說一次嘛。", "我在聽。", "這個我還不懂，但我記下來了。"]],
];
const lastPick = new Map();
function greetSlot(d = new Date()) {
  const h = d.getHours();
  return h >= 5 && h < 11 ? "morning" : h < 14 && h >= 11 ? "noon" : h >= 14 && h < 18 ? "afternoon" : h >= 18 && h < 22 ? "evening" : "bedtime";
}
LG.greetSlot = greetSlot;
const pick = a => { let v = a[Math.random() * a.length | 0]; if (a.length > 1 && lastPick.get(a) === v) v = a[(a.indexOf(v) + 1) % a.length]; lastPick.set(a, v); return v; };

// ---------------- UI wiring (markup lives in index.html) ----------------
const $ = id => document.getElementById(id);
function wireUI() {
  $("pwr").onclick = $("pwr2").onclick = () => setPower(!awake);
  $("vol").oninput = e => setVolume(+e.target.value);
  $("sense").onclick = toggleSense;
  $("mic").onclick = toggleMic;
  $("spNext").onclick = () => playSfx(qi + 1);
  $("spEnd").onclick = endSpecial;
  sfxEl.onended = () => { if (special && !sfxEl.loop) setTimeout(() => playSfx(qi + 1), 900); };
  document.querySelectorAll("#chat [data-q]").forEach(b => b.onclick = () => ask(b.dataset.q));
  $("chatForm").onsubmit = e => { e.preventDefault(); const v = $("chatIn").value.trim(); if (v) ask(v); $("chatIn").value = ""; };
  $("voiceTgl").onclick = () => { voiceOn = !voiceOn; $("voiceTgl").setAttribute("aria-pressed", voiceOn); };
}
function setMode(t) { $("modeTxt").textContent = t; $("modeTxt2").textContent = t; }

// ---------------- voice control: "Hey 拉比" wakes her; "播音樂" → Music, "打開 Podcast" → Podcasts ----------------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const WAKE = /(hey|hi|嘿|黑|嗨|海|欸|诶|喂)?\s*(拉|辣|啦|喇|蠟|腊)\s*(比|筆|笔|必|逼|b|鼻)/i;
const CMD_MUSIC = /(播|放|開|开|打開|打开).{0,3}(音樂|音乐|music|歌)/i;
const CMD_POD = /(podcast|播客|pod\s*cast|帕德|波德卡斯)/i;
let rec = null, micOn = false, lastCmd = 0;
const APP = {
  music:   isIOS ? "music://" : "intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_MUSIC;end",
  podcast: isIOS ? "podcasts://" : "https://music.youtube.com/podcasts",
};
// external music: Music app plays in the background; our own lo-fi stops and her voice mixes on top ("ambient")
let extMusic = false;
function setSession(t) { try { if (navigator.audioSession) navigator.audioSession.type = t; } catch (e) {} }
function stopExtMusic() {
  did("music");
  // a web page can't close Music, but taking the "playback" audio focus makes iOS pause it
  extMusic = false; setSession("playback");
  initAudio(); if (ac.state !== "running") ac.resume();
  if (awake) { playing = true; applyBgm(3); }
  setTimeout(() => say(pick(LINES.ownMusic), { force: true }), 300);
}
LG.stopExtMusic = stopExtMusic;
function openApp(kind, fromTap) {
  if (kind === "music") did("music");
  if (kind === "music") { extMusic = true; setSession("ambient"); }
  say(pick(LINES[kind]), { force: true });
  // give her line a moment (voice command), or go right away (tap: iOS only allows the jump inside the tap)
  const go = () => {
    if (playing) { playing = false; applyBgm(0.6); LG.toast && LG.toast("輕音樂已暫停，說「關音樂」換回來"); }
    const a = document.createElement("a"); a.href = APP[kind]; a.rel = "noopener"; if (/^https?:/.test(APP[kind])) a.target = "_blank"; document.body.appendChild(a); a.click(); a.remove();
    // if the browser blocked the jump (no tap), offer a one-tap button
    setTimeout(() => { if (document.visibilityState === "visible") offerOpen(kind); }, 1200);
  };
  if (fromTap) go(); else setTimeout(go, 1300);
}
function offerOpen(kind) {
  let b = $("openApp");
  if (!b) { b = document.createElement("a"); b.id = "openApp"; b.className = "openapp"; document.body.appendChild(b); }
  b.href = APP[kind]; b.target = /^https?:/.test(APP[kind]) ? "_blank" : ""; b.textContent = kind === "music" ? "點這裡打開 Music ›" : "點這裡打開 Podcast ›";
  b.classList.add("on"); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove("on"), 6000);
  b.onclick = () => b.classList.remove("on");
}
function onHeard(text) {
  const now = performance.now(); if (now - lastCmd < 2500) return;
  if (!vEl.paused) return; // don't react to her own voice
  const wake = WAKE.test(text);
  const ids = wake && setsFor(text.replace(/\s/g, "")); if (ids) { lastCmd = now; enterSpecial(ids); return; }
  if (/關.{0,2}(音樂|music)|停.{0,2}音樂/i.test(text)) { lastCmd = now; stopExtMusic(); return; }
  if (CMD_POD.test(text)) { lastCmd = now; if (!awake) setPower(true); openApp("podcast"); return; }
  if (CMD_MUSIC.test(text)) { lastCmd = now; if (!awake) setPower(true); openApp("music"); return; }
  if (wake) { lastCmd = now; if (!awake) setPower(true); else { LG.poke && LG.poke(); say(pick(LINES.heard), { force: true }); } }
}
function startRec() {
  rec = new SR(); rec.lang = "zh-TW"; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 3;
  rec.onresult = e => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]; let t = ""; for (let k = 0; k < r.length; k++) t += r[k].transcript + " ";
      if (r.isFinal || /拉比|podcast|音樂/i.test(t)) onHeard(t);
    }
  };
  rec.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { micOn = false; $("mic").setAttribute("aria-pressed", false); LG.toast && LG.toast("麥克風沒有權限" + (isIOS && navigator.standalone ? "（主畫面 App 可能不支援，請用 Safari 開）" : "")); } };
  rec.onend = () => { if (micOn) setTimeout(() => { try { rec.start(); } catch (e) {} }, 300); }; // keep listening
  try { rec.start(); } catch (e) {}
}
function toggleMic() {
  if (!SR) { LG.toast && LG.toast("這個瀏覽器不支援語音辨識" + (isIOS ? "（請用 Safari 開）" : "，請用 Chrome")); return; }
  initAudio(); if (ac.state === "suspended") ac.resume(); // unlock audio in this tap so "Hey 拉比" can wake her later
  micOn = !micOn; $("mic").setAttribute("aria-pressed", micOn);
  if (micOn) { startRec(); LG.toast && LG.toast("語音控制開啟：說「Hey 拉比」"); }
  else { try { rec && rec.abort(); } catch (e) {} rec = null; LG.toast && LG.toast("語音控制關閉"); }
}
LG.onHeard = onHeard; // for testing
LG.toggleMic = toggleMic; LG.micOn = () => micOn;

// ---------------- 拉比音效: sound sets (sfx.js). Called by keyword (chat / voice) or by state; "我想要" plays the default sequence ----------------
// dark screen, headphone hint, Next / End.  A set with loop:true repeats until End.
let special = false, queue = [], qi = -1, playingSet = null;
const SETS = window.LG_SFX_SETS || {}, SEQ = window.LG_SFX_SEQUENCES || {};
function setsFor(text) {
  for (const [k, ids] of Object.entries(SEQ)) if (text.includes(k)) return ids;
  for (const [id, st] of Object.entries(SETS)) if ((st.keywords || []).some(w => text.includes(w))) return [id];
  return null;
}
function enterSpecial(ids) {
  ids = ids || SEQ["我想要"] || Object.keys(SETS);
  if (!awake) setPower(true);
  queue = []; for (const id of ids) { const st = SETS[id]; if (st) st.clips.forEach((c, j) => queue.push({ id, src: c, loop: !!st.loop && j === st.clips.length - 1, name: st.name })); }
  if (special) { qi = -1; playSfx(0); return; }
  special = true; setNear(false); try { vEl.pause(); } catch (e) {}
  document.body.classList.remove("chatOpen"); try { $("chatIn").blur(); } catch (e) {}
  document.body.classList.add("special"); LG.setMinimal && LG.setMinimal(true); LG.minimalLock = true;
  $("spHint").textContent = "建議戴上耳機"; $("spPanel").classList.add("on");
  if (ac) { ramp(bgmBus.gain, 0, 3); }               // her own sounds take over from the music
  qi = -1;
  setTimeout(() => { if (special) playSfx(0); }, 2400);
}
function playSfx(i) {
  if (!special) return;
  if (!queue.length) { $("spHint").textContent = "還沒有放入拉比音效（sfx.js）"; return; }
  if (i >= queue.length) { endSpecial(); return; }
  qi = i; const q = queue[qi];
  $("spHint").textContent = `${q.name}　${qi + 1} / ${queue.length}`;
  if (sfxG && ac) ramp(sfxG.gain, 1, 0.4); else sfxEl.volume = 1;
  sfxEl.loop = q.loop; sfxEl.src = q.src; sfxEl.currentTime = 0; sfxEl.play().catch(() => {});
}
function endSpecial() {
  if (!special) return;
  if (sfxG && ac) ramp(sfxG.gain, 0, 3); else sfxEl.volume = 0.2;
  setTimeout(() => { if (!special) { sfxEl.pause(); sfxEl.loop = false; } }, 3100);
  $("spPanel").classList.remove("on");
  document.body.classList.remove("special");           // .dim fades back over 4s (css)
  special = false; LG.minimalLock = false;
  manualUntil = performance.now() + 12000; mode = ""; setModeState("listen", { force: true }); applyBgm(5);
}
LG.special = { enter: enterSpecial, next: () => playSfx(qi + 1), end: endSpecial, sets: SETS };
// state trigger: placement mode at night, nobody touching the phone for N minutes → the set marked auto:"placement-night"
let placedSince = 0;
setInterval(() => {
  if (!awake || special || mode !== "listen") { placedSince = 0; return; }
  if (!placedSince) placedSince = Date.now();
  const h = new Date().getHours(), night = h >= 22 || h < 6;
  for (const [id, st] of Object.entries(SETS)) if (st.auto === "placement-night" && night && Date.now() - placedSince > (st.afterMin || 10) * 60000) { placedSince = Date.now() + 36e5; enterSpecial([id]); }
}, 20000);

// ---------------- speech + subtitles ----------------
let subT, voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /zh[-_]TW/i.test(v.lang)) || vs.find(v => /zh[-_](HK|CN)|zh/i.test(v.lang)) || null;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
let lastSay = 0, lastLine = "", subUntil = 0;
function talking() {
  return (!vEl.paused && !vEl.ended) || ("speechSynthesis" in window && speechSynthesis.speaking) || performance.now() < subUntil;
}
const VOICE = window.LG_VOICE || {};   // line text -> audio file, generated from the reference voice
const vEl = new Audio(); vEl.preload = "auto"; const sfxEl = new Audio(); sfxEl.preload = "auto";
vEl.onplay = () => duck(true); vEl.onended = vEl.onerror = vEl.onpause = () => duck(false);
function say(line, opts = {}) {
  if (!line) return;
  const now = performance.now();
  if (talking()) return;                                   // a line is still playing: the later one is cancelled
  if (!opts.force && now - lastSay < 2500) return;
  if (line === lastLine && now - lastSay < 60000) return;  // same sentence again within a minute: skip
  lastSay = now; lastLine = line;
  const sub = $("sub"); sub.textContent = line; sub.classList.add("on"); clearTimeout(subT);
  const showMs = 1800 + line.length * 180; subUntil = now + Math.min(showMs, 1200 + line.length * 120);
  subT = setTimeout(() => sub.classList.remove("on"), showMs);
  if (!voiceOn) return;
  if (VOICE[line]) { try { vEl.pause(); vEl.src = VOICE[line]; vEl.currentTime = 0; vEl.play().catch(() => {}); } catch (e) {} return; }
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(line); if (voice) u.voice = voice; u.lang = voice ? voice.lang : "zh-TW";
  u.rate = 0.9; u.pitch = 1.15; u.volume = 1;
  u.onstart = () => duck(true); u.onend = u.onerror = () => duck(false);
  speechSynthesis.speak(u);
}
let voiceOn = true;
LG.say = (l, o) => say(l, o); LG.talking = () => talking(); LG.lastSayAt = () => lastSay;
const did = k => { LG.did && LG.did(k); };

// ---------------- audio: generated lo-fi + ambience ----------------
let voiceG = null, sfxG = null;
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
  try { voiceG = ac.createGain(); ac.createMediaElementSource(vEl).connect(voiceG); voiceG.connect(master); } catch (e) { voiceG = null; }
  try { sfxG = ac.createGain(); sfxG.gain.value = 0; ac.createMediaElementSource(sfxEl).connect(sfxG); sfxG.connect(master); } catch (e) { sfxG = null; }
  // ambience: brown-noise air with slow swell + faint machine hum
  const nb = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate), nd = nb.getChannelData(0); let last = 0;
  for (let i = 0; i < nd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; nd[i] = last * 3.5; }
  const air = ac.createBufferSource(); air.buffer = nb; air.loop = true;
  const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
  const airG = ac.createGain(); airG.gain.value = 0.5;
  const lfo = ac.createOscillator(), lfoG = ac.createGain(); lfo.frequency.value = 0.07; lfoG.gain.value = 0.25; lfo.connect(lfoG); lfoG.connect(airG.gain);
  air.connect(lp); lp.connect(airG); airG.connect(ambBus); air.start(); lfo.start();
  const hum = ac.createOscillator(), humG = ac.createGain(); hum.frequency.value = 55; humG.gain.value = 0.025; hum.connect(humG); humG.connect(ambBus); hum.start();
  ramp(ambBus.gain, 0.35, 2);
  scheduler();
}
function ramp(param, v, t) { const n = ac.currentTime; param.cancelScheduledValues(n); param.setValueAtTime(param.value, n); param.linearRampToValueAtTime(v, n + t); }
function bgmTarget() { return playing ? vol * (duckOn ? 0.55 : 1) * modeGain : 0; }
function applyBgm(t = 0.8) { if (ac) ramp(bgmBus.gain, bgmTarget() * 0.9, t); }
function setVolume(v) { vol = v; $("vol").value = v; if (awake && !playing) { if (extMusic) { extMusic = false; setSession("playback"); } playing = true; } applyBgm(0.3); }
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
// audio route changed (AirPods in/out, mic turned on): wake the audio graph and restart listening so sound follows the new device
if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener("devicechange", () => {
  setTimeout(() => {
    if (ac) ac.suspend().then(() => ac.resume()).catch(() => {});
    if (micOn && rec) { try { rec.abort(); } catch (e) {} }   // onend restarts it on the new input
  }, 600);
});
// keep the screen on while she's awake (phone lying down = music mode shouldn't lock the screen)
let wakeLock = null;
async function holdScreen(on) {
  try { if (on && "wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.onrelease = () => { wakeLock = null; }; } else if (!on && wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { if (awake) holdScreen(true); if (extMusic) setSession("ambient"); if (ac && ac.state !== "running") ac.resume(); }
});
LG.power = on => setPower(on); LG.isAwake = () => awake; LG.isSpecial = () => special;
function setPower(on) {
  initAudio(); if (ac.state === "suspended") ac.resume();
  if (on === awake) return;
  if (performance.now() - (setPower.at || -1e9) < 800) return; // rapid ⏻ taps: ignore until the fade has started
  setPower.at = performance.now();
  awake = on; holdScreen(on);
  if (on) {
    document.body.classList.add("booting"); setMode("啟動中…");
    try { vEl.muted = true; vEl.src = Object.values(VOICE)[0] || ""; vEl.play().then(() => { vEl.pause(); vEl.muted = false; }).catch(() => { vEl.muted = false; }); } catch (e) {} // unlock iOS audio
    if ("speechSynthesis" in window) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); }
    setTimeout(() => {
      document.body.classList.remove("booting"); document.body.classList.add("awake"); restTarget = 0; LG.shot && LG.shot("wake");
      playing = !extMusic; ramp(bgmBus.gain, 0, 0.01); applyBgm(4.5); ramp(ambBus.gain, 0, 2.5);
      setMode(modeLabel()); setTimeout(() => { const first = LG.firstMeet && LG.firstMeet(); say(first || pick(LINES[greetSlot()]), { force: true }); }, 1600);
      scheduleIdleTalk();
    }, 1400);
  } else {
    did("alone"); say(pick(LINES.sleep), { force: true });
    playing = false; applyBgm(2.2); ramp(ambBus.gain, 0.4, 3);
    document.body.classList.remove("awake", "talk"); restTarget = 1; LG.shot && LG.shot("sleep"); setMode("休眠待機"); clearTimeout(idleTalkT);
  }
}
function scheduleIdleTalk() { clearTimeout(idleTalkT); idleTalkT = setTimeout(() => { if (awake && mode !== "listen" && !(LG.guideBusy && LG.guideBusy())) say(pick(LINES.idle)); scheduleIdleTalk(); }, 35000 + Math.random() * 25000); }
(function restLoop() { LG.rest += (restTarget - LG.rest) * 0.03; requestAnimationFrame(restLoop); })();

// taps on parts: only react while awake, and speak a line now and then
// ---------------- touch reactions ----------------
let chestHits = [], sulkUntil = 0, headLevel = 0, loveUntil = 0;
function chestTouch() {
  did("nude");
  const now = performance.now(); chestHits = chestHits.filter(t => now - t < 8000); chestHits.push(now);
  if (chestHits.length >= 3) { chestHits = []; sulkUntil = now + 8000; say(pick(LINES.angry), { force: true }); LG.fx.shake(); document.body.classList.add("angry"); setTimeout(() => document.body.classList.remove("angry"), 2500); }
  else say(pick(LINES.chest), { force: chestHits.length === 1 });
}
LG.onPart = g => {
  if (special) return false;
  if (!awake) { LG.toast && LG.toast("休眠中：按 ⏻ 喚醒"); return false; }
  const sulking = performance.now() < sulkUntil;
  if (g.key === "chest") { chestTouch(); return; }
  if (sulking) { say("哼。"); return; }
  if (g.key === "waist") { say(pick(LINES.waist), { force: true }); return; }
  if (Math.random() < 0.6 && LINES[g.key]) say(pick(LINES[g.key]));
};
// rubbing: rev = number of back-and-forth turns so far, -1 = finger lifted
LG.onStroke = (part, rev) => {
  if (special) return;
  if (!awake) { if (rev === 2) LG.toast && LG.toast("休眠中：按 ⏻ 喚醒"); return; }
  const now = performance.now();
  if (rev < 0) { headLevel = 0; return; }
  if (part.key === "head") {
    if (now < sulkUntil) { if (rev === 3) say("哼，現在才來討好我。", { force: true }); return; }
    if (rev === 2 && headLevel < 1) { headLevel = 1; did("head"); say(pick(LINES.headRub), { force: true }); }
    else if (rev === 6 && headLevel < 2) { headLevel = 2; say(pick(LINES.headGood), { force: true }); }
    else if (rev === 11 && headLevel < 3 && now > loveUntil) { headLevel = 3; loveUntil = now + 8000; say(pick(LINES.headLove), { force: true }); LG.fx.playActive(); burst("💗", 10); }
  } else if (part.key === "chest") { if (rev % 3 === 0) chestTouch(); }
  else if (part.key === "waist") { if (rev === 2 || rev % 6 === 0) { say(pick(LINES.waist), { force: true }); LG.fx.wiggle(); } }
};
let fxLast = 0;
function fxAt(ch, x, y) {
  const d = document.createElement("div"); d.className = "fxp"; d.textContent = ch;
  d.style.left = x + "px"; d.style.top = y + "px"; d.style.setProperty("--dx", (Math.random() * 60 - 30) + "px");
  document.body.appendChild(d); setTimeout(() => d.remove(), 1300);
}
function burst(ch, n) { const W = document.body.clientWidth, H = document.body.clientHeight; for (let i = 0; i < n; i++) setTimeout(() => fxAt(ch, W * (0.3 + Math.random() * 0.4), H * (0.25 + Math.random() * 0.2)), i * 90); }
LG.strokeFx = (part, rev, x, y) => {
  if (special) return;
  if (!awake || part.key !== "head" || performance.now() < sulkUntil) return;
  const now = performance.now(); if (now - fxLast < 90) return; fxLast = now;
  if (rev >= 11) fxAt(Math.random() < 0.5 ? "💗" : "❤️", x, y);
  else if (rev >= 5) fxAt(Math.random() < 0.5 ? "✨" : "✦", x, y);
};

// ---------------- chat (canned replies; swap ask() for an AI endpoint later) ----------------
function ask(q) {
  if (/說明|教學|help|怎麼玩/i.test(q)) { LG.openHelp && LG.openHelp(); return; }
  const sfxIds = setsFor(q); if (sfxIds) { enterSpecial(sfxIds); return; }
  if (!awake) setPower(true);
  for (const [re, ans, fx] of REPLIES) if (re.test(q)) { setTimeout(() => say(pick(ans), { force: true }), 400); fx && fx(); return; }
}

function camNote(t) { if (t) LG.toast && LG.toast("感應" + t); }
// ---------------- sensing: phone down = listen, picked up + face = talk ----------------
let mode = "normal", sensing = false, flatSince = 0, faceAt = 0, ori = { b: 60, g: 0 }, video, detector, lastTalkLine = 0;
function modeLabel() { return mode === "listen" ? "放置模式" : mode === "talk" ? "對話模式" : "互動模式"; }
let modeAt = 0; const modeLineAt = {};
function setModeState(m, opts = {}) {
  if (m === mode) return;
  const now = performance.now();
  if (!opts.force && now - modeAt < 4000) return;          // auto changes wait at least 4s in a mode, so it can't flicker
  mode = m; modeAt = now;
  modeGain = m === "listen" ? 1.35 : m === "talk" ? 0.7 : 1; applyBgm(3);
  document.body.classList.toggle("talk", m === "talk");
  LG.minimalLock = m === "listen"; if (m === "listen") LG.setMinimal && LG.setMinimal(true); else if (m === "talk") LG.poke && LG.poke();
  if (awake) setMode(modeLabel());
  document.body.classList.toggle("placed", m === "listen");
  if (awake && !special) { if (m === "listen") { setNear(false); LG.resetCam && LG.resetCam(); } else if (!near) LG.shot && LG.shot("wake"); }
  // a mode only speaks when entered, at most once every 90s per mode
  const sayOnce = (k, arr) => { if (now - (setPower.at || -1e9) > 7000 && now - (modeLineAt[k] || -1e9) > 90000) {  // the greeting goes first after waking
    modeLineAt[k] = now; setTimeout(() => mode === k && say(pick(arr)), 1500); } };
  if (m === "listen") sayOnce("listen", LINES.listen);
  if (m === "talk") sayOnce("talk", LINES.face);
}
addEventListener("deviceorientation", e => { if (e.beta != null) ori = { b: e.beta, g: e.gamma }; });
// near/far: face size in the front camera. near → camera pushes in and she whispers; far + phone still 5s → placement
let faceSize = 0, near = false, nearSince = 0, stillSince = 0, lastOri = null, manualUntil = 0;
let nearAt = 0; LG.setNear = on => setNear(on);
function setNear(on) {
  if (on === near) return;
  if (on && performance.now() - nearAt < 3000) return;   // no ping-pong between near and far
  near = on; nearAt = performance.now();
  if (voiceG && ac) ramp(voiceG.gain, on ? 0.5 : 1, 0.6);
  if (awake && !special && mode !== "listen") LG.shot && LG.shot(on ? "near" : "wake");
  if (on && awake && !special && performance.now() - (modeLineAt.near || -1e9) > 90000) { modeLineAt.near = performance.now(); say(pick(LINES.near)); }
}
function evalMode() {
  const now = performance.now();
  if (lastOri) { const d = Math.abs(ori.b - lastOri.b) + Math.abs(ori.g - lastOri.g); if (d > 1.5) stillSince = 0; else if (!stillSince) stillSince = now; }
  lastOri = { ...ori };
  if (awake && sensing && !special && now > manualUntil) {
    const flat = Math.abs(ori.b) < 18 && Math.abs(ori.g) < 18, seen = now - faceAt < 1500;
    if (flat) { if (!flatSince) flatSince = now; } else flatSince = 0;
    // near / far by face size (fraction of the camera frame width)
    if (seen && faceSize > 0.42) { if (!nearSince) nearSince = now; if (now - nearSince > 1500) setNear(true); }
    else { nearSince = 0; if (!seen || faceSize < 0.32) setNear(false); }
    const far = !seen || faceSize < 0.2;
    if (flatSince && now - flatSince > 1200) setModeState("listen");
    else if (far && stillSince && now - stillSince > 5000) setModeState("listen");
    else if (mode === "listen" && !flat && (seen && faceSize >= 0.2 || !stillSince)) setModeState(seen ? "talk" : "normal");
    else if (mode !== "listen" && seen) setModeState("talk");
    else if (mode === "talk" && now - faceAt > 6000) setModeState("normal");
  }
  setTimeout(evalMode, 250);
}
// double tap: switch placement ⇄ interaction by hand (auto sensing waits 12s so it doesn't flip straight back)
LG.toggleMode = () => {
  if (special) return;
  if (!awake) { setPower(true); return; }
  did("mode"); manualUntil = performance.now() + 12000; setNear(false);
  setModeState(mode === "listen" ? "normal" : "listen", { force: true });
  LG.toast && LG.toast(mode === "listen" ? "放置模式" : "互動模式");
};
LG.mode = () => mode;
evalMode();

LG.toggleSense = () => toggleSense(); LG.sensing = () => sensing;
async function toggleSense() {
  if (sensing) { sensing = false; $("sense").setAttribute("aria-pressed", false); camNote(""); if (video && video.srcObject) video.srcObject.getTracks().forEach(t => t.stop()); setModeState("normal"); return; }
  if (DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") { try { await DeviceOrientationEvent.requestPermission(); } catch (e) {} }
  sensing = true; $("sense").setAttribute("aria-pressed", true); camNote("· 鏡頭啟動中");
  try {
    video = document.createElement("video"); video.playsInline = true; video.muted = true;
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 }, audio: false });
    await video.play();
    detector = await makeDetector();
    camNote(detector ? "· 鏡頭偵測中" : "· 只用姿態判斷");
    if (detector) faceLoop();
  } catch (e) {
    camNote("· 無法使用鏡頭，只用姿態判斷");
    detector = null;
  }
  if (!detector) { (function fake() { if (!sensing) return; if (Math.abs(ori.b) > 35) { faceAt = performance.now(); faceSize = 0.3; } setTimeout(fake, 300); })(); }
}
async function makeDetector() {
  if ("FaceDetector" in window) { try { const fd = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); return { detect: async v => { const r = await fd.detect(v); return r.length ? r[0].boundingBox.width / (v.videoWidth || 320) : 0; } }; } catch (e) {} }
  try {
    const base = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
    const mp = await import(base + "/vision_bundle.mjs");
    const files = await mp.FilesetResolver.forVisionTasks(base + "/wasm");
    const fd = await mp.FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite", delegate: "GPU" },
      runningMode: "VIDEO", minDetectionConfidence: 0.5 });
    return { detect: async v => { const d = fd.detectForVideo(v, performance.now()).detections; return d.length ? d[0].boundingBox.width / (v.videoWidth || 320) : 0; } };
  } catch (e) { console.warn("face detector unavailable", e); return null; }
}
let lastSeen = false;
async function faceLoop() {
  if (!sensing || !detector) return;
  try { if (video.readyState >= 2) { const r = await detector.detect(video); if (r > 0) { faceAt = performance.now(); faceSize = faceSize ? faceSize * 0.6 + r * 0.4 : r; } else faceSize *= 0.8; } } catch (e) {}
  const seen = performance.now() - faceAt < 800; if (seen !== lastSeen) { lastSeen = seen; if (seen) camNote("· 偵測到人臉"); }
  setTimeout(faceLoop, 300);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireUI); else wireUI();
})();
