import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { Icon } from '../components/Icon';
import { useEditorCtx } from './EditorContext';
import { findBlock } from '../model/document';
import { sliceSpans } from '../model/spans';
import { ROLE_LABEL, canHavePopup } from '../model/registry';
import type { TextRole } from '../model/types';

/**
 * 浮動膠囊。
 *
 * 兩種狀態，永遠只出現一個：
 *   選了字   → 行內標記（粗體、重點詞）
 *   選了元件 → 這個元件能改的事（文字角色、圖片尺寸、換頁、刪除）
 *
 * 用 portal 掛到 body：頁面本身是被 transform: scale() 縮放過的，
 * 膠囊留在裡面會跟著縮，字會變小、觸控目標會不夠大。
 */
export function FloatingToolbar() {
  const ed = useEditorCtx();
  const inline = ed?.inlineSelection ?? null;
  const blockId = ed?.selectedBlockId ?? null;

  if (!ed) return null;
  if (inline) return <InlineCapsule key="inline" />;
  if (blockId) return <BlockCapsule key={blockId} />;
  return null;
}

/** 行內標記。位置跟著選取範圍，選取一動就要重算。 */
function InlineCapsule() {
  const ed = useEditorCtx()!;
  const sel = ed.inlineSelection!;
  const rect = useSelectionRect();

  const hit = findBlock(ed.doc, sel.blockId);
  if (!hit || hit.block.type !== 'text' || !rect) return null;

  const offset = sel.slice?.start ?? 0;
  const picked = sliceSpans(
    hit.block.spans,
    sel.range.start + offset,
    sel.range.end + offset
  );
  // 「整段都已經是」才算開著——半段是的時候按下去應該是全部套上
  const all = (f: 'bold' | 'keyword') => picked.length > 0 && picked.every((s) => s[f]);

  const toggle = (mark: 'bold' | 'keyword') =>
    ed.toggleMark(sel.blockId, sel.range, mark, !all(mark), sel.slice);

  return (
    <Capsule style={anchor(rect)} onPointerDown={(e) => e.preventDefault()}>
      <Btn $on={all('bold')} onClick={() => toggle('bold')} title="粗體">
        <Icon name="bold" size={20} label="粗體" />
      </Btn>
      <Btn $on={all('keyword')} onClick={() => toggle('keyword')} title="重點詞">
        <Icon name="type" size={20} label="重點詞" />
        重點詞
      </Btn>
      <Hint>重點詞會進生字表與全書搜尋，不只是底線</Hint>
    </Capsule>
  );
}

const IMAGE_WIDTHS: { label: string; pct: number }[] = [
  { label: '小', pct: 35 },
  { label: '中', pct: 50 },
  { label: '大', pct: 70 },
  { label: '滿版', pct: 100 },
];

/** 元件能改的事。位置跟著元件的外框。 */
function BlockCapsule() {
  const ed = useEditorCtx()!;
  const id = ed.selectedBlockId!;
  const rect = useAnchorRect(`[data-block-id="${CSS.escape(id)}"]`, ed.doc);

  const hit = findBlock(ed.doc, id);
  if (!hit || !rect) return null;
  const { block, row } = hit;

  return (
    <Capsule style={anchor(rect)} onPointerDown={(e) => e.preventDefault()}>
      {block.type === 'text' && (
        <Select
          value={block.role}
          aria-label="內容角色"
          onChange={(e) =>
            ed.dispatch({ type: 'setTextRole', blockId: id, role: e.target.value as TextRole })
          }
        >
          {(Object.keys(ROLE_LABEL) as TextRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      )}

      {block.type === 'image' && (
        <Group>
          {/*
            還沒選過尺寸時多一格「預設」並且亮著，選過之後它就消失。

            這一格存在是因為 widthPct 沒設定不等於滿版：沒設定時系統會把
            圖縮到不超過頁面的 45%，否則 4:3 的頁面插一張 3:2 的圖就用掉
            整頁，老師沒辦法圖文混排。以前這裡用 `widthPct ?? 100` 判斷，
            於是剛插入的圖片會亮著「滿版」但畫出來是縮過的——介面在說謊。
          */}
          {block.widthPct == null && (
            <Btn $on title="還沒選尺寸。系統會縮到不佔滿一頁，選一個就以你的為準">
              預設
            </Btn>
          )}
          {IMAGE_WIDTHS.map((w) => (
            <Btn
              key={w.pct}
              $on={block.widthPct === w.pct}
              onClick={() =>
                ed.dispatch({
                  type: 'patchBlock',
                  blockId: id,
                  blockType: 'image',
                  patch: { widthPct: w.pct },
                })
              }
              title={`圖片寬度 ${w.pct}%`}
            >
              {w.label}
            </Btn>
          ))}
        </Group>
      )}

      {/* Pop-up 是元件的屬性不是另一種元件，所以入口在元件的膠囊上，
          不在插入選單裡。影片／聲音／網頁本身就有互動，不能再掛 */}
      {canHavePopup(block.type) && (
        <Btn
          $on={block.popups.length > 0}
          onClick={() => ed.openPopupPanel(id)}
          title="掛補充內容"
        >
          <Icon name="popup" size={20} label="補充" />
          {block.popups.length > 0 ? `補充 ${block.popups.length}` : '補充'}
        </Btn>
      )}

      <Divider />

      {/* 手動換頁線的位置固定，不隨內容移動——這是老師的決定 */}
      <Btn
        $on={row.breakBefore}
        onClick={() =>
          ed.dispatch({ type: 'setBreakBefore', rowId: row.id, value: !row.breakBefore })
        }
        title="在這一列之前換頁"
      >
        <Icon name="page-break" size={20} label="換頁" />
      </Btn>

      <Btn
        onClick={() => {
          ed.dispatch({ type: 'deleteRow', rowId: row.id });
          ed.select(null);
        }}
        title="刪除這一列"
      >
        <Icon name="trash" size={20} label="刪除" />
      </Btn>
    </Capsule>
  );
}

/** 選取範圍的位置。選取變動與捲動都要重算。 */
function useSelectionRect(): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const read = () => {
      const s = document.getSelection();
      if (!s || s.rangeCount === 0 || s.isCollapsed) return;
      setRect(s.getRangeAt(0).getBoundingClientRect());
    };
    read();
    document.addEventListener('selectionchange', read);
    window.addEventListener('scroll', read, true);
    window.addEventListener('resize', read);
    return () => {
      document.removeEventListener('selectionchange', read);
      window.removeEventListener('scroll', read, true);
      window.removeEventListener('resize', read);
    };
  }, []);

  return rect;
}

