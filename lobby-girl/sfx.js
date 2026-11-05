// 拉比音效組 —— 新增一組：放音檔到 sfx/，在 LG_SFX_SETS 加一筆。
// keywords：在對話框輸入、或說「拉比，＋關鍵字」就會播放這一組。
// loop：最後一段會一直重複，直到按 End。
// auto："placement-night"：晚上 22:00–06:00 放置模式、afterMin 分鐘沒人動手機，自動播放。
window.LG_SFX_SETS = {
  lullaby: { name: "搖籃曲", keywords: ["搖籃曲", "哼歌", "唱歌"], clips: ["sfx/lullaby.mp3"], auto: "placement-night", afterMin: 10 },
  story:   { name: "小紅帽", keywords: ["講故事", "說故事", "小紅帽"], clips: ["sfx/story_red.mp3"] },
  sleep:   { name: "睡著了", keywords: ["陪我睡", "一起睡"], clips: ["sfx/sleep_loop.wav"], loop: true },
};
// 一次播好幾組（依序）。「我想要」= 哼歌 → 講故事 → 講著講著睡著
window.LG_SFX_SEQUENCES = {
  "我想要": ["lullaby", "story", "sleep"],
  "講故事": ["story", "sleep"],
  "說故事": ["story", "sleep"],
};
