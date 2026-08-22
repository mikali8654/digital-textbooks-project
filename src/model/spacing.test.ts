import { describe, expect, it } from 'vitest';
import { GAP, gapBefore } from './spacing';
import { makeRow, makeText } from './document';
import { newId } from './ids';
import type { ImageBlock } from './types';

const image = (): ImageBlock => ({
  id: newId('blk'),
  type: 'image',
  assetId: null,
  alt: '',
  caption: '',
  aspectRatio: 1.5,
  popups: [],
});

describe('間距編碼歸屬', () => {
  it('第一列上面沒有間距', () => {
    expect(gapBefore(null, makeRow([makeText('內文')]))).toBe(0);
  });

  it('課名接導言是緊貼', () => {
    const prev = makeRow([makeText('星星的世界', 'lessonTitle')]);
    const next = makeRow([makeText('抬頭看看夜空', 'lead')]);
    expect(gapBefore(prev, next)).toBe(GAP.tight);
  });

  it('大標接內文是緊貼', () => {
    const prev = makeRow([makeText('夜空裡的星座', 'sectionTitle')]);
    const next = makeRow([makeText('晴朗的夜晚', 'body')]);
    expect(gapBefore(prev, next)).toBe(GAP.tight);
  });

  it('相鄰的內文是連續', () => {
    const prev = makeRow([makeText('第一段', 'body')]);
    const next = makeRow([makeText('第二段', 'body')]);
    expect(gapBefore(prev, next)).toBe(GAP.continuous);
  });

  it('內文接注釋是附屬', () => {
    const prev = makeRow([makeText('課文', 'body')]);
    const next = makeRow([makeText('注釋', 'annotation')]);
    expect(gapBefore(prev, next)).toBe(GAP.attached);
  });

  it('圖接圖說是附屬，不是換模組', () => {
    const prev = makeRow([image()]);
    const next = makeRow([makeText('圖1 夏季大三角', 'caption')]);
    expect(gapBefore(prev, next)).toBe(GAP.attached);
  });

  it('內文接圖是換模組', () => {
    const prev = makeRow([makeText('課文', 'body')]);
    const next = makeRow([image()]);
    expect(gapBefore(prev, next)).toBe(GAP.module);
  });

  it('圖接內文也是換模組——盒狀模組前後都隔開', () => {
    const prev = makeRow([image()]);
    const next = makeRow([makeText('課文', 'body')]);
    expect(gapBefore(prev, next)).toBe(GAP.module);
  });

  it('進入新的大標是換節，永遠最大', () => {
    const prev = makeRow([makeText('前一段課文', 'body')]);
    const next = makeRow([makeText('新的一節', 'sectionTitle')]);
    expect(gapBefore(prev, next)).toBe(GAP.section);
  });

  it('換節勝過換模組——圖後面接大標仍然是換節', () => {
    const prev = makeRow([image()]);
    const next = makeRow([makeText('新的一節', 'sectionTitle')]);
    expect(gapBefore(prev, next)).toBe(GAP.section);
  });

  it('導言接大標是換節，不是緊貼', () => {
    const prev = makeRow([makeText('導言', 'lead')]);
    const next = makeRow([makeText('大標', 'sectionTitle')]);
    expect(gapBefore(prev, next)).toBe(GAP.section);
  });
});