/**
 * 某個元素的位置。
 *
 * doc 進相依是因為改了設定或內容之後版面會重排，元件位置跟著變，
 * 膠囊若不重量就會停在舊的地方。
 */
function useAnchorRect(selector: string, dep: unknown): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const raf = useRef(0);

  useLayoutEffect(() => {
    const read = () => {
      const el = document.querySelector(selector);
      // 重排還沒完成時量到的是舊位置，下一幀再量一次
      if (el) setRect(el.getBoundingClientRect());
    };
    read();
    raf.current = requestAnimationFrame(read);
    window.addEventListener('scroll', read, true);
    window.addEventListener('resize', read);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('scroll', read, true);
      window.removeEventListener('resize', read);
    };
  }, [selector, dep]);

  return rect;
}

/** 貼在目標上方置中，並且夾在視窗裡——貼齊頁緣的元件不能把膠囊推出畫面。 */
function anchor(rect: DOMRect): React.CSSProperties {
  const GAP = 12;
  const HALF = 160;
  const left = Math.min(
    Math.max(rect.left + rect.width / 2, HALF + 8),
    window.innerWidth - HALF - 8
  );
  // 上面塞不下就翻到下面
  const above = rect.top > 72;
  return {
    left,
    top: above ? rect.top - GAP : rect.bottom + GAP,
    transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
  };
}

/** 膠囊本體。掛在 body，所以不受頁面縮放影響。 */
function Capsule({ children, ...rest }: React.ComponentProps<typeof Shell>) {
  const [host] = useState(() => document.body);
  return createPortal(<Shell {...rest}>{children}</Shell>, host);
}

const Shell = styled.div`
  position: fixed;
  z-index: 900;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-radius: 999px;
  background: ${(p) => p.theme.surface.raised};
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  box-shadow: 0 12px 32px rgba(26, 25, 23, 0.18);
  font-size: var(--ds-typography-label-size);
`;

const Group = styled.div`
  display: flex;
  gap: 2px;
`;

const Btn = styled.button<{ $on?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  cursor: pointer;
  border-radius: 999px;
  padding: 6px 12px;
  min-block-size: 36px;
  font: inherit;
  background: ${(p) => (p.$on ? p.theme.brand.primaryTint : 'transparent')};
  color: ${(p) => (p.$on ? p.theme.text.accent : p.theme.text.secondary)};

  &:hover {
    background: ${(p) => (p.$on ? p.theme.brand.primaryTint : p.theme.surface.sunken)};
  }
`;

const Select = styled.select`
  border: none;
  background: transparent;
  color: ${(p) => p.theme.text.primary};
  font: inherit;
  padding: 6px 8px;
  min-block-size: 36px;
  border-radius: 999px;
  cursor: pointer;
`;

const Divider = styled.span`
  inline-size: 1px;
  block-size: 20px;
  background: ${(p) => p.theme.border.subtle};
`;

const Hint = styled.span`
  color: ${(p) => p.theme.text.tertiary};
  padding-inline-end: 8px;
  white-space: nowrap;
`;
