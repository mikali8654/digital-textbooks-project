import { beforeEach, describe, expect, it } from 'vitest';
import { COALESCE_WINDOW_MS, canRedo, canUndo, dispatch, initHistory, redo, undo } from './history';
import { emptyDoc, makeRow, makeText, textOf } from './document';
import { resetIds } from './ids';
import type { TextBlock } from './types';

const setup = () => {
  const t = makeText('');
  const doc = { ...emptyDoc(), rows: [makeRow([t])] };
  return { blockId: t.id, history: initHistory(doc) };
};

const readText = (h: ReturnType<typeof initHistory>) =>
  textOf(h.present.rows[0].columns[0].blocks[0] as TextBlock);

beforeEach(resetIds);

describe('復原與重做', () => {
  it('一開始沒有東西可以復原', () => {
    expect(canUndo(setup().history)).toBe(false);
    expect(canRedo(setup().history)).toBe(false);
  });

  it('可以來回', () => {
    const { blockId, history } = setup();
    let h = history;
    h = dispatch(h, { type: 'setTextRole', blockId, role: 'sectionTitle' }, 0);
    h = dispatch(h, { type: 'setTitle', title: '星星的世界' }, 5000);
    expect(h.present.title).toBe('星星的世界');

    h = undo(h);
    expect(h.present.title).not.toBe('星星的世界');
    h = redo(h);
    expect(h.present.title).toBe('星星的世界');
  });

  it('連續打字合併成一次復原', () => {
    const { blockId, history } = setup();
    let h = history;
    let t = 0;
    for (const text of ['星', '星星', '星星的', '星星的世界']) {
      h = dispatch(h, { type: 'setText', blockId, text }, (t += 100));
    }
    expect(readText(h)).toBe('星星的世界');
    h = undo(h);
    // 一次復原回到打字之前，而不是退回「星星的」
    expect(readText(h)).toBe('');
  });

  it('停頓超過合併時間就是另一次編輯', () => {
    const { blockId, history } = setup();
    let h = history;
    h = dispatch(h, { type: 'setText', blockId, text: '第一句' }, 0);
    h = dispatch(h, { type: 'setText', blockId, text: '第一句第二句' }, COALESCE_WINDOW_MS + 1);
    h = undo(h);
    expect(readText(h)).toBe('第一句');
  });

  it('新的編輯會清掉重做的分支', () => {
    const { blockId, history } = setup();
    let h = history;
    h = dispatch(h, { type: 'setText', blockId, text: 'A' }, 0);
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = dispatch(h, { type: 'setText', blockId, text: 'B' }, 9000);
    expect(canRedo(h)).toBe(false);
  });

  it('沒有造成改變的動作不佔一次復原', () => {
    let h = setup().history;
    h = dispatch(h, { type: 'deleteRow', rowId: 'not-there' }, 0);
    expect(canUndo(h)).toBe(false);
  });
});
