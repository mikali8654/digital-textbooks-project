import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMarkdown } from './markdown';
import { plainOf } from './inline';
import { resetIds } from './ids';
import type { Block, DialogueBlock, ImageBlock, TableBlock, TextBlock, WebBlock } from './types';

const parse = (src: string) => parseMarkdown(src, { autoPageBreak: false });
const blocks = (r: ReturnType<typeof parse>): Block[] =>
  r.rows.flatMap((row) => row.columns[0].blocks);
const first = <T extends Block>(r: ReturnType<typeof parse>, type: Block['type']) =>
  blocks(r).find((b) => b.type === type) as T;

beforeEach(resetIds);

describe('frontmatter', () => {
  const src = `---
id: U4-L1
title: 日治時期的建設帶來什麼影響？
publisher: 康軒
stage: 國小                  # 國小 / 國中
grade: 5
direction: 橫排              # 直排 / 橫排
unit: 日治時期的社會變遷
page: [90, 97]
---

　　內文。
`;

  it('讀出書目資料，並忽略註解', () => {
    const r = parse(src);
    expect(r.title).toBe('日治時期的建設帶來什麼影響？');
    expect(r.meta.publisher).toBe('康軒');
    expect(r.meta.stage).toBe('國小');
    expect(r.meta.printPageRange).toEqual([90, 97]);
  });

  it('direction 直排會設定整本的書寫方向', () => {
    expect(parse(src.replace('橫排', '直排')).settings.writingMode).toBe('vertical');
  });

  it('frontmatter 不會變成內容', () => {
    expect(blocks(parse(src))).toHaveLength(1);
  });
});

describe('四層標題對應四個角色', () => {
  it('# ## ### #### 分別是 課名 大標 中標 小標', () => {
    const r = parse('# 課\n\n## 區塊\n\n### 項\n\n#### 子項\n\n沒有標記的段落');
    expect(blocks(r).map((b) => (b as TextBlock).role)).toEqual([
      'lessonTitle', 'sectionTitle', 'itemTitle', 'subItemTitle', 'body',
    ]);
  });

  it('自動切頁只切區塊，不切項', () => {
    // 課名自成一頁（扉頁），之後每個區塊起一頁；項不切，否則一課會變二十幾頁
    const src = '# 課\n\n## 區塊一\n\n### 項\n\n## 區塊二\n\n### 項';
    const r = parseMarkdown(src, { autoPageBreak: true });
    expect(r.rows.map((x) => x.breakBefore)).toEqual([false, true, false, true, false]);
  });
});

describe('行內標記是語意，不是樣式', () => {
  it('重點詞標成 keyword，不是粗體', () => {
    const r = parse('例如==嘉南大圳==完成後。');
    const spans = (blocks(r)[0] as TextBlock).spans;
    expect(spans.find((s) => s.keyword)?.text).toBe('嘉南大圳');
    expect(spans.every((s) => !s.bold)).toBe(true);
  });

  it('注音存進 ruby 欄位', () => {
    const spans = (blocks(parse('{閑|ㄒㄧㄢˊ}靜少言')) [0] as TextBlock).spans;
    expect(spans[0]).toMatchObject({ text: '閑', ruby: 'ㄒㄧㄢˊ' });
    expect(plainOf(spans)).toBe('閑靜少言');
  });

  it('重點詞裡面的注音不會被吃掉', () => {
    const spans = (blocks(parse('==瓦旦．{燮|ㄒㄧㄝˋ}謝促==率領下')) [0] as TextBlock).spans;
    const ruby = spans.find((s) => s.ruby);
    expect(ruby).toMatchObject({ text: '燮', ruby: 'ㄒㄧㄝˋ', keyword: true });
  });

  it('注釋參照與注釋定義配得起來', () => {
    const r = parse('先生不知何許[^1]人也。\n\n[^1]: 何許　何處。許，處所。');
    const ref = (blocks(r)[0] as TextBlock).spans.find((s) => s.footnoteRef);
    expect(ref?.footnoteRef).toBe('1');
    expect(r.footnotes[0]).toEqual({ id: '1', term: '何許', body: '何處。許，處所。' });
  });
});

