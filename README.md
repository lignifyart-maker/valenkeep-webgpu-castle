# Valenkeep — Royal Gothic Sanctum (WebGPU)

以 **Three.js WebGPURenderer + TSL (GTAO & Bloom)** 即時渲染的原創中世紀哥德式王座與宴會聖堂。

## 線上體驗網址 (Live Demo)

- **GitHub Pages 線上版（可直接貼給別人看）**：  
  **[https://lignifyart-maker.github.io/valenkeep-webgpu-castle/](https://lignifyart-maker.github.io/valenkeep-webgpu-castle/)**

## 核心特色

1. **原創三廊雙層哥德式古堡建築 (`src/gothic-architecture.js`)**
   - 中央皇室中殿 + 雙側可漫遊拱廊走道，由 14 根八角複合簇柱 (`Compound Clustered Piers`) 與尖拱列柱支撐。
   - 二樓拱廊迴廊 (`Triforium Gallery`)、高側窗與十字肋拱頂 (`Quadripartite Ribbed Groin Vault`) 搭配鍍金拱心石。
   - 北端三階黑玄武岩皇家高台 (`Royal Dais`)、華蓋橡木王座與 **6.4 米彩繪玻璃玫瑰花窗 (`Cathedral Rose Window`)**。
   - 南端巨型黑橡木鉚釘城門與鍛鐵升降城門柵 (`Portcullis`)。
2. **原創程序化高解析 PBR 材質與法線引擎 (`src/pbr-materials.js`)**
   - 即時演算生成交錯灰岩 (`Ashlar Limestone`)、拋光磨損石板地 (`Polished Flagstone`)、細雕拱肋石、陳年黑橡木、彩繪玫瑰花窗與皇室織錦掛毯之 Albedo / Sobel Tangent-Space Normal / Roughness 貼圖。
3. **王座、全身板甲騎士、雙排盛宴長桌與巨型石壁爐 (`src/castle-sanctum.js`)**
   - 8 具高反射哥德式全身溝紋板甲騎士 (`Fluted Gothic Plate Armor`) 持長戟與紋章盾牌佇立於柱列旁。
   - 三座雙層鍛鐵與黃銅皇冠吊燈 (`Corona Lucis`)、雙側橡木長桌盛宴器皿、動態湍流壁爐烈焰與上升火星粒子。
4. **6-DOF 漂浮運鏡 (`Floating Camera`) 與三種光影氛圍**
   - 內建 5 條漂浮運鏡軌跡（皇室中殿巡禮、玫瑰花窗與王座、巨石壁爐與板甲、哥德肋拱與吊燈、側廊柱列與盛宴），並支援 `WASD` + `E/Q` 自由飛行與滑鼠拖曳環視。
   - 一鍵切換 **黃金斜陽 (Golden Hour)**、**冷月聖堂 (Moonlit Sanctum)**、**篝火晚宴 (Hearth & Candlelight)** 三種光影氛圍。

## 本機開發與建置

```bash
npm install
npm run dev
```
