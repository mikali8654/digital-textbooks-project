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
  web: 112,
  dialogue: 88,
  reference: 40,
  module: 200,
  question: 220,
};

/**
 * 表格的一格有多大。
 *
 * 表格不能用固定高度：社會第一張表有 11 列，用固定的 180 會量少一半，
 * 畫出來就撐破頁面。列數是資料的一部分，所以尺寸要從列數算。
 *
 * ⚠️ 前提是每一格只有一行。儲存格過長會被截斷，不會換行——要支援換行
 * 就得讓量測器真的去量表格，見 HANDOVER 的已知限制。
 */
export const TABLE_ROW = 36;
export const TABLE_COL = 160;
export const TABLE_PAD = 16;

/**
 * 一頁裝得下這張表的前幾列。
 *
 * 表格切不開（一半的表格在另一頁上沒有表頭，看不懂），所以比一頁還高的
 * 表格只能截斷。但**截斷必須說出來**——資料表格靜靜少了幾列，老師不會
 * 發現，學生看到的就是一份缺資料的課本。
 *
 * 回傳 null 代表整張都放得下。
 */
export function tableOverflow(
  block: { rows: number },
  ctx: SizingContext
): { shown: number; hidden: number } | null {
  const room = ctx.vertical ? ctx.inlineSize : ctx.maxBlockSize;
  const fits = Math.floor((room - TABLE_PAD * 2) / TABLE_ROW);
  if (block.rows <= fits) return null;
  // 留一列的位置放提示，否則提示自己又會被切掉
  const shown = Math.max(1, fits - 1);
  return { shown, hidden: block.rows - shown };
}

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

  if (block.type === 'table') {
    const across = block.rows * TABLE_ROW + TABLE_PAD * 2;
    const along = block.cols * TABLE_COL + TABLE_PAD * 2;
    // 表格永遠是橫著的格線，所以直排時它佔的是一條垂直的帶子：
    // block 軸（水平）由欄數決定，inline 軸（垂直）由列數決定。
    return ctx.vertical
      ? { inlineSize: Math.min(across, ctx.inlineSize), blockSize: Math.min(along, ctx.maxBlockSize) }
      : { inlineSize: ctx.inlineSize, blockSize: Math.min(across, ctx.maxBlockSize) };
  }

  return {
    inlineSize: ctx.inlineSize,
    blockSize: Math.min(FIXED[block.type] ?? 120, ctx.maxBlockSize),
  };
}
