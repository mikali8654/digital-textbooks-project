/**
 * 引擎檢視器：把真的教材內容餵進排版引擎，把算出來的頁印出來。
 *
 * D1 的引擎沒有畫面，這個腳本讓人不必讀測試也能看見它的行為。
 *   npm run inspect
 */
import { parseMarkdown } from '../src/model/markdown';
import { paginate, type Page } from '../src/model/paginate';
import { applyAction } from '../src/model/reducer';
import { emptyDoc, textOf } from '../src/model/document';
import { fakeMeasurer, pageOptions } from '../src/model/testing';
import type { Doc, Row, TextBlock } from '../src/model/types';

const ROLE_LABEL: Record<string, string> = {
  lessonTitle: '課名', h1: '大標', h2: '中標', h3: '小標', lead: '導言',
  body: '內文', supplement: '補充', annotation: '注釋', caption: '圖說',
};

const md = `# 星星的世界

抬頭看看夜空，那些一閃一閃的光點，藏著什麼樣的故事？

## 夜空裡的星座

晴朗的夜晚抬頭往天空看，可以看到許多一閃一閃的星星。它們有的亮、有的暗，位置看起來固定不動，其實會隨著季節慢慢改變。

夏天的夜晚，我們可以找到明亮的「夏季大三角」。它由三顆亮星連成，能幫助我們找到附近的星座。

> 觀星小提醒：找一個遠離路燈、視野開闊的地方，眼睛適應黑暗大約需要二十分鐘。

## 星星的移動

星星每天東升西落，這是因為地球自轉造成的。同一顆星在不同季節出現的時間也不一樣，因為地球還繞著太陽公轉。

北極星幾乎不動，所以自古以來就被用來辨認方向。找到北斗七星，把杓口的兩顆星連起來延伸五倍，就會看到北極星。
`;

const START = (s: string) =>
  s === 'manual' ? '手動換頁 · 位置固定' : s === 'auto' ? '自動換頁 · 隨內容移動' : '第一頁';

function describeRow(row: Row): string {
  const parts = row.columns.map((col) =>
    col.blocks
      .map((b) => {
        if (b.type !== 'text') return `[${b.type}]`;
        const t = textOf(b as TextBlock);
        const label = ROLE_LABEL[b.role] ?? b.role;
        const preview = t.length > 26 ? t.slice(0, 26) + '…' : t;
        return `${label}｜${preview}`;
      })
      .join(' + ')
  );
  return parts.join('  ‖  ');
}

function render(pages: Page[], title: string) {
  console.log(`\n${'═'.repeat(74)}\n${title}\n${'═'.repeat(74)}`);
  for (const page of pages) {
    const pct = Math.round((page.usedBlockSize / pageOptions.contentBlockSize) * 100);
    console.log(`\n┌─ 第 ${page.index + 1} 頁 ── ${START(page.startedBy)} ── 已用 ${pct}%`);
    for (const item of page.items) {
      const marks = [
        item.continuedFromPrev ? '↰接上頁' : '',
        item.continuesOnNext ? '↴接下頁' : '',
      ].filter(Boolean).join(' ');
      const gap = item.gapBefore ? `間距 ${String(item.gapBefore).padStart(2)}` : '　　　 ';
      console.log(`│ ${gap} │ ${describeRow(item.row)} ${marks}`);
    }
    const left = pageOptions.contentBlockSize - page.usedBlockSize;
    if (left > 0) console.log(`│ ${' '.repeat(8)}│ ⌄ 其餘留白 ${left}px（使用者選擇的結果，不是錯誤）`);
    console.log('└' + '─'.repeat(72));
  }
}

const run = (doc: Doc) => paginate(doc.rows, pageOptions, fakeMeasurer);

// ── 1. 匯入 md，自動切頁 ──────────────────────────────
let doc: Doc = { ...emptyDoc('自然 三年級下學期 第三單元'), rows: parseMarkdown(md, { autoPageBreak: true }) };
render(run(doc), '① 匯入 md（自動切頁）— 每個大標與中標各起一頁');

// ── 2. 在最前面加一大段字 ────────────────────────────
const firstBody = doc.rows[1].columns[0].blocks[0];
doc = applyAction(doc, {
  type: 'setText',
  blockId: firstBody.id,
  text: '抬頭看看夜空，那些一閃一閃的光點，藏著什麼樣的故事？'.repeat(6),
});
render(run(doc), '② 在第一段塞進六倍的字 — 後面的內容自己往後流，但手動換頁線沒有移動');

// ── 3. 移除一條手動換頁線 ────────────────────────────
const secondBreak = doc.rows.filter((r) => r.breakBefore)[1];
doc = applyAction(doc, { type: 'setBreakBefore', rowId: secondBreak.id, value: false });
render(run(doc), '③ 把「星星的移動」的手動換頁線移除 — 位置交還給系統決定');

// ── 4. 一段長到跨頁的課文 ────────────────────────────
const longBody = doc.rows.at(-1)!.columns[0].blocks[0];
doc = applyAction(doc, {
  type: 'setText',
  blockId: longBody.id,
  text: '北極星幾乎不動，所以自古以來就被用來辨認方向。找到北斗七星，把杓口的兩顆星連起來延伸五倍，就會看到北極星。'.repeat(8),
});
render(run(doc), '④ 最後一段長到跨頁 — 只有文字會被切開，切點在行邊界，前後仍是同一個元件');

const all = run(doc).flatMap((p) => p.items);
const head = all.find((i) => i.continuesOnNext);
const tail = all.find((i) => i.continuedFromPrev);
console.log(
  `\n驗證：切開前後是同一個元件？ ${head && tail && head.row.id === tail.row.id ? '是' : '否'}` +
  `（row ${head?.row.id} → ${tail?.row.id}）`
);
