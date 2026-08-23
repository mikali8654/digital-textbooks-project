import type { Block } from './types';

/**
 * 非文字區塊的尺寸規則。
 *
 * 這是量測與渲染的**唯一來源**。兩邊各算各的會讓分頁與畫面不一致——
 * 量測說 240、實際畫出 626，內容就會撐破頁面被切掉，看起來像滿版出血。
 *
 * 文字不走這裡：文字的高度只有瀏覽器排一次才知道。
 */

/** 盒狀模組最多佔一頁的多少。避免一張圖獨佔整頁，也留空間給圖說。 */
const MAX_SHARE_OF_PAGE = 0.62;

/** 沒有內在比例的區塊，就用固定的 block 尺寸。 */
const FIXED: Record<string, number> = {
  audio: 64,
  shape: 120,
  table: 180,
  web: 112,
  dialogue: 88,
  reference: 40,
  module: 200,
  question: 220,
};

export type SizingContext = {
  /** 該欄的 inline 尺寸（橫排＝寬，直排＝高）。 */
  inlineSize: number;
  /** 一整頁的可用 block 尺寸。 */
  maxBlockSize: number;
  vertical: boolean;
};

/**
 * 有內在長寬比的區塊（圖片、影片）在 block 軸上佔多少。
 *
 * 橫排：寬度吃滿欄寬，高度由比例決定。
 * 直排：高度吃滿欄高，寬度由比例決定——block 軸是水平的。
 */
export function aspectBlockSize(aspectRatio: number, ctx: SizingContext): number {
  const natural = ctx.vertical
    ? ctx.inlineSize * aspectRatio
    : ctx.inlineSize / aspectRatio;
  return Math.min(natural, ctx.maxBlockSize * MAX_SHARE_OF_PAGE);
}

/**
 * 區塊在 inline 與 block 兩軸上的實際尺寸。
 * 渲染時直接用這組數字設定行內樣式，畫出來的就等於量到的。
 */
export function blockBox(
  block: Block,
  ctx: SizingContext
): { inlineSize: number; blockSize: number } | null {
  if (block.type === 'text') return null;

  if (block.type === 'image' || block.type === 'video') {
    const ratio = block.type === 'image' ? block.aspectRatio : 16 / 9;
    const blockSize = aspectBlockSize(ratio, ctx);
    // 等比縮小之後，inline 軸也要跟著縮，否則會變形
    const inlineSize = ctx.vertical ? blockSize / ratio : blockSize * ratio;
    return {
      inlineSize: Math.min(inlineSize, ctx.inlineSize),
      blockSize,
    };
  }

  return {
    inlineSize: ctx.inlineSize,
    blockSize: Math.min(FIXED[block.type] ?? 120, ctx.maxBlockSize),
  };
}
