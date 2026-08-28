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
};

/**
 * 插入面板：九格一次呈現，無搜尋、無捲動。
 *
 * 這是「面板」那一類——只做「加新東西」。它以浮層覆蓋在內容之上，
 * 不推動下方內容，否則按下插入點時整頁會跳動。
 */
export function InsertPanel({ onPick, onClose }: Props) {
  return (
    <Panel
      role="dialog"
      aria-label="插入元件"
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
    </Panel>
  );
}

const Panel = styled.div`
  position: absolute;
  z-index: 20;
  inset-inline-start: 50%;
  transform: translateX(-50%);
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
    border-color: ${(p) => p.theme.border.accent};
    background: ${(p) => p.theme.brand.primaryTintSubtle};
  }
  &:active {
    border-width: ${(p) => p.theme.border.widthSelected};
    background: ${(p) => p.theme.brand.primaryTint};
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