describe('圖片的三種文字職責不同', () => {
  it('替代文字與圖說分開存', () => {
    const r = parse('![臺灣鐵路建設分布圖，以三種線條區分](img/rail.jpg "2 西元 1908 年完成西部縱貫鐵路。")');
    const img = first<ImageBlock>(r, 'image');
    expect(img.alt).toBe('臺灣鐵路建設分布圖，以三種線條區分');
    expect(img.caption).toBe('2 西元 1908 年完成西部縱貫鐵路。');
    expect(img.assetId).toBe('img/rail.jpg');
  });

  it('圖說保留課本的圖號，不重新編', () => {
    const r = parse('![甲](a.jpg "1 第一張")\n\n![乙](b.jpg "1 另一個跨頁又從 1 開始")');
    const caps = blocks(r).map((b) => (b as ImageBlock).caption);
    expect(caps).toEqual(['1 第一張', '1 另一個跨頁又從 1 開始']);
  });
});

describe('原頁碼是錨點，不是換頁線', () => {
  it('@頁 標在下一段內容上，且不造成換頁', () => {
    const r = parse('　　第 90 頁的內容。\n\n@頁[91]\n\n## 交通建設對生活的改變');
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].printPage).toBeUndefined();
    expect(r.rows[1].printPage).toBe(91);
    expect(r.rows[1].breakBefore).toBe(false);
  });

  it('紙本頁碼與換頁線互不干擾', () => {
    const src = '# 課\n\n@頁[91]\n\n## 區塊';
    const r = parseMarkdown(src, { autoPageBreak: true });
    const marked = r.rows.find((x) => x.printPage === 91)!;
    expect(marked.printPage).toBe(91);
    expect(marked.breakBefore).toBe(true); // 換頁是因為它是區塊，不是因為 @頁
  });
});

describe('自訂指令', () => {
  it('對話框是內容，一句一個', () => {
    const r = parse('@對話[蔗農]{這應該是一千五百斤呀！}\n@對話[糖廠人員]{秤起來是一千兩百斤。}');
    const ds = blocks(r) as DialogueBlock[];
    expect(ds).toHaveLength(2);
    expect(ds[0]).toMatchObject({ speaker: '蔗農', text: '這應該是一千五百斤呀！' });
  });

  it('QR 連結記成 web 元件的第三種呈現', () => {
    const r = parse('@連結[八田與一](https://example.org/hatta){QR}');
    expect(first<WebBlock>(r, 'web')).toMatchObject({ presentation: 'qr', title: '八田與一' });
  });

  it('題型標籤掛在下一個區塊上', () => {
    const r = parse('@題型[快篩訊息]\n\n### 第一題');
    expect(blocks(r)[0].label).toBe('快篩訊息');
  });

  it('模組記下種類，不是內容', () => {
    const r = parse('@模組[朝代時間軸](timeline/dynasty)');
    expect(first(r, 'module')).toMatchObject({ moduleKind: 'timeline/dynasty', title: '朝代時間軸' });
  });

  it('刻意不做的指令記在 skipped，跟格式寫錯分開', () => {
    const r = parse('@排版[橫排]\n\n內文');
    // skipped＝我們決定不做；unrecognized＝格式可能寫錯。
    // 交接時要跟客戶說明的是前者，要請人修正的是後者。
    expect(r.skipped).toEqual(['@排版[橫排]']);
    expect(r.unrecognized).toEqual([]);
  });

  it('真的不認得的指令才進 unrecognized', () => {
    const r = parse('@不存在的指令[xxx]\n\n內文');
    expect(r.unrecognized).toEqual(['@不存在的指令[xxx]']);
    expect(r.skipped).toEqual([]);
  });
});

describe('表格', () => {
  it('解析成儲存格陣列並標出有表頭', () => {
    const r = parse('| 西元（年） | 產量 |\n|---|---|\n| 1923 | 48 |\n| 1934 | 197 |');
    const t = first<TableBlock>(r, 'table');
    expect(t.hasHeader).toBe(true);
    expect(t.cols).toBe(2);
    expect(t.cells).toEqual([['西元（年）', '產量'], ['1923', '48'], ['1934', '197']]);
  });
});

