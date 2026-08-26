import styled from 'styled-components';
import { Icon } from './Icon';

/**
 * 掛了補充的元件角上的記號。
 *
 * 絕對定位，而且不佔版面——這一頁的高度是分頁算過的，角標若把元件
 * 撐大一點點，量到的與畫出來的就不一致，內容會被切掉。
 * 選取外框用 outline 不用 border 也是同一個理由。
 *
 * 學生點它就是打開補充；沒掛補充的元件不會有這個記號，
 * 所以「哪些地方點得下去」在頁面上一眼看得完。
 */
export function PopupBadge({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Badge
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`補充內容 ${count} 項`}
      title={`補充內容 ${count} 項`}
    >
      <Icon name="popup" size={16} />
      {count > 1 && <Num>{count}</Num>}
    </Badge>
  );
}

const Badge = styled.button`
  position: absolute;
  /* 貼在 inline 軸的結尾側：橫排在右上、直排在左上，跟著書寫方向走 */
  inset-block-start: -10px;
  inset-inline-end: -10px;
  z-index: 3;

  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 5px 8px;
  min-inline-size: 32px;
  min-block-size: 32px;

  border: none;
  border-radius: 999px;
  background: ${(p) => p.theme.brand.primary};
  color: ${(p) => p.theme.text.onBrand};
  box-shadow: 0 2px 8px rgba(26, 25, 23, 0.24);
  cursor: pointer;
  /* 直排時整個角標要正著看，不跟著文字轉 */
  writing-mode: horizontal-tb;

  &:hover { background: ${(p) => p.theme.action.primaryBgHover}; }

  /*
   * 看起來 32、點起來 48。
   *
   * 角標必須用頁座標，才會跟著元件的角落走；但頁面是整頁縮放的，
   * 在小螢幕上縮完就成了一個點不到的小圓點。用看不見的擴張區把
   * 觸控目標撐開，視覺尺寸與版面都不受影響——學生是用手指點的。
   */
  &::after {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: inherit;
  }
`;

const Num = styled.span`
  font-size: var(--ds-typography-label-size);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
`;
