import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import shehuiMd from '../design/sample-shehui.md?raw';
import guowenMd from '../design/sample-guowen.md?raw';
import { applyImport, parseMarkdown } from './model/markdown';
import { emptyDoc } from './model/document';
import { PAGE_SIZE } from './model/pageSize';
import { usePages } from './hooks/usePages';
import { useEditor } from './hooks/useEditor';
import { PageView } from './components/PageView';
import { PageBreak } from './components/PageBreak';
import { EditorProvider } from './editor/EditorContext';
import { FloatingToolbar } from './editor/FloatingToolbar';
import { PopupPanel } from './editor/PopupPanel';
import { PopupViewerProvider } from './viewer/PopupViewer';
import { Icon } from './components/Icon';
import { PageRail } from './components/PageRail';
import { ImportDialog } from './editor/ImportDialog';
import { BookSettings } from './editor/BookSettings';
import { seedDemo } from './demo/seed';
import type { Doc, DocSettings } from './model/types';

/** 內建範例，讓人不必先準備檔案就能看見結果。 */
const SAMPLES: Record<string, string> = {
  '社會 U4-L1': shehuiMd,
  '國文 L07': guowenMd,
};

// 開啟時載入的示範內容。seedDemo 掛的補充不在 md 裡，是為了讓人一開啟
// 就看得到 Pop-up——交接後不要這一段的話，把 seedDemo 拿掉即可。
const firstDoc = (): Doc =>
  seedDemo(applyImport(emptyDoc(), parseMarkdown(shehuiMd, { autoPageBreak: true })));

