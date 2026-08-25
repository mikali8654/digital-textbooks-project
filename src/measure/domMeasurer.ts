import { blockBox } from '../model/blockSizing';
import { GAP } from '../model/spacing';
import type { Measurer } from '../model/paginate';
import type { Block, DocSettings, TextBlock } from '../model/types';
import { TEXT_SCALE, roleStyle } from '../styles/roles';
import { spansToHtml } from '../model/inlineDom';

/**
 * 真實量測：把區塊放進一個隱形容器，用瀏覽器自己的排版結果回答高度。
 *
 * 為什麼不用估算：中文的斷行、標點擠壓、注音、直排的行高，
 * 沒有一項算得準。唯一可靠的來源是瀏覽器自己排一次。
 *
 * 容器完全套用與真實頁面相同的 token，所以量到的就是畫出來的。
 */

export type DomMeasurerOptions = {
  settings: Pick<DocSettings, 'writingMode' | 'textScale'>;
  /** 掛載隱形容器的地方。預設是 document.body。 */
  host?: HTMLElement;
};

export type DomMeasurer = Measurer & { dispose(): void };

export function createDomMeasurer(opts: DomMeasurerOptions): DomMeasurer {
  const vertical = opts.settings.writingMode === 'vertical';
  const scale = TEXT_SCALE[opts.settings.textScale];
  const host = opts.host ?? document.body;

  const stage = document.createElement('div');
  // 移出畫面而不是 display:none——隱藏的元素量不到排版結果
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText = [
    'position:absolute',
    'top:0',
    'left:-99999px',
    'visibility:hidden',
    'pointer-events:none',
    'contain:strict',
  ].join(';');
  host.appendChild(stage);

  const probe = document.createElement('div');
  probe.style.writingMode = vertical ? 'vertical-rl' : 'horizontal-tb';
  // 跟編輯區與預覽同一個 class：注音撐高的行高在這裡也要算進去，
  // 否則帶注音的段落每一行都會少量一截
  probe.className = 'ds-rich';
  // 直排的著重線畫在另一邊，會影響行寬——量測端也要知道現在是直排
  if (vertical) probe.dataset.vertical = 'true';
  stage.appendChild(probe);

  /** block 軸的尺寸：橫排量高、直排量寬。 */
  const blockAxis = (rect: { width: number; height: number }) =>
    vertical ? rect.width : rect.height;

  function layoutText(block: TextBlock, inlineSize: number) {
    const s = roleStyle(block.role, scale);
    probe.style.fontSize = s.fontSize;
    probe.style.lineHeight = s.lineHeight;
    probe.style.fontWeight = s.fontWeight;
    probe.style.fontFamily = s.fontFamily;
    // inline 軸＝文字行進方向：橫排是寬，直排是高
    if (vertical) {
      probe.style.height = `${inlineSize}px`;
      probe.style.width = 'max-content';
    } else {
      probe.style.width = `${inlineSize}px`;
      probe.style.height = 'auto';
    }
    // 用與畫面相同的 HTML，不是攤平的純文字——注音與注釋號會影響排版
    probe.innerHTML = spansToHtml(block.spans) || '&#8203;';
    return probe;
  }

  return {
    blockSize(block: Block, inlineSize: number, maxBlockSize: number): number {
      if (block.type === 'text') {
        const el = layoutText(block, inlineSize);
        return Math.min(blockAxis(el.getBoundingClientRect()), maxBlockSize);
      }
      // 非文字區塊走共用的尺寸規則——渲染端用的是同一個函式，
      // 所以量到的一定等於畫出來的。
      const box = blockBox(block, { inlineSize, maxBlockSize, vertical });
      if (!box) return 0;

      // 圖說是常駐顯示的，會佔掉版面，量測必須含進去。
      // 間距用「附屬」那一階——圖與它的圖說是同一件事。
      if (block.type === 'image' && block.caption) {
        const caption = layoutText(
          { ...block, type: 'text', role: 'caption', spans: [{ text: block.caption }] },
          inlineSize
        );
        const captionSize = blockAxis(caption.getBoundingClientRect());
        return Math.min(box.blockSize + GAP.attached + captionSize, maxBlockSize);
      }
      return box.blockSize;
    },

    /**
     * 每一行的 block 軸尺寸。用 Range 取行框——瀏覽器對每個行框
     * 各回一個 rect，這是唯一能拿到真實斷行位置的方法。
     */
    textLineSizes(block: TextBlock, inlineSize: number): number[] {
      const el = layoutText(block, inlineSize);
      if (!el.firstChild) return [];

      // 選整個容器而不是第一個子節點：帶行內標記的段落由多個節點組成，
      // 只選第一個會漏掉後面的行
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = Array.from(range.getClientRects()).filter(
        (r) => r.width > 0 && r.height > 0
      );
      range.detach?.();

      if (rects.length === 0) {
        return [blockAxis(el.getBoundingClientRect())];
      }
      return rects.map(blockAxis);
    },

    dispose() {
      stage.remove();
    },
  };
}
