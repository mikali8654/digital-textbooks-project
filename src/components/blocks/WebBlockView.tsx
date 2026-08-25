import styled from 'styled-components';
import { Icon } from '../Icon';
import type { BlockPatch } from '../../model/actions';
import type { WebBlock } from '../../model/types';

type Props = {
  block: WebBlock;
  boxStyle?: React.CSSProperties;
  onPatch?: (patch: BlockPatch) => void;
  onSelect?: () => void;
};

/**
 * 網頁。課本上有三種樣子，資料是同一個。
 *
 *  bookmark 一張小卡片
 *  embed    頁內的網頁框
 *  qr       課本印的 QR 碼
 *
 * 編輯時三種都不真的載入對方的網站：embed 用示意框。
 * 能不能嵌入要看對方的 X-Frame-Options / CSP，那是伺服器端的檢查，
 * 屬於客戶的 API；在那之前假裝載得起來只會在課堂上開天窗。
 */
export function WebBlockView({ block, boxStyle, onPatch, onSelect }: Props) {
  const host = hostOf(block.url);

  if (block.presentation === 'qr') {
    return (
      <QrRow style={boxStyle} onPointerDown={onSelect}>
        <QrBox>
          <Icon name="zoom-in" size={24} />
        </QrBox>
        <div>
          <strong>{block.title || '掃描開啟'}</strong>
          <Url>{host}</Url>
        </div>
      </QrRow>
    );
  }

  if (block.presentation === 'embed') {
    return (
      <Embed style={boxStyle} onPointerDown={onSelect}>
        <Icon name="globe" size={24} />
        <strong>{block.title || host}</strong>
        <Url>{block.url}</Url>
        <Note>頁內嵌入。實際能否嵌入由對方網站決定，接上檢查 API 後才會是真的。</Note>
      </Embed>
    );
  }

  return (
    <Card style={boxStyle} onPointerDown={onSelect}>
      <Icon name="link" size={20} />
      <Body>
        <Title
          contentEditable={!!onPatch}
          suppressContentEditableWarning
          data-placeholder="連結標題"
          onBlur={(e) => onPatch?.({ title: e.currentTarget.textContent ?? '' })}
        >
          {block.title}
        </Title>
        <Url>{host}</Url>
      </Body>
    </Card>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const Card = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  border-radius: ${(p) => p.theme.radius.card};
  padding: 12px 16px;
  color: ${(p) => p.theme.text.secondary};
  box-sizing: border-box;
`;

const Body = styled.div`
  min-inline-size: 0;
`;

const Title = styled.div`
  color: ${(p) => p.theme.text.primary};
  font-size: var(--ds-typography-body-sm-size);
  font-weight: 600;
  outline: none;

  &:empty::before {
    content: attr(data-placeholder);
    color: ${(p) => p.theme.text.tertiary};
  }
`;

const Url = styled.div`
  color: ${(p) => p.theme.text.tertiary};
  font-family: var(--ds-typography-font-display);
  font-size: var(--ds-typography-label-size);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Embed = styled.div`
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  border: ${(p) => p.theme.border.widthDefault} dashed ${(p) => p.theme.border.subtle};
  border-radius: ${(p) => p.theme.radius.card};
  padding: 16px;
  text-align: center;
  color: ${(p) => p.theme.text.secondary};
  box-sizing: border-box;
`;

const Note = styled.span`
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
  max-inline-size: 40ch;
`;

const QrRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  color: ${(p) => p.theme.text.secondary};
  box-sizing: border-box;
`;

const QrBox = styled.div`
  display: grid;
  place-items: center;
  inline-size: 72px;
  block-size: 72px;
  border-radius: ${(p) => p.theme.radius.field};
  background: ${(p) => p.theme.surface.sunken};
  flex: none;
`;