export function App() {
  const [preview, setPreview] = useState(false);
  const [current, setCurrent] = useState(0);
  const [importing, setImporting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const editor = useEditor(firstDoc());
  const { doc, dispatch, undo, redo, canUndo, canRedo } = editor;
  const rowIndexOf = useCallback(
    (rowId: string) => doc.rows.findIndex((r) => r.id === rowId),
    [doc.rows]
  );
  const { pages, stats } = usePages(doc);

  const patch = (p: Partial<DocSettings>) => dispatch({ type: 'setSettings', patch: p });

  // 整頁等比縮放
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let raf = 0;
    const recompute = () => {
      const page = PAGE_SIZE[doc.settings.aspectRatio];
      // 版面還沒完成、或分頁被隱藏時量到的寬度不足以放下任何內容，
      // 算出來是負數會被夾成最小倍率，而且若沒有其他事件把它叫回來
      // 就會永遠停在錯的值。量不到就下一幀再試，不要把錯的結果寫進狀態。
      // （分頁隱藏時 requestAnimationFrame 不會觸發，所以不會空轉。）
      const usable = el.clientWidth - 96;
      if (usable <= 0) {
        raf = requestAnimationFrame(recompute);
        return;
      }
      const fitW = usable / page.width;
      // 預覽是一次一頁，高度也要塞得下
      const fitH = preview ? (el.clientHeight - 96) / page.height : Infinity;
      setScale(Math.max(0.2, Math.min(1, fitW, fitH)));
    };
    recompute();
    window.addEventListener('resize', recompute);
    // 從隱藏切回顯示時尺寸會變，但不一定有 resize 事件
    document.addEventListener('visibilitychange', recompute);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(recompute);
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', recompute);
      document.removeEventListener('visibilitychange', recompute);
      ro?.disconnect();
    };
  }, [doc.settings.aspectRatio, preview]);

  // 翻頁方向依整本設定：橫排往右翻、直排往左翻
  const vertical = doc.settings.writingMode === 'vertical';
  const go = useCallback(
    (delta: number) => setCurrent((c) => Math.max(0, Math.min(pages.length - 1, c + delta))),
    [pages.length]
  );

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setPreview(false);
      // 直排往左翻：左鍵是「下一頁」
      if (e.key === 'ArrowRight') go(vertical ? -1 : 1);
      if (e.key === 'ArrowLeft') go(vertical ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, vertical, go]);

  useEffect(() => {
    if (current > pages.length - 1) setCurrent(Math.max(0, pages.length - 1));
  }, [pages.length, current]);

  const total = stats.hits + stats.misses;
  const page = pages[Math.min(current, pages.length - 1)];

  /**
   * 「跳到某一段」的落點。
   *
   * 兩種模式的意思不同：預覽是一次一頁，要換到那一段所在的頁；
   * 編輯是連續捲動，捲到它就好。跳的目標是「某一列」不是「第幾頁」，
   * 因為頁是算出來的，內容一改頁碼就變了。
   */
  const jumpToRow = useCallback(
    (rowId: string) => {
      const index = pages.findIndex((p) => p.items.some((i) => i.row.id === rowId));
      if (index < 0) return;
      if (preview) {
        setCurrent(index);
        return;
      }
      document
        .querySelector(`[data-row-id="${CSS.escape(rowId)}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
    [pages, preview]
  );

  /** 編輯模式是連續捲動的，縮圖列點下去就是捲到那一頁。 */
  const scrollToPage = useCallback((index: number) => {
    document
      .querySelector(`[data-page-index="${index}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  return (
    <Layout>
      <Bar>
        {/* 教材名稱直接在頂部列上編，不用進設定——它是最常改的一項 */}
        <Title
          value={doc.title}
          onChange={(e) => dispatch({ type: 'setTitle', title: e.target.value })}
          placeholder="未命名教材"
          aria-label="教材名稱"
        />

        <Group>
          <Round onClick={undo} disabled={!canUndo} title="復原">
            <Icon name="undo" size={20} label="復原" />
          </Round>
          <Round onClick={redo} disabled={!canRedo} title="重做">
            <Icon name="redo" size={20} label="重做" />
          </Round>
        </Group>

        <Spacer />

        <Stats title={`量測快取命中率 ${total ? Math.round((stats.hits / total) * 100) : 0}%`}>
          {pages.length} 頁
        </Stats>

        <Group>
          <Toggle $on={importing} onClick={() => setImporting(true)}>
            <Icon name="upload" size={20} />
            匯入
          </Toggle>
          <Toggle $on={settingsOpen} onClick={() => setSettingsOpen((v) => !v)}>
            <Icon name="settings" size={20} />
            設定
          </Toggle>
        </Group>

        <Preview $on={preview} onClick={() => setPreview((p) => !p)}>
          {preview ? '離開預覽' : '預覽'}
          <Icon name="eye" size={20} />
        </Preview>
      </Bar>

      <PopupViewerProvider onJump={jumpToRow}>
      <Main>
        {/* 縮圖列在預覽時也在：老師講課時要能跳到某一頁 */}
        <PageRail
          doc={doc}
          pages={pages}
          current={preview ? current : -1}
          onGoPage={(i) => (preview ? setCurrent(i) : scrollToPage(i))}
          onGoRow={jumpToRow}
        />
      {preview ? (
        <PreviewStage ref={stageRef}>
          <Flip
            onClick={() => go(vertical ? 1 : -1)}
            disabled={vertical ? current >= pages.length - 1 : current === 0}
            title={vertical ? '下一頁' : '上一頁'}
          >
            <Icon name="chevron-left" size={24} />
          </Flip>

          {page && <PageView page={page} settings={doc.settings} scale={scale} />}

          <Flip
            onClick={() => go(vertical ? -1 : 1)}
            disabled={vertical ? current === 0 : current >= pages.length - 1}
            title={vertical ? '上一頁' : '下一頁'}
          >
            <Icon name="chevron-right" size={24} />
          </Flip>

          <Counter>
            第 {current + 1} / {pages.length} 頁 ·{' '}
            {vertical ? '直排往左翻' : '橫排往右翻'}
          </Counter>
        </PreviewStage>
      ) : (
        <EditorProvider editor={editor}>
          <Stage ref={stageRef}>
            {pages.map((p, i) => (
              <PageSlot key={p.index}>
                {i > 0 && <PageBreak startedBy={p.startedBy} />}
                <PageView
                  page={p}
                  settings={doc.settings}
                  scale={scale}
                  rowIndexOf={rowIndexOf}
                  rowCount={doc.rows.length}
                />
              </PageSlot>
            ))}
          </Stage>
          <FloatingToolbar />
          <PopupPanel />
        </EditorProvider>
      )}
      </Main>
      </PopupViewerProvider>

      {importing && (
        <ImportDialog
          samples={SAMPLES}
          onClose={() => setImporting(false)}
          onApply={(result) => {
            // 走 dispatch 而不是 replaceDoc，匯入才退得回去——
            // 老師匯錯檔案不該是不可逆的
            dispatch({ type: 'importDoc', result });
            setCurrent(0);
            setImporting(false);
          }}
        />
      )}

      {settingsOpen && (
        <BookSettings
          doc={doc}
          onPatch={patch}
          onTitle={(title) => dispatch({ type: 'setTitle', title })}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </Layout>
  );
}

const Layout = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Bar = styled.header`
  display: flex;
  align-items: center;
  flex: none;
  gap: ${(p) => p.theme.space.gapMd};
  /* 每一顆按鈕都不准被壓到換行——「匯 入」兩個字分兩行看起來像壞掉。
     要讓步的是教材名稱，它本來就會用刪節號收尾。 */
  & > *:not(:first-child) { flex: none; white-space: nowrap; }
  padding: ${(p) => p.theme.space.insetSm} ${(p) => p.theme.space.insetLg};
  background: ${(p) => p.theme.surface.raised};
  border-block-end: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
`;

const Main = styled.div`
  flex: 1;
  min-block-size: 0;
  display: flex;
`;

const Spacer = styled.span`
  flex: 1;
`;

const Title = styled.input`
  font: inherit;
  font-size: var(--ds-typography-body-lg-size);
  font-weight: 600;
  flex: 0 1 auto;
  min-inline-size: 3ch;
  max-inline-size: 320px;
  height: ${(p) => p.theme.control.heightSm};
  /* 文字不要頂到自己的邊，否則看起來像黏在旁邊的按鈕上 */
  padding: 0 ${(p) => p.theme.space.insetSm};
  text-overflow: ellipsis;
  border: ${(p) => p.theme.border.widthDefault} solid transparent;
  border-radius: ${(p) => p.theme.radius.control};
  background: transparent;
  color: ${(p) => p.theme.text.primary};

  &:hover { border-color: ${(p) => p.theme.border.subtle}; }
  &:focus { border-color: ${(p) => p.theme.tool.border}; outline: none; }
`;

const Group = styled.div`
  display: flex;
  gap: ${(p) => p.theme.space.gapXs};
  align-items: center;
  flex: none;
`;

const Toggle = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: ${(p) => p.theme.control.heightSm};
  padding: 0 ${(p) => p.theme.space.insetSm};
  border-radius: ${(p) => p.theme.radius.control};
  cursor: pointer;
  font-family: inherit;
  font-size: var(--ds-typography-body-sm-size);
  border: ${(p) => p.theme.border.widthDefault} solid
    ${(p) => (p.$on ? p.theme.tool.border : p.theme.border.subtle)};
  background: ${(p) => (p.$on ? p.theme.tool.surface : p.theme.surface.raised)};
  color: ${(p) => (p.$on ? p.theme.tool.accent : p.theme.text.secondary)};

  &:hover:not(:disabled) {
    border-color: ${(p) => p.theme.tool.border};
    background: ${(p) => p.theme.tool.surfaceSubtle};
  }
`;

const Round = styled.button`
  width: ${(p) => p.theme.control.heightSm};
  height: ${(p) => p.theme.control.heightSm};
  display: grid;
  place-items: center;
  border-radius: ${(p) => p.theme.radius.control};
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.icon.default};
  cursor: pointer;

  &:disabled {
    color: ${(p) => p.theme.icon.disabled};
    border-color: ${(p) => p.theme.action.disabledBorder};
    cursor: default;
  }
  &:hover:not(:disabled) {
    border-color: ${(p) => p.theme.tool.border};
    background: ${(p) => p.theme.tool.surfaceSubtle};
  }
`;

const Preview = styled.button<{ $on: boolean }>`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space.gapXs};
  height: ${(p) => p.theme.control.heightSm};
  padding: 0 ${(p) => p.theme.space.insetSm};
  border-radius: ${(p) => p.theme.radius.control};
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: var(--ds-typography-body-sm-size);
  background: ${(p) => (p.$on ? p.theme.tool.accent : p.theme.action.primaryBg)};
  color: ${(p) => p.theme.action.primaryText};
`;

const Stats = styled.div`
  margin-inline-start: auto;
  font-size: var(--ds-typography-body-sm-size);
  color: ${(p) => p.theme.text.tertiary};
  font-variant-numeric: tabular-nums;
`;

const Stage = styled.main`
  flex: 1;
  overflow: auto;
  padding: ${(p) => p.theme.space.insetXl};
  background: ${(p) => p.theme.surface.muted};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
`;

const PageSlot = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  width: 100%;
`;

const PreviewStage = styled.main`
  flex: 1;
  overflow: hidden;
  padding: ${(p) => p.theme.space.insetXl};
  background: ${(p) => p.theme.surface.inverse};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${(p) => p.theme.space.insetLg};
  position: relative;
`;

const Flip = styled.button`
  flex: none;
  width: ${(p) => p.theme.control.heightMd};
  height: ${(p) => p.theme.control.heightMd};
  display: grid;
  place-items: center;
  border-radius: ${(p) => p.theme.radius.control};
  border: none;
  background: ${(p) => p.theme.action.inverseBg};
  color: ${(p) => p.theme.icon.default};
  cursor: pointer;

  &:disabled {
    opacity: 0.25;
    cursor: default;
  }
`;

const Counter = styled.div`
  position: absolute;
  inset-block-end: 16px;
  color: ${(p) => p.theme.text.onInverse};
  font-size: var(--ds-typography-body-sm-size);
  font-variant-numeric: tabular-nums;
`;
