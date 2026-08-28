# V1 數位教科書 · 自編編輯器

老師用來編排數位教科書內容的編輯器。MVP 階段。

## 開始開發

需要 Node 20 以上（開發時用的是 24.17）。

```bash
npm install
npm run dev
```

開啟 http://localhost:5173

一開啟載入的是社會 U4-L1 的示範內容。按「匯入」可以換成國文 L07 或你自己的 md。

## 指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器 |
| `npm run build` | 正式版建置 |
| `npm run typecheck` | TypeScript 檢查 |
| `npm run test` | 單元測試 |
| `npm run tokens` | 從 `design/tokens.raw.txt` 重新產生設計 token |
| `npm run icons` | 從 `design/icons/` 重新產生圖示模組 |
| `npm run inspect` | 把真的教材內容餵進排版引擎，把算出來的頁印出來 |
| `npm run coverage <md>` | 解析器涵蓋率：哪些構造被認出來、有沒有東西掉進內文 |
| `npm run lint` | oxlint |

## 專案結構

```
design/
  tokens.raw.txt        設計 token 的唯一來源（從 Figma 匯出）
  icons/                47 個圖示的 SVG 原始檔
scripts/
  build-tokens.mjs      token → tokens.css + theme.ts
  build-icons.mjs       SVG → icons.generated.ts
src/
  styles/               token、theme、全域樣式
  components/           UI 元件
  assets/               產生出來的資源（勿手動編輯）
```

## 接手前先讀

依這個順序：

1. **`HANDOVER.md`** — 交接說明。這是什麼、哪些是真的哪些是假的、加一種新元件怎麼做、
   已知限制、等客戶回覆的項目。**先讀這一份。**
2. **`CLAUDE.md`** — 動手改的時候要遵守的架構規則。「內容是流、頁是算出來的」這一條
   決定了其他所有設計，違反它的改動一定會出問題。
3. **`THIRD-PARTY.md`** — 圖示的來源與授權。

`design/sample-shehui.md` 與 `design/sample-guowen.md` 是康軒與翰林的真實課文，
測試會讀它們。**轉公開或加外部協作者之前要先確認版權**（見 `HANDOVER.md` 第十節）。

## 技術選擇

React 19 + TypeScript + Vite + styled-components v6。
選擇的依據是與既有專案一致，不是偏好。

設計 token 走 CSS 變數（`--ds-*`），`theme.ts` 只是型別化的別名。
**換配色只要改 `tokens.css`，元件一行都不用動。**
