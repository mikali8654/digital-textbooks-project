import styled from 'styled-components';
import { Icon } from '../Icon';
import { pickFile, putFile, urlOf, youtubeId } from '../../editor/assets';
import type { BlockPatch } from '../../model/actions';
import type { VideoBlock } from '../../model/types';

type Props = {
  block: VideoBlock;
  boxStyle?: React.CSSProperties;
  onPatch?: (patch: BlockPatch) => void;
  onSelect?: () => void;
};

/**
 * 影片。
 *
 * 編輯時只放縮圖與標題，不掛 iframe——一頁上有五支影片就是五個外部
 * 播放器同時載入，編輯會整個卡住，而且分頁量測會被 iframe 的非同步
 * 版面改變攪亂。真正的播放在檢視台，那時候一次只有一支。
 *
 * YouTube 的縮圖是靜態圖片，沒有這個問題。
 */
export function VideoBlockView({ block, boxStyle, onPatch, onSelect }: Props) {
  const id = block.source === 'youtube' ? youtubeId(block.ref) : null;
  const poster = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  const uploaded = block.source === 'upload' && !!urlOf(block.ref);
  const ready = !!poster || uploaded;

  return (
    <figure style={{ margin: 0 }} onPointerDown={onSelect}>
      <Frame style={boxStyle} $poster={poster}>
        {ready ? (
          <Play>
            <Icon name="play" size={24} />
          </Play>
        ) : (
          onPatch && <Source block={block} onPatch={onPatch} />
        )}
        {!ready && !onPatch && <Missing>還沒設定影片來源</Missing>}
      </Frame>
      {block.title && <Title>{block.title}</Title>}
      {/* 字幕是無障礙需求，沒有就要看得出來缺 */}
      {!block.captionsRef && <NoCaptions>未附字幕</NoCaptions>}
    </figure>
  );
}

/**
 * 還沒設定來源時的兩條路。
 *
 * 上傳走的是 session 內的暫存（assets.ts），重新整理就沒了——
 * 真正的上傳與 CDN 是客戶的 API。但「貼一個 YouTube 網址」不需要
 * 任何後端，所以這裡就要能做完，否則插進來的影片是一條死路。
 */
function Source({
  block,
  onPatch,
}: {
  block: VideoBlock;
  onPatch: (patch: BlockPatch) => void;
}) {
  return (
    <Pick onPointerDown={(e) => e.stopPropagation()}>
      <Url
        defaultValue={block.source === 'youtube' ? block.ref : ''}
        placeholder="貼上 YouTube 網址"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v) onPatch({ source: 'youtube', ref: v });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      <Or>或</Or>
      <Upload
        onClick={async () => {
          const file = await pickFile('video/*');
          if (!file) return;
          onPatch({ source: 'upload', ref: putFile(file), title: block.title || file.name });
        }}
      >
        <Icon name="upload" size={16} />
        上傳影片檔
      </Upload>
    </Pick>
  );
}

const Frame = styled.div<{ $poster: string | null }>`
  position: relative;
  display: grid;
  place-items: center;
  border-radius: ${(p) => p.theme.radius.field};
  background: ${(p) => p.theme.surface.media}
    ${(p) => (p.$poster ? `center / cover url(${p.$poster})` : '')};
  overflow: hidden;
`;

const Play = styled.span`
  display: grid;
  place-items: center;
  inline-size: 56px;
  block-size: 56px;
  border-radius: 999px;
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.accent};
  box-shadow: 0 6px 18px rgba(26, 25, 23, 0.28);
`;

const Missing = styled.span`
  position: absolute;
  inset-block-end: 8px;
  font-size: var(--ds-typography-caption-size);
  color: ${(p) => p.theme.text.secondary};
`;

const Title = styled.figcaption`
  margin-block-start: 12px;
  font-size: var(--ds-typography-caption-size);
  line-height: var(--ds-typography-caption-line-height);
  color: ${(p) => p.theme.text.secondary};
`;

const NoCaptions = styled.span`
  display: inline-block;
  margin-block-start: 4px;
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
`;

const Pick = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px;
  inline-size: 100%;
  /* 直排時這一組控制項要正著看 */
  writing-mode: horizontal-tb;
`;

const Url = styled.input`
  font: inherit;
  font-size: var(--ds-typography-label-size);
  inline-size: min(260px, 100%);
  min-block-size: 40px;
  padding: 0 12px;
  text-align: center;
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.default};
  border-radius: ${(p) => p.theme.radius.field};
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
`;

const Or = styled.span`
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
`;

const Upload = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: var(--ds-typography-label-size);
  min-block-size: 40px;
  padding: 0 14px;
  cursor: pointer;
  border-radius: ${(p) => p.theme.radius.control};
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.secondary};

  &:hover { border-color: ${(p) => p.theme.border.accent}; color: ${(p) => p.theme.text.accent}; }
`;
