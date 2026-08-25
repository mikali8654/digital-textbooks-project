import { useState } from 'react';
import styled from 'styled-components';
import { Icon } from '../Icon';
import { pickFile, putImage, urlOf } from '../../editor/assets';
import type { BlockPatch } from '../../model/actions';
import type { ImageBlock } from '../../model/types';

type Props = {
  block: ImageBlock;
  /** 媒體框的實際尺寸，跟量測用的是同一個函式算出來的。 */
  boxStyle?: React.CSSProperties;
  /** 唯讀（預覽、檢視台）時不傳。 */
  onPatch?: (patch: BlockPatch) => void;
  onSelect?: () => void;
};

/**
 * 圖片。
 *
 * 上傳時一定要把真實的 naturalWidth / naturalHeight 寫回 aspectRatio——
 * md 匯入只有檔名，比例是估的，分頁算出來的高度就會跟畫面差一截。
 * 這裡是整個系統唯一拿得到真實尺寸的地方。
 */
export function ImageBlockView({ block, boxStyle, onPatch, onSelect }: Props) {
  const [busy, setBusy] = useState(false);
  const src = urlOf(block.assetId);

  const upload = async () => {
    if (!onPatch || busy) return;
    const file = await pickFile('image/*');
    if (!file) return;
    setBusy(true);
    try {
      const { assetId, aspectRatio } = await putImage(file);
      // 比例跟著圖一起寫回去，兩個欄位必須同時更新，
      // 否則會出現「新的圖、舊的比例」那一幀
      onPatch({ assetId, aspectRatio, alt: block.alt || file.name });
    } finally {
      setBusy(false);
    }
  };

  return (
    <figure style={{ margin: 0 }} onPointerDown={onSelect}>
      {src ? (
        <Media style={boxStyle} src={src} alt={block.alt} />
      ) : (
        <Empty style={boxStyle} onClick={upload} $clickable={!!onPatch}>
          <Icon name={busy ? 'loader' : 'image'} size={24} />
          <span>{busy ? '讀取中…' : onPatch ? '點一下上傳圖片' : block.alt || '圖片'}</span>
          {block.alt && !busy && <Alt>{block.alt}</Alt>}
        </Empty>
      )}

      {/* 圖說要照抄課本的圖號，所以是內容不是自動編號 */}
      {(block.caption || onPatch) && (
        <Caption
          contentEditable={!!onPatch}
          suppressContentEditableWarning
          data-placeholder="圖說（含課本圖號）"
          onBlur={(e) => onPatch?.({ caption: e.currentTarget.textContent ?? '' })}
        >
          {block.caption}
        </Caption>
      )}
    </figure>
  );
}

const Media = styled.img`
  display: block;
  object-fit: contain;
  border-radius: ${(p) => p.theme.radius.field};
  background: ${(p) => p.theme.surface.media};
`;

const Empty = styled.div<{ $clickable: boolean }>`
  background: ${(p) => p.theme.surface.media};
  border: ${(p) => p.theme.border.widthDefault} dashed ${(p) => p.theme.border.subtle};
  border-radius: ${(p) => p.theme.radius.field};
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  padding: 8px;
  text-align: center;
  color: ${(p) => p.theme.text.secondary};
  font-size: var(--ds-typography-caption-size);
  cursor: ${(p) => (p.$clickable ? 'pointer' : 'default')};
`;

const Alt = styled.span`
  color: ${(p) => p.theme.text.tertiary};
`;

const Caption = styled.figcaption`
  margin-block-start: 12px;
  font-size: var(--ds-typography-caption-size);
  line-height: var(--ds-typography-caption-line-height);
  color: ${(p) => p.theme.text.secondary};
  outline: none;

  &:empty::before {
    content: attr(data-placeholder);
    color: ${(p) => p.theme.text.tertiary};
  }
`;
