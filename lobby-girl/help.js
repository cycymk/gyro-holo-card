/* Lobby Girl help: first-run intro (install to home screen, permissions, how to play)
   and Rabi's own guided hints that walk a new player through the features once. */
(() => {
const LG = window.LG = window.LG || {};
const $ = id => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches;

// ---------------- intro overlay ----------------
let page = 0;
const pages = () => [...document.querySelectorAll("#help .hpage")];
function show(i) {
  page = Math.max(0, Math.min(pages().length - 1, i));
  pages().forEach((p, k) => p.classList.toggle("on", k === page));
  document.querySelectorAll("#help .hdots i").forEach((d, k) => d.classList.toggle("on", k === page));
  const vis = { hSkip: page < 2, hNo: page === 1, hNext: page === 0, hAllow: page === 1, hStart: page === 2 };
  for (const id in vis) $(id).style.display = vis[id] ? "" : "none";
}
function fillInstall() {
  const el = $("hInstall");
  if (standalone) { el.innerHTML = `<p class="hok">✓ 你是從主畫面開啟的，已經是全螢幕模式。</p>`; return; }
  if (isIOS) {
    el.innerHTML = `<p><b>建議先建立主畫面捷徑：</b></p>
      <ol class="hsteps"><li>點 Safari 的「分享」<span class="hico">⬆︎</span></li><li>選「加入主畫面」</li><li>之後從主畫面的 <b>Lobby Girl</b> 圖示打開，就會自動全螢幕</li></ol>
      <p class="hnote">iPhone 的網頁沒辦法自己切成全螢幕，只能從主畫面圖示開。</p>`;
    return;
  }
  el.innerHTML = `<p><b>建議加到主畫面</b>（瀏覽器選單 → 加到主畫面），或先切成全螢幕：</p><p><button id="hFs">切換全螢幕</button></p>`;
  $("hFs").onclick = () => { const d = document.documentElement; (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); };
}
function openHelp(at = 0) { fillInstall(); show(at); $("help").classList.add("on"); document.body.classList.add("helpOpen"); }
function closeHelp(start) {
  $("help").classList.remove("on"); document.body.classList.remove("helpOpen");
  store.set("lg_help", "1");
  if (start && LG.power && !(LG.isAwake && LG.isAwake())) LG.power(true);   // inside the tap: unlocks audio on iOS
}
LG.openHelp = openHelp;
// every system prompt has to come from a tap, so all of them are asked right here
function askPermissions() {
  const gb = $("gyroBtn"); if (gb) gb.click();                                   // motion sensor (iOS asks)
  if ($("cMic").checked && LG.toggleMic && !(LG.micOn && LG.micOn())) LG.toggleMic();       // microphone + speech
  if ($("cCam").checked && LG.toggleSense && !(LG.sensing && LG.sensing())) LG.toggleSense(); // front camera
  if ($("cLoc").checked && LG.useLocation) LG.useLocation();                            // location → local weather
  show(2);
}
function wire() {
  document.querySelectorAll("#help [data-next]").forEach(b => b.onclick = () => show(page + 1));
  document.querySelectorAll("#help [data-prev]").forEach(b => b.onclick = () => show(page - 1));
  $("hAllow").onclick = askPermissions;
  $("hStart").onclick = () => closeHelp(true);
  $("hSkip").onclick = () => closeHelp(false);
  $("helpBtn").onclick = () => { $("sheet").classList.remove("on"); document.body.classList.remove("settings"); openHelp(0); };
  $("guideReset").onclick = () => { store.del("lg_guide"); store.del("lg_met"); done = {}; LG.toast && LG.toast("拉比會重新帶你認識一次"); };
  if (!store.get("lg_help")) setTimeout(() => openHelp(0), 600);
}

// ---------------- Rabi's guided hints ----------------
const HINTS = [
  { k: "head",  line: "你可以摸摸我的頭……我很喜歡。", tip: "👆 在拉比頭上來回滑動" },
  { k: "nude",  line: "我現在沒穿衣服，不要亂碰喔。" },
  { k: "shots", line: "想看清楚一點的話，右下角可以換角度。", tip: "↘ 右下角：臉／胸／腿／全身", poke: true },
  { k: "mode",  line: "長按畫面三秒，我就安靜陪著你。", tip: "⏱ 在空白處長按 3 秒" },
  { k: "music", line: "想聽別的音樂嗎？跟我說想聽歌就好。", tip: "💬 點兩下椅子，選「想聽歌」" },
  { k: "alone", line: "想一個人靜一靜嗎？按左上角，我就先睡。", tip: "⏻ 左上角：休眠" },
  { k: "smile", line: "我……還不知道怎麼笑。等我學會了，第一個笑給你看。", tease: true },
  { k: "asmr",  line: "以後啊……我也許能靠在你耳邊，講只有大人能聽的故事。", tease: true },
];
const WELCOME = "你好，我是拉比。第一次見面，請多指教。";
let done = {}; try { done = JSON.parse(store.get("lg_guide") || "{}") || {}; } catch (e) { done = {}; }
const save = () => store.set("lg_guide", JSON.stringify(done));
LG.did = k => { if (!done[k]) { done[k] = 1; save(); } };            // the player found it alone: skip that hint
LG.firstMeet = () => { if (store.get("lg_met")) return null; store.set("lg_met", "1"); return WELCOME; };
const pending = () => HINTS.filter(h => !done[h.k] && (!h.tease || HINTS.filter(x => !x.tease && done[x.k]).length >= 4));
LG.guideBusy = () => pending().length > 0;
let awakeSince = 0, lastHint = 0;
function tick() {
  const now = performance.now();
  const awake = LG.isAwake && LG.isAwake();
  if (!awake) awakeSince = 0; else if (!awakeSince) awakeSince = now;
  const quiet = awake && !document.body.classList.contains("helpOpen") && !(LG.isSpecial && LG.isSpecial())
    && !(LG.talking && LG.talking()) && !(LG.mode && LG.mode() === "listen") && !document.body.classList.contains("chatOpen");
  if (quiet && now - awakeSince > 9000 && now - lastHint > 22000 && now - ((LG.lastSayAt && LG.lastSayAt()) || 0) > 7000) {
    const h = pending()[0];
    if (h) {
      lastHint = now; done[h.k] = 1; save();
      LG.say(h.line, { force: true });
      if (h.poke && LG.poke) LG.poke();
      if (h.tip && LG.toast) setTimeout(() => LG.toast(h.tip), 1200);
    }
  }
  setTimeout(tick, 1000);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { wire(); tick(); }); else { wire(); tick(); }
})();
