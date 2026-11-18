# Gyro Holo Card

單張角色插畫隨手機陀螺儀傾斜，呈現立體閃卡效果的網頁原型。

線上測試：https://cycymk.github.io/gyro-holo-card/

## 閃卡產生器（maker/）
線上：https://cycymk.github.io/gyro-holo-card/maker/

載入任何圖片，瀏覽器內用 Depth Anything V2（small，int8 量化 35MB，ONNX Runtime Web）自動算深度圖，直接變成滿版的陀螺儀立體閃卡。圖片不會上傳。
- 傾斜手機或手指拖曳看視差；iPhone 要點「啟用陀螺儀」授權。
- ⚙ 調整立體強度、焦點深度、閃光強度與樣式（彩虹／只亮主體／閃粉／關）、顯示方式（滿版／完整圖／卡片）。
- 可匯出單一 HTML（圖和深度圖內嵌），放到任何 HTTPS 網址就能分享；也可下載深度圖 PNG。
- 第一次在手機開會提示「加到主畫面」，從主畫面開是全螢幕（PWA manifest + iOS apple-touch-icon）。
- 模型和 ONNX Runtime 都放在 repo 裡（`maker/model`、`maker/vendor`），不依賴外部 CDN。第一次載入後模型會快取。

## 原型的兩種模式
- **深度閃卡**：用 Depth Anything V2 預先算好的深度圖（`depth.png`）做 WebGL 視差，加上全息閃光與反光。傾斜手機或拖曳卡片。
- **環繞影格**：上傳一段單向 360° 環繞影片（例如用 AI 從單張圖生成），頁面擷取 72 格；傾斜會小幅擺動，左右滑動整圈旋轉。

## 使用
用手機打開網址，點「啟用陀螺儀」（iPhone 會跳出動作感測授權）。「歸零」會把目前手機姿勢設為正面。
陀螺儀需要 HTTPS，所以要透過 GitHub Pages 開，直接開本機檔案不行。
