import type { Block } from './types';

/**
 * 非文字區塊的尺寸規則。
 *
 * 這是量測與渲染的**唯一來源**。兩邊各算各的會讓分頁與畫面不一致——
 * 量測說 240、實際畫出 626，內容就會撐破頁面被切掉，看起來像滿版出血。
 *
 * 文字不走這裡：文字的高度只有瀏覽器排一次才知道。
 */

/**
 * 圖片預設佔一頁的多少。
 *
 * 曾經讓圖片吃滿欄寬，理由是要跟文字對齊同一組邊界。但實際編起來
 * 才發現代價太大：4:3 的頁面下，一張 3:2 的圖吃滿欄寬就是 597px，
 * 佔掉整頁的 93%——插一張圖就等於用掉一頁，老師沒辦法圖文混排。
 *
 * 所以改成「先照比例算，超過這個比例就縮」。老師要放大就自己調
 * （ImageBlock.widthPct），那是他的決定；預設值要讓他有空間繼續編。
 */
const MAX_SHARE_OF_PAGE = 0.45;

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
export function aspectBlockSize(
  aspectRatio: number,
  ctx: SizingContext,
  /** 老師自己設過尺寸時，上限放寬到整頁——他的決定要算數。 */
  explicitSize = false
): number {
  const natural = ctx.vertical
    ? ctx.inlineSize * aspectRatio
    : ctx.inlineSize / aspectRatio;
  const cap = explicitSize ? ctx.maxBlockSize : ctx.maxBlockSize * MAX_SHARE_OF_PAGE;
  return Math.min(natural, cap);
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
    // 老師調過尺寸就照他的，沒調過就用預設上限
    const explicit = block.type === 'image' && block.widthPct != null;
    const pct = (block.type === 'image' ? block.widthPct : undefined) ?? 100;
    const wanted = (ctx.inlineSize * pct) / 100;

    const blockSize = aspectBlockSize(ratio, { ...ctx, inlineSize: wanted }, explicit);
    // 若因為超出一頁而被縮小，inline 軸要跟著縮，否則會變形
    const inlineSize = ctx.vertical ? blockSize / ratio : blockSize * ratio;
    return {
      inlineSize: Math.min(inlineSize, wanted),
      blockSize,
    };
  }

  return {
    inlineSize: ctx.inlineSize,
    blockSize: Math.min(FIXED[block.type] ?? 120, ctx.maxBlockSize),
  };
}
