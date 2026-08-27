import { useEffect, useMemo, useRef, useState } from 'react';
import { createDomMeasurer } from '../measure/domMeasurer';
import { withCache, type CachedMeasurer } from '../measure/cachedMeasurer';
import { paginate, pageOptionsFor, type Page } from '../model/paginate';
import { COLUMN_GAP, contentBox } from '../model/pageSize';
import type { Doc } from '../model/types';

/**
 * 把文件切成頁。
 *
 * 量測器與快取跟著「設定」走：換書寫方向或字級檔位會讓所有量測失效，
 * 其餘情況（打字、插入、拖曳）都靠快取，只重量真正改變的區塊。
 */
export function usePages(doc: Doc): { pages: Page[]; stats: CachedMeasurer['stats'] } {
  const { writingMode, textScale, aspectRatio } = doc.settings;

  // 字型載入前量到的寬度是錯的，載入後要重算一次
  const [fontsReady, setFontsReady] = useState(() => !document.fonts || document.fonts.status === 'loaded');
  useEffect(() => {
    if (fontsReady || !document.fonts) return;
    let alive = true;
    document.fonts.ready.then(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, [fontsReady]);

  const measurer = useMemo(() => {
    const dom = createDomMeasurer({ settings: { writingMode, textScale } });
    return { cached: withCache(dom), dispose: dom.dispose };
    // fontsReady 進相依：字型換了要重建，舊的量測值不能留
  }, [writingMode, textScale, fontsReady]);

  /**
   * 換掉的量測器要收掉，正在用的不能收。
   *
   * 原本的清理函式寫成 `return () => measurer.dispose()`，看起來是在
   * 卸載時收尾，但 effect 每次重跑都會先執行清理——StrictMode 的
   * mount → cleanup → mount 就把當下正在用的那一個拔掉了。
   * 量測器本身現在會自己重新掛回文件，這裡只負責換掉時清舊的。
   */
  const prev = useRef(measurer);
  useEffect(() => {
    if (prev.current !== measurer) {
      prev.current.dispose();
      prev.current = measurer;
    }
  }, [measurer]);

  const pages = useMemo(() => {
    const box = contentBox({ aspectRatio });
    const opts = pageOptionsFor({ writingMode }, box, COLUMN_GAP);
    return paginate(doc.rows, opts, measurer.cached);
  }, [doc.rows, aspectRatio, writingMode, measurer]);

  return { pages, stats: measurer.cached.stats };
}
