import styled, { css } from 'styled-components';
import { Icon } from './Icon';

type Props = {
  open: boolean;
  onOpen: () => void;
  /** 教材是不是直排。決定這條線要橫著還是豎著。 */
  vertical: boolean;
  /** 貼在列的開頭還是結尾。結尾的只有全文最後一列才有。 */
  where?: 'start' | 'end';
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
export function InsertPoint({ open, onOpen, vertical, where = 'start' }: Props) {
  return (
    <Zone $open={open} $vertical={vertical} $where={where}>
      <Hit type="button" onClick={onOpen} aria-label="插入元件" $vertical={vertical}>
        <Line $vertical={vertical} />
        <Pill>
          <Icon name="plus" size={16} />
          插入
        </Pill>
        <Line $vertical={vertical} />
      </Hit>
    </Zone>
  );
}

/**
 * 感應區比看得見的提示大，滑過才不用精準對準那條線。
 *
 * **絕對定位，完全不佔版面。** 一頁裝得下多少是分頁算過的，插入點若
 * 佔到空間，量到的與畫出來的就不一致，內容會被擠出頁面。
 *
 * 曾經用 `block-size: 20px; margin-block: -10px` 把自己抵銷掉，橫排看
 * 起來沒事；但這個元件同時把自己設成 horizontal-tb，那組邏輯屬性算的是
 * 它自己的水平方向，直排時父層要的是它的「寬度」，而寬度沒有被抵銷——
 * 每個插入點多吃掉約 100px，一頁五列就把內容推出頁面。所以這裡一律用
 * 實體屬性，並且由外面告訴它現在是直排還是橫排。
 */
const Zone = styled.div<{ $open: boolean; $vertical: boolean; $where: 'start' | 'end' }>`
  position: absolute;
  z-index: 5;
  display: flex;
  align-items: center;
  /* 提示本身永遠正著看，不跟著課文轉 */
  writing-mode: horizontal-tb;

  ${(p) =>
    p.$vertical
      ? css`
          top: 0;
          bottom: 0;
          width: 20px;
          /* 直排由右往左流：列的開頭在右邊 */
          ${p.$where === 'start' ? 'right: -10px;' : 'left: -10px;'}
        `
      : css`
          left: 0;
          right: 0;
          height: 20px;
          ${p.$where === 'start' ? 'top: -10px;' : 'bottom: -10px;'}
        `}

  opacity: ${(p) => (p.$open ? 1 : 0)};
  transition: opacity 0.15s;

  &:hover,
  &:focus-within {
    opacity: 1;
  }
`;

const Hit = styled.button<{ $vertical: boolean }>`
  all: unset;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space.gapSm};
  inline-size: 100%;
  block-size: 100%;
  flex-direction: ${(p) => (p.$vertical ? 'column' : 'row')};
`;

const Line = styled.span<{ $vertical: boolean }>`
  flex: 1;
  ${(p) =>
    p.$vertical
      ? css`
          width: 0;
          border-left: ${p.theme.border.widthSelected} solid ${p.theme.border.accent};
        `
      : css`
          height: 0;
          border-top: ${p.theme.border.widthSelected} solid ${p.theme.border.accent};
        `}
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
