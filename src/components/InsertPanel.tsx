import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { Icon } from './Icon';
import { blockRegistry } from '../model/registry';
import type { IconName } from '../assets/icons.generated';
import type { BlockType } from '../model/types';

/** 九宮格的順序與圖示。媒體庫不是元件，是挑素材的入口。 */
const TILES: { key: BlockType | 'library'; icon: IconName }[] = [
  { key: 'text', icon: 'type' },
  { key: 'image', icon: 'image' },
  { key: 'video', icon: 'video' },
  { key: 'audio', icon: 'music' },
  { key: 'shape', icon: 'shapes' },
  { key: 'web', icon: 'globe' },
  { key: 'table', icon: 'table' },
  { key: 'module', icon: 'puzzle' },
  { key: 'library', icon: 'library' },
];

const LABEL = (k: BlockType | 'library') =>
  k === 'library' ? '媒體庫' : blockRegistry[k].label;

type Props = {
  onPick: (key: BlockType | 'library') => void;
  onClose: () => void;
  /** 插入點在畫面上的位置。面板貼著它出現。 */
  anchorRef: RefObject<HTMLElement | null>;
  /** 教材是不是直排。決定面板往哪一邊展開。 */
  vertical: boolean;
};

/** 面板寬度。高度不寫死——內容改了就會不準，要當場量。 */
const PANEL_INLINE = 340;
const EDGE = 12;

/**
 * 面板要出現在哪裡。
 *
 * 用視窗座標而不是頁面座標，原因有兩個：
 *
 * 一、頁面是 overflow: hidden 的固定畫布，面板留在裡面會被裁掉——
 *     直排時被右緣裁（因為版面由右往左流），橫排時點最下面那一列會被下緣裁。
 * 二、頁面是整頁等比縮放的，面板留在裡面會跟著縮，字變小、觸控目標變小。
 *
 * 展開方向跟著書寫方向走：橫排往下、直排往左（因為直排的下一段在左邊）。
 * 一律用實體屬性判斷，不用 inset-inline 那類邏輯屬性——這個元件為了讓
 * 選單文字正著看而設了 horizontal-tb，邏輯屬性算的會是它自己的方向，
 * 直排時就會被推到頁面外。
 */
function place(anchor: DOMRect, panel: DOMRect, vertical: boolean): React.CSSProperties {
  // 頂部的界線取工具列的下緣，不是視窗頂端——面板蓋住工具列的話，
  // 面板開著的時候就按不到預覽與設定
  const top0 = (document.querySelector('header')?.getBoundingClientRect().bottom ?? 0) + EDGE;
  const clampX = (v: number, half: number) =>
    Math.min(Math.max(v, half + EDGE), window.innerWidth - half - EDGE);
  const clampY = (v: number, half: number) =>
    Math.min(Math.max(v, half + top0), window.innerHeight - half - EDGE);

  if (vertical) {
    const top = clampY(anchor.top + anchor.height / 2, panel.height / 2);
    // 左邊塞不下就翻到右邊
    const openLeft = anchor.left > panel.width + EDGE * 2;
    return {
      top,
      left: openLeft ? anchor.left - EDGE : anchor.right + EDGE,
      transform: openLeft ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
    };
  }

  const left = clampX(anchor.left + anchor.width / 2, panel.width / 2);
  // 下面塞不下就翻到上面；翻上去還是會蓋到工具列的話，就維持往下並貼齊下緣
  const openDown = anchor.bottom + panel.height + EDGE < window.innerHeight;
  if (openDown) return { left, top: anchor.bottom + EDGE, transform: 'translate(-50%, 0)' };
  const up = anchor.top - EDGE - panel.height;
  return up >= top0
    ? { left, top: anchor.top - EDGE, transform: 'translate(-50%, -100%)' }
    : { left, top: window.innerHeight - EDGE, transform: 'translate(-50%, -100%)' };
}

/**
 * 插入面板：九格一次呈現，無搜尋、無捲動。
 *
 * 這是「面板」那一類——只做「加新東西」。它以浮層覆蓋在內容之上，
 * 不推動下方內容，否則按下插入點時整頁會跳動。
 */