describe('拿真的社會課本檢驗', () => {
  const r = parseMarkdown(readFileSync('design/sample-shehui.md', 'utf8'), { autoPageBreak: true });

  it('每一種構造都有對應的區塊，沒有東西掉進內文', () => {
    const count = (t: Block['type']) => blocks(r).filter((b) => b.type === t).length;
    expect(count('image')).toBe(21);
    expect(count('dialogue')).toBe(7);
    expect(count('table')).toBe(3);
    expect(count('reference')).toBe(3);
    expect(count('web')).toBe(1);
    expect(r.unrecognized).toEqual([]);
  });

  it('七個紙本頁碼全部收成錨點', () => {
    expect(r.rows.filter((x) => x.printPage).map((x) => x.printPage)).toEqual([91, 92, 93, 94, 95, 96, 97]);
  });

  it('課名只有一個，區塊五個', () => {
    const roles = blocks(r).filter((b) => b.type === 'text').map((b) => (b as TextBlock).role);
    expect(roles.filter((x) => x === 'lessonTitle')).toHaveLength(1);
    expect(roles.filter((x) => x === 'sectionTitle')).toHaveLength(5);
  });

  it('四個重點詞被標成 keyword', () => {
    const kw = blocks(r)
      .filter((b) => b.type === 'text')
      .flatMap((b) => (b as TextBlock).spans)
      .filter((s) => s.keyword);
    expect(plainOf(kw)).toContain('嘉南大圳');
    expect(plainOf(kw)).toContain('總督府');
  });

  it('二十一張圖的替代文字全部保住', () => {
    const imgs = blocks(r).filter((b) => b.type === 'image') as ImageBlock[];
    expect(imgs.every((i) => i.alt.length > 0)).toBe(true);
  });
});

describe('國文：直排、題目、模組', () => {
  const r = parseMarkdown(readFileSync('design/sample-guowen.md', 'utf8'), {
    autoPageBreak: true,
  });
  const blocks = r.rows.flatMap((row) => row.columns.flatMap((c) => c.blocks));

  it('frontmatter 的直排會設定到書寫方向', () => {
    expect(r.settings.writingMode).toBe('vertical');
  });

  it('注釋全數收進文件層', () => {
    expect(r.footnotes).toHaveLength(30);
    expect(r.footnotes[0]).toMatchObject({ id: '1', term: '何許' });
  });

  it('紙本頁碼是錨點，不造成換頁', () => {
    const anchors = r.rows.filter((row) => row.printPage != null);
    expect(anchors.map((row) => row.printPage)).toEqual([
      113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123,
    ]);
    // 有錨點的列不一定是某頁的第一列——分頁由內容長度決定
    expect(anchors.some((row) => !row.breakBefore)).toBe(true);
  });

  it('題目是結構化的，題型標籤與選項分開存', () => {
    const qs = blocks.filter((b) => b.type === 'question');
    expect(qs).toHaveLength(5);
    expect(qs[0]).toMatchObject({
      number: '1',
      questionType: '快篩訊息',
      multiple: true,
    });
    expect(qs[0].type === 'question' && qs[0].options.map((o) => o.key)).toEqual([
      'A', 'B', 'C', 'D', 'E',
    ]);
    expect(qs[1]).toMatchObject({ questionType: '瞄準文心', multiple: false });
  });

  it('模組保留種類與參數，交給模組自己解讀', () => {
    const mods = blocks.filter((b) => b.type === 'module');
    expect(mods).toHaveLength(1);
    expect(mods[0]).toMatchObject({
      title: '朝代時間軸',
      moduleKind: 'timeline/dynasty',
      params: { 標示: '魏晉南北朝' },
    });
  });

  it('沒有任何構造被吞掉', () => {
    expect(r.unrecognized).toEqual([]);
  });

  it('MVP 不做的指令會被記錄，不是丟掉', () => {
    expect(r.skipped).toEqual(['@排版[橫排]', '@排版[橫排]']);
  });
});
