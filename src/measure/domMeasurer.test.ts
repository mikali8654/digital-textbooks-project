// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createDomMeasurer } from './domMeasurer';
import { makeText } from '../model/document';

/**
 * jsdom 沒有排版引擎，量出來的尺寸一律是 0，所以這裡不測「量得準不準」——
 * 那要靠瀏覽器。這裡測的是量測的**前提**：探針必須在文件裡。
 *
 * 離開文件的元素每一個尺寸都是 0，而 0 會被分頁器當成「放得下」：
 * 所有內容都不切頁、頁數只剩標題的自動換頁在撐，畫面上內容直接溢出，
 * 而且錯的 0 還會被寫進量測快取。這個 bug 在單元測試裡完全看不出來，
 * 因為假量測器不需要 DOM。
 */
const probes = () =>
  [...document.body.children].filter((e) => e.getAttribute('aria-hidden') === 'true');

// 每個案例各自獨立：上一個沒收乾淨不該讓下一個誤判
afterEach(() => probes().forEach((e) => e.remove()));

describe('量測探針', () => {
  it('建立時就掛在文件裡', () => {
    const m = createDomMeasurer({ settings: { writingMode: 'horizontal', textScale: 'md' } });
    expect(probes()).toHaveLength(1);
    m.dispose();
    expect(probes()).toHaveLength(0);
  });

  it('被提早收掉之後還能用——量測前會自己掛回去', () => {
    // React 的 StrictMode 會 mount → cleanup → mount，清理函式因此會在
    // 「還要繼續用」的時候跑到。與其要求每個呼叫端都不要提早 dispose，
    // 不如讓量測本身保證前提成立。
    const m = createDomMeasurer({ settings: { writingMode: 'horizontal', textScale: 'md' } });
    m.dispose();
    expect(probes()).toHaveLength(0);

    m.blockSize(makeText('課文'), 400, 600);
    expect(probes()).toHaveLength(1);
    m.dispose();
  });

  // textLineSizes 走的是同一個 layoutText，jsdom 沒有 Range.getClientRects
  // 所以測不了，那條路徑由瀏覽器驗。

  it('非文字區塊也走同一條路', () => {
    const m = createDomMeasurer({ settings: { writingMode: 'horizontal', textScale: 'md' } });
    m.dispose();
    m.blockSize(
      { id: 'b', type: 'image', assetId: null, alt: '', caption: '圖說', aspectRatio: 1.5, popups: [] },
      400,
      600
    );
    expect(probes()).toHaveLength(1);
    m.dispose();
  });

  it('重複 dispose 不會出事', () => {
    const m = createDomMeasurer({ settings: { writingMode: 'horizontal', textScale: 'md' } });
    m.dispose();
    expect(() => m.dispose()).not.toThrow();
    expect(probes()).toHaveLength(0);
  });
});
