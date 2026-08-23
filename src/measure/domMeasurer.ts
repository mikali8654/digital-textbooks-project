import type { Measurer } from '../model/paginate';
import type { Block, DocSettings, TextBlock } from '../model/types';
import { TEXT_SCALE, roleStyle } from '../styles/roles';

/**
 * 真實量測：把區塊放進一個隱形容器，用瀏覽器自己的排版結果回答高度。
 *
 * 為什麼不用估算：中文的斷行、標點擠壓、注音、直排的行高，
 * 沒有一項算得準。唯一可靠的來源是瀏覽器自己排一次。
 *
 * 容器完全套用與真實頁面相同的 token，所以量到的就是畫出來的。
 */

/** 非文字區塊的估高。真實高度在 D4 由元件自己回報，這裡先給合理的預設。 */
const FALLBACK_BLOCK_SIZE: Record<string, number> = {
  image: 240,
  video: 240,
  audio: 64,
  shape: 120,
  table: 180,
  web: 112,
  dialogue: 88,
  reference: 40,
  module: 200,
  question: 200,
};

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
  probe.style.wordBreak = 'break-word';
  probe.style.whiteSpace = 'pre-wrap';
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
    probe.textContent = block.spans.map((sp) => sp.text).join('') || '​';
    return probe;
  }

  return {
    blockSize(block: Block, inlineSize: number, maxBlockSize: number): number {
      if (block.type === 'text') {
        const el = layoutText(block, inlineSize);
        return Math.min(blockAxis(el.getBoundingClientRect()), maxBlockSize);
      }
      // 盒狀模組比一頁還大時等比縮到放得進去
      return Math.min(FALLBACK_BLOCK_SIZE[block.type] ?? 120, maxBlockSize);
    },

    /**
     * 每一行的 block 軸尺寸。用 Range 取行框——瀏覽器對每個行框
     * 各回一個 rect，這是唯一能拿到真實斷行位置的方法。
     */
    textLineSizes(block: TextBlock, inlineSize: number): number[] {
      const el = layoutText(block, inlineSize);
      const node = el.firstChild;
      if (!node) return [];

      const range = document.createRange();
      range.selectNodeContents(node);
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
