import { beforeEach, describe, expect, it } from 'vitest';
import { parseMarkdown } from './markdown';
import { textOf } from './document';
import { resetIds } from './ids';
import type { TextBlock } from './types';

const md = `# 星星的世界

抬頭看看夜空，那些一閃一閃的光點。

## 夜空裡的星座

晴朗的夜晚抬頭往天空看，
可以看到許多一閃一閃的星星。

> 觀星小提醒：找一個遠離路燈的地方。
`;

const roles = (rows: ReturnType<typeof parseMarkdown>) =>
  rows.map((r) => (r.columns[0].blocks[0] as TextBlock).role);

beforeEach(resetIds);

describe('md 匯入', () => {
  it('標題階層對應到文字角色', () => {
    expect(roles(parseMarkdown(md, { autoPageBreak: false })))
      .toEqual(['h1', 'body', 'h2', 'body', 'annotation']);
  });

  it('段落內的換行併成同一段', () => {
    const rows = parseMarkdown(md, { autoPageBreak: false });
    expect(textOf(rows[3].columns[0].blocks[0] as TextBlock))
      .toBe('晴朗的夜晚抬頭往天空看，可以看到許多一閃一閃的星星。');
  });

  it('自動切頁在大標與中標前面各放一條換頁線', () => {
    const rows = parseMarkdown(md, { autoPageBreak: true });
    expect(rows.map((r) => r.breakBefore)).toEqual([false, false, true, false, false]);
  });

  it('不切頁就完全不放換頁線', () => {
    const rows = parseMarkdown(md, { autoPageBreak: false });
    expect(rows.every((r) => !r.breakBefore)).toBe(true);
  });

  it('第一列永遠不帶換頁線', () => {
    const rows = parseMarkdown('# 只有一個標題', { autoPageBreak: true });
    expect(rows[0].breakBefore).toBe(false);
  });

  it('空白輸入不會產生任何列', () => {
    expect(parseMarkdown('   \n\n  ', { autoPageBreak: true })).toHaveLength(0);
  });
});
