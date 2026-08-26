import { describe, expect, it } from 'vitest';
import { POPUP_KIND, POPUP_KINDS, missingOf, newPopup, titleOf } from './popups';
import { canHavePopup, blockRegistry } from './registry';
import type { BlockType, PopupItem } from './types';

describe('補充的種類', () => {
  it('每一種都有標籤、圖示與行動鈕的字', () => {
    // 少一筆就會在檢視器上出現空白按鈕，而那要到上課才會被發現
    for (const k of POPUP_KINDS) {
      const meta = POPUP_KIND[k];
      expect(meta.label).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.action).toBeTruthy();
    }
  });

  it('新增出來的每一種都還沒填完', () => {
    // 這條讓「還沒填什麼」的提示有意義：剛加上去一定會亮，
    // 老師不會以為掛好了，結果上課點下去是空的
    for (const k of POPUP_KINDS) {
      expect(missingOf(newPopup(k))).not.toBeNull();
    }
  });

  it('新增出來的 id 不重複', () => {
    const ids = POPUP_KINDS.map((k) => newPopup(k).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('還缺什麼', () => {
  const filled: PopupItem[] = [
    { id: 'a', kind: 'text', title: '', body: '說明' },
    { id: 'b', kind: 'image', title: '', assetId: 'asset-1' },
    { id: 'c', kind: 'video', title: '', source: 'youtube', ref: 'dQw4w9WgXcQ' },
    { id: 'd', kind: 'audio', title: '', assetId: 'asset-2' },
    { id: 'e', kind: 'web', title: '', url: 'https://example.com', embeddable: false },
    { id: 'f', kind: 'jump', title: '', targetRowId: 'row_1' },
  ];

  it('填完的都不再提示', () => {
    for (const item of filled) expect(missingOf(item)).toBeNull();
  });

  it('只有空白字元不算填完', () => {
    expect(missingOf({ id: 'a', kind: 'text', title: '', body: '   ' })).not.toBeNull();
    expect(
      missingOf({ id: 'e', kind: 'web', title: '', url: '  ', embeddable: false })
    ).not.toBeNull();
  });
});

describe('標題', () => {
  it('沒填標題就用種類的名字，清單上不會出現空白列', () => {
    expect(titleOf(newPopup('video'))).toBe('影片');
    expect(titleOf({ ...newPopup('video'), title: '  ' })).toBe('影片');
  });

  it('填了就用填的', () => {
    expect(titleOf({ ...newPopup('text'), title: '什麼是總督府？' })).toBe('什麼是總督府？');
  });
});

describe('哪些元件能掛補充', () => {
  it('本身就有互動的元件不能再掛', () => {
    // 影片點了會播、網頁點了會開——再掛一層補充，學生點下去會發生什麼
    // 就變成不可預測的
    for (const t of ['video', 'audio', 'web'] as BlockType[]) {
      expect(canHavePopup(t)).toBe(false);
    }
  });

  it('文字與圖片可以掛', () => {
    expect(canHavePopup('text')).toBe(true);
    expect(canHavePopup('image')).toBe(true);
  });

  it('每一種元件都表態過，沒有漏掉的', () => {
    for (const t of Object.keys(blockRegistry) as BlockType[]) {
      expect(typeof canHavePopup(t)).toBe('boolean');
    }
  });
});
