import { readFileSync } from 'node:fs';
import { parseMarkdown } from '../src/model/markdown';

const md = readFileSync('design/sample-shehui.md', 'utf8');
const r = parseMarkdown(md, { autoPageBreak: true });

const byType: Record<string, number> = {};
const byRole: Record<string, number> = {};
for (const row of r.rows) {
  for (const b of row.columns[0].blocks) {
    byType[b.type] = (byType[b.type] ?? 0) + 1;
    if (b.type === 'text') byRole[b.role] = (byRole[b.role] ?? 0) + 1;
  }
}
console.log('標題：', r.title);
console.log('meta：', JSON.stringify(r.meta));
console.log('settings：', JSON.stringify(r.settings));
console.log('列數：', r.rows.length);
console.log('區塊型別：', byType);
console.log('文字角色：', byRole);
console.log('自動換頁線：', r.rows.filter((x) => x.breakBefore).length);
console.log('原頁碼錨點：', r.rows.filter((x) => x.printPage).map((x) => x.printPage).join(' '));
console.log('注釋：', r.footnotes.length);
console.log('未辨識：', r.unrecognized.length, r.unrecognized);

const kw = r.rows.flatMap((x) => x.columns[0].blocks).flatMap((b) => (b.type === 'text' ? b.spans : [])).filter((s) => s.keyword);
console.log('重點詞：', kw.map((s) => s.text).join('、'));
const ruby = r.rows.flatMap((x) => x.columns[0].blocks).flatMap((b) => (b.type === 'text' ? b.spans : [])).filter((s) => s.ruby);
console.log('注音：', ruby.map((s) => `${s.text}(${s.ruby})`).join('、'));
