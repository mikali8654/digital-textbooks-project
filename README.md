# V1 數位教科書 · 自編編輯器

老師用來編排數位教科書內容的編輯器。MVP 階段。

## 開始開發

需要 Node 20 以上（開發時用的是 24.17）。

```bash
npm install
npm run dev
```

開啟 http://localhost:5173

## 指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器 |
| `npm run build` | 正式版建置 |
| `npm run typecheck` | TypeScript 檢查 |
| `npm run test` | 單元測試 |
| `npm run tokens` | 從 `design/tokens.raw.txt` 重新產生設計 token |
| `npm run icons` | 從 `design/icons/` 重新產生圖示模組 |

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

- **`CLAUDE.md`** — 架構的核心規則。「內容是流、頁是算出來的」這一條決定了其他所有設計，
  違反它的改動一定會出問題。
- **`THIRD-PARTY.md`** — 圖示的來源與授權。

## 技術選擇

React 19 + TypeScript + Vite + styled-components v6。
選擇的依據是與既有專案一致，不是偏好。

設計 token 走 CSS 變數（`--ds-*`），`theme.ts` 只是型別化的別名。
**換配色只要改 `tokens.css`，元件一行都不用動。**
