# V1 數位教科書 · 自編編輯器

老師用來編排數位教科書內容的編輯器。這份檔案給接手的 AI 代理與工程師閱讀。

## 一句話說明架構

**內容是一條連續的流，頁是算出來的。** 系統儲存的是「這一課有哪些內容、依什麼順序」，
不儲存頁。頁是把內容流依照可用高度切出來的結果。

這一條決定了整個系統的其他所有設計，違反它的改動一定會出問題：

- **沒有自由畫布。** 元件的位置只有兩個維度：在流裡的順序、以及它那一列怎麼分欄。
  沒有 x / y 座標，拖曳的落點是有限的幾個，不是連續平面。
- **改了前面的內容，後面的頁會自己重排。** 頁數增加是正常狀態，不是錯誤，不要加警告。
- **頁是固定比例的畫布**（預設 4:3），在任何螢幕上整頁等比縮放。
  這是為了保證老師的第 76 頁和學生的第 76 頁是同一頁——各校平板規格不一，
  若採用真正的響應式重排，分頁會因裝置而異，那在教學現場無法使用。

## 設計 token

**唯一來源是 `design/tokens.raw.txt`**，從 Figma 的「2. Semantic」collection 匯出。
變數名稱直接取自 Figma 每個變數的 `codeSyntax.WEB`，所以 Figma 與程式碼用同一組名字。

```
design/tokens.raw.txt   →  npm run tokens  →  src/styles/tokens.css   （CSS 變數，實際值）
                                            →  src/styles/theme.ts    （型別化的 var() 別名）
```

元件一律透過 `theme.*` 取值，值本身永遠是 `var(--ds-*)`：

```ts
const Button = styled.button`
  background: ${(p) => p.theme.action.primaryBg};
  border-radius: ${(p) => p.theme.radius.control};
`;
```

**因此換配色只要改 `tokens.css`，元件一行都不用動。** 不要在元件裡寫字面色值、
字級或間距數字——那會讓改配色的機制失效。

## 圖示

47 個，來自 [Lucide](https://lucide.dev)（ISC 授權），`stroke-width` 統一改成 1.5
以符合設計系統。與 Figma 的 `Icon/*` 元件同源。

```
design/icons/*.svg  →  npm run icons  →  src/assets/icons.generated.ts
```

用法：`<Icon name="undo" size={20} label="復原" />`。線條色是 `currentColor`，
由外層文字色決定，所以不需要為每個狀態各做一顆。

**新增圖示**：把 SVG 放進 `design/icons/`、跑 `npm run icons`，
並在 Figma 建同名的 `Icon/<name>` 元件，兩邊才不會漂移。

## 慣例

- **狀態一律用 `$` 前綴的 transient props**（`$selected`），避免傳到 DOM
- **focus 只在鍵盤操作時顯示**（`:focus-visible`），滑鼠點擊不觸發
- **圖示放在文字之後**，不放在文字前面——這是設計系統的規則，不是偏好
- **邊框用實色 token**，不要用黑色加透明度疊出來
- 元件檔案與元件同名，一個檔案一個主要匯出

## 指令

| | |
|---|---|
| `npm run dev` | 開發伺服器 |
| `npm run tokens` | 從 tokens.raw.txt 重新產生 token |
| `npm run icons` | 從 design/icons 重新產生圖示模組 |
| `npm run typecheck` | TypeScript 檢查 |
| `npm run test` | 單元測試（排版引擎的正確性靠這個把關） |

## 目前進度

D0 完成：專案骨架、token 管線、圖示管線、煙霧測試畫面。
下一步是排版引擎（document model 與分頁），詳見 `HANDOVER.md`。
