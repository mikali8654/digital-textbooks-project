import styled from 'styled-components';
import { Icon } from './Icon';

type Props = {
  open: boolean;
  onOpen: () => void;
};

/**
 * 插入點的三段浮現。
 *
 *   靜止   完全不顯示，畫面乾淨
 *   滑過   淡入橘色提示（0.15s）
 *   按下   展開插入面板
 *
 * 這是「浮現的＝可以按的入口」。常駐的分隔線是換頁線，
 * 那是內容的狀態標示，兩者形態刻意不同、不可混用。
 */
export function InsertPoint({ open, onOpen }: Props) {
  return (
    <Zone $open={open}>
      <Hit type="button" onClick={onOpen} aria-label="插入元件">
        <Line />
        <Pill>
          <Icon name="plus" size={16} />
          插入
        </Pill>
        <Line />
      </Hit>
    </Zone>
  );
}

/** 感應區比看得見的提示大，滑過才不用精準對準那條線。 */
const Zone = styled.div<{ $open: boolean }>`
  position: relative;
  z-index: 5;
  block-size: 20px;
  margin-block: -10px;
  display: flex;
  align-items: center;
  writing-mode: horizontal-tb;

  opacity: ${(p) => (p.$open ? 1 : 0)};
  transition: opacity 0.15s;

  &:hover,
  &:focus-within {
    opacity: 1;
  }
`;

const Hit = styled.button`
  all: unset;
  cursor: pointer;
  inline-size: 100%;
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space.gapSm};
`;

const Line = styled.span`
  flex: 1;
  block-size: 0;
  border-block-start: ${(p) => p.theme.border.widthSelected} solid
    ${(p) => p.theme.border.accent};
`;

const Pill = styled.span`
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: ${(p) => p.theme.radius.control};
  background: ${(p) => p.theme.brand.primary};
  color: ${(p) => p.theme.text.onBrand};
  font-size: var(--ds-typography-label-size);
  line-height: var(--ds-typography-label-line-height);
`;
