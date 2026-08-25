/** 拿真實教材檔檢驗 parser 的涵蓋率：每一列被辨識成什麼，有沒有東西被吞掉。 */
import { readFileSync } from 'node:fs';
import { parseMarkdown } from '../src/model/markdown';
import type { Block, TextBlock } from '../src/model/types';

const file = process.argv[2];
const md = readFileSync(file, 'utf8');
const doc = parseMarkdown(md, { autoPageBreak: true });

const kind = (b: Block) => (b.type === 'text' ? `text:${(b as TextBlock).role}` : b.type);

const counts: Record<string, number> = {};
let blocks = 0;
for (const row of doc.rows) {
  for (const col of row.columns) {
    for (const b of col.blocks) {
      blocks += 1;
      counts[kind(b)] = (counts[kind(b)] ?? 0) + 1;
    }
  }
}

const printPages = doc.rows.filter((r) => r.printPage != null).map((r) => r.printPage);
const breaks = doc.rows.filter((r) => r.breakBefore).length;

console.log(`\n檔案 ${file}`);
console.log(`meta  ${JSON.stringify(doc.meta)}`);
console.log(`列 ${doc.rows.length} · 區塊 ${blocks} · 注釋 ${Object.keys(doc.footnotes).length} · 換頁線 ${breaks}`);
console.log(`紙本頁碼錨點 ${printPages.join(' ')}`);
console.log('\n區塊型別分布');
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${v}`);
}
console.log(`\n內文 ${counts['text:body'] ?? 0} 段。若某科異常多，代表有構造沒被辨識、掉進內文。`);