export function InsertPanel({ onPick, onClose, anchorRef, vertical }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  // 先畫在看不見的地方，量到真實高度再擺位。高度會隨內容變，寫死遲早不準
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden', top: 0, left: 0 });

  useLayoutEffect(() => {
    const read = () => {
      const a = anchorRef.current;
      const p = panelRef.current;
      if (a && p) setStyle(place(a.getBoundingClientRect(), p.getBoundingClientRect(), vertical));
    };
    read();
    window.addEventListener('scroll', read, true);
    window.addEventListener('resize', read);
    return () => {
      window.removeEventListener('scroll', read, true);
      window.removeEventListener('resize', read);
    };
  }, [anchorRef, vertical]);

  return createPortal(
    <Panel
      ref={panelRef}
      role="dialog"
      aria-label="插入元件"
      style={style}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <Head>插入</Head>
      <Grid>
        {TILES.map((t) => (
          <Tile key={t.key} onClick={() => onPick(t.key)} type="button">
            <IconBox>
              <Icon name={t.icon} size={24} />
            </IconBox>
            <span>{LABEL(t.key)}</span>
          </Tile>
        ))}
      </Grid>

      {/*
        AI 生成的位置先留著，但是**明白標成還沒接**，不做成看起來能按
        的樣子。做成能按的假按鈕，老師在課堂上按下去才發現沒反應，
        比沒有這個入口還糟。

        接上去要動的只有這一顆的 onClick：呼叫哪一家的 API、模型與帳單
        都在客戶那邊（交接時已確認不在這次的範圍）。
      */}
      <Slot aria-disabled="true">
        <IconBox>
          <Icon name="asterisk" size={24} />
        </IconBox>
        <SlotText>
          <strong>AI 生成</strong>
          <small>預留位置。接上客戶自己的 API 之後才會啟用。</small>
        </SlotText>
      </Slot>
    </Panel>,
    document.body
  );
}

const Panel = styled.div`
  position: fixed;
  z-index: 900;
  inline-size: ${PANEL_INLINE}px;
  background: ${(p) => p.theme.surface.raised};
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  border-radius: ${(p) => p.theme.radius.panel};
  box-shadow: 0 12px 32px rgba(26, 25, 23, 0.12);
  padding: ${(p) => p.theme.space.insetMd};
  writing-mode: horizontal-tb;
`;

const Head = styled.div`
  font-size: var(--ds-typography-label-size);
  font-weight: var(--ds-typography-label-weight);
  letter-spacing: 0.12em;
  color: ${(p) => p.theme.text.tertiary};
  padding-block-end: ${(p) => p.theme.space.gapSm};
  margin-block-end: ${(p) => p.theme.space.gapSm};
  border-block-end: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${(p) => p.theme.space.gapSm};
`;

const Tile = styled.button`
  width: 84px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${(p) => p.theme.space.gapXs};
  padding: ${(p) => p.theme.space.gapSm};
  border-radius: ${(p) => p.theme.radius.tile};
  border: ${(p) => p.theme.border.widthDefault} solid transparent;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  color: ${(p) => p.theme.icon.secondary};
  transition: background 0.12s, border-color 0.12s;

  span {
    font-size: var(--ds-typography-body-sm-size);
    color: ${(p) => p.theme.text.secondary};
  }

  /* hover 用最淺的一階，選中才用深的——選中必須比 hover 明顯 */
  &:hover {
    border-color: ${(p) => p.theme.tool.border};
    background: ${(p) => p.theme.tool.surfaceSubtle};
  }
  &:active {
    border-width: ${(p) => p.theme.border.widthSelected};
    background: ${(p) => p.theme.tool.surface};
  }
`;

const IconBox = styled.span`
  display: grid;
  place-items: center;
  border-radius: ${(p) => p.theme.radius.field};
`;

/** 預留位置：看得出來在那裡，但看得出來還不能按。 */
const Slot = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-block-start: ${(p) => p.theme.space.gapSm};
  padding: 10px 12px;
  border-block-start: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  color: ${(p) => p.theme.text.disabled};
  cursor: default;
`;

const SlotText = styled.span`
  display: flex;
  flex-direction: column;
  line-height: 1.4;

  strong { font-size: var(--ds-typography-body-sm-size); font-weight: 600; }
  small { font-size: var(--ds-typography-label-size); }
`;
