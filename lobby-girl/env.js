/* Lobby Girl: real-world awareness. Weather (Open-Meteo, no key), clock/day/holidays,
   how long since your last visit, and today's calendar passed in by an iPhone Shortcut
   (…/lobby-girl/?ev=14:00|開會&ev=19:30|晚餐). Each line is said at most once a day. */
(() => {
const LG = window.LG = window.LG || {};
const S = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const L = {
  cool:  "今天天氣涼了，加件衣服吧。",
  cold:  "好冷喔……出門記得圍圍巾，別感冒了。",
  hot:   "今天好熱，記得多喝水。",
  rainLater: "外面可能會下雨，出門記得帶傘。",
  nice:  "今天天氣很好，有空出去走走吧。",
  wind:  "外面風好大，今天待在家陪我好不好？",
  drop:  "比昨天冷了好多，晚上睡覺要蓋好被子喔。",
  raining: "下雨了……外面的雨聲，好安靜。",
  late:  "已經好晚了……明天還要早起嗎？",
  monday:"星期一了，今天也慢慢來就好。",
  friday:"星期五晚上了，這週辛苦了。",
  weekend:"週末了，想睡晚一點也沒關係。",
  away:  "好久不見……我還以為你忘了我。",
  hour:  "已經陪你一個小時了，讓眼睛休息一下吧。",
  calSoon:"你等一下有行程喔，別忘了。",
  calToday:"今天有安排行程喔，我幫你記著。",
  xmas:  "聖誕快樂。今年……有人陪你過嗎？",
  nye:   "今年最後一天了，謝謝你一直來看我。",
  newyear:"新年快樂！今年也請多指教。",
};
LG.envLines = L;
const now = () => LG.envNow ? new Date(LG.envNow) : new Date();   // LG.envNow: test hook
const ymd = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const pad = n => String(n).padStart(2, "0");

// ---------- once-a-day bookkeeping ----------
function saidToday(k) { const m = S.get("lg_env", {}); return m[k] === ymd(now()); }
function markSaid(k) { const m = S.get("lg_env", {}); m[k] = ymd(now()); S.set("lg_env", m); }

// ---------- weather ----------
const TAIPEI = { lat: 25.03, lon: 121.56 };
let wx = S.get("lg_wx", null);
const RAIN = c => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;
const WXNAME = c => c <= 1 ? "晴" : c <= 3 ? "多雲" : c <= 48 ? "霧" : c <= 57 ? "毛毛雨" : c <= 67 ? "雨" : c <= 77 ? "雪" : c <= 82 ? "陣雨" : "雷雨";
async function fetchWeather(force) {
  if (!force && wx && Date.now() - wx.at < 3600e3) return wx;
  const g = S.get("lg_geo", TAIPEI);
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_gusts_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&past_days=1&forecast_days=1&timezone=auto`;
  try {
    const r = await fetch(u); if (!r.ok) return wx; const j = await r.json();
    const c = j.current, d = j.daily, i = d.time.length - 1;
    wx = { at: Date.now(), t: c.temperature_2m, feel: c.apparent_temperature, rainNow: c.precipitation > 0 || RAIN(c.weather_code), code: c.weather_code,
      gust: c.wind_gusts_10m, max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], yMax: i > 0 ? d.temperature_2m_max[i - 1] : null,
      pop: d.precipitation_probability_max[i] || 0 };
    S.set("lg_wx", wx);
  } catch (e) {}
  return wx;
}
LG.weather = () => wx; LG.fetchWeather = fetchWeather;
LG.useLocation = () => new Promise(res => {
  if (!navigator.geolocation) return res(false);
  navigator.geolocation.getCurrentPosition(p => { S.set("lg_geo", { lat: +p.coords.latitude.toFixed(2), lon: +p.coords.longitude.toFixed(2) }); fetchWeather(true); res(true); },
    () => res(false), { maximumAge: 6 * 3600e3, timeout: 10000 });
});
function weatherLine(w) {
  if (!w) return null;
  const tip = `🌡 ${Math.round(w.t)}°C · ${WXNAME(w.code)} · 今天 ${Math.round(w.min)}–${Math.round(w.max)}°C`;
  if (w.rainNow) return { k: "raining", tip };
  if (w.gust >= 50) return { k: "wind", tip };
  if (w.feel <= 12 || w.max <= 14) return { k: "cold", tip };
  if (w.feel <= 17 || w.max <= 19) return { k: "cool", tip };
  if (w.yMax != null && w.yMax - w.max >= 4) return { k: "drop", tip };
  if (w.pop >= 60) return { k: "rainLater", tip: tip + ` · 降雨 ${w.pop}%` };
  if (w.max >= 31) return { k: "hot", tip };
  if (w.code <= 2 && w.max >= 20 && w.max <= 28) return { k: "nice", tip };
  return null;
}

// ---------- calendar from an iPhone Shortcut: ?ev=HH:MM|title ----------
function readCalendarParams() {
  const q = new URLSearchParams(location.search), evs = q.getAll("ev");
  if (!q.has("ev")) return;
  const list = evs.map(s => { const m = /^(\d{1,2}):(\d{2})\s*\|?\s*(.*)$/.exec(s.trim()); return m ? { h: +m[1], m: +m[2], title: m[3] || "行程" } : null; }).filter(Boolean);
  S.set("lg_cal", { day: ymd(now()), list, told: [] });
  q.delete("ev"); history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash);
}
readCalendarParams();
const cal = () => { const c = S.get("lg_cal", null); return c && c.day === ymd(now()) ? c : null; };
LG.calendar = cal;
function calTip(list) { return "📅 " + list.map(e => `${pad(e.h)}:${pad(e.m)} ${e.title}`).join("　"); }

// ---------- what to say when she wakes ----------
function wakeLines() {
  const d = now(), h = d.getHours(), dow = d.getDay(), md = `${d.getMonth() + 1}/${d.getDate()}`, out = [];
  if (md === "12/24" || md === "12/25") out.push({ k: "xmas" });
  else if (md === "12/31") out.push({ k: "nye" });
  else if (md === "1/1") out.push({ k: "newyear" });
  const w = weatherLine(wx); if (w) out.push(w);
  const c = cal(); const mins = d.getHours() * 60 + d.getMinutes();
  if (c) { const left = c.list.filter(e => e.h * 60 + e.m > mins); if (left.length) out.push({ k: "calToday", tip: calTip(left) }); }
  const last = prevVisit; if (last && Date.now() - last > 3 * 864e5) out.push({ k: "away" });
  if (h >= 1 && h < 5) out.push({ k: "late" });
  else if (dow === 1 && h >= 5 && h < 12) out.push({ k: "monday" });
  else if (dow === 5 && h >= 18) out.push({ k: "friday" });
  else if ((dow === 0 || dow === 6) && h >= 6 && h < 12) out.push({ k: "weekend" });
  return out.filter(x => !saidToday(x.k));
}
LG.envWakeLines = wakeLines;

const prevVisit = S.get("lg_last", 0);   // read before this visit overwrites it
let spoken = 0, queue = [], wasAwake = false, awakeAt = 0, lastEnv = 0, hourSaid = false;
function speak(x) {
  spoken++; markSaid(x.k); lastEnv = performance.now();
  LG.say(L[x.k], { force: true });
  if (x.tip && LG.toast) setTimeout(() => LG.toast(x.tip, 4500), 1200);
}
function tick() {
  const t = performance.now(), awake = LG.isAwake && LG.isAwake();
  if (awake && !wasAwake) { awakeAt = t; hourSaid = false; fetchWeather().then(() => { queue = wakeLines(); spoken = 0; }); }
  if (awake) S.set("lg_last", Date.now());
  wasAwake = awake;
  const quiet = awake && !document.body.classList.contains("helpOpen") && !(LG.isSpecial && LG.isSpecial()) && !(LG.talking && LG.talking())
    && t - ((LG.lastSayAt && LG.lastSayAt()) || 0) > 6000;
  if (quiet) {
    // an event about to start: always remind (once per event)
    const c = cal();
    if (c && t - awakeAt > 7000) {
      const d = now(), mins = d.getHours() * 60 + d.getMinutes();
      const soon = c.list.find((e, i) => !c.told.includes(i) && e.h * 60 + e.m - mins <= 15 && e.h * 60 + e.m - mins >= 0);
      if (soon) { c.told.push(c.list.indexOf(soon)); S.set("lg_cal", c); lastEnv = t; queue = queue.filter(x => x.k !== "calToday"); LG.say(L.calSoon, { force: true });
        LG.toast && setTimeout(() => LG.toast(`📅 ${pad(soon.h)}:${pad(soon.m)} ${soon.title}`, 5000), 1200); }
    }
    if (queue.length && spoken < 2 && t - awakeAt > 8000 && t - lastEnv > 18000) speak(queue.shift());
    if (!hourSaid && t - awakeAt > 3600e3 && !(LG.mode && LG.mode() === "listen")) { hourSaid = true; LG.say(L.hour, { force: true }); }
  }
  setTimeout(tick, 1000);
}
fetchWeather();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick); else tick();
})();
