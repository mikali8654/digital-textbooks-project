import styled from 'styled-components';
import { roleStyle, TEXT_SCALE } from '../styles/roles';
import { blockBox, type SizingContext } from '../model/blockSizing';
import { EditableText } from './EditableText';
import type { Block, DocSettings, InlineSpan } from '../model/types';

type Props = {
  block: Block;
  settings: DocSettings;
  sizing: SizingContext;
  /** 唯讀（預覽模式）時不給編輯。 */
  onEditText?: (fragment: string) => void;
  /** 這個片段在原文裡的位置。被切成兩頁的課文才有。 */
  slice?: { start: number; end: number };
};

/**
 * 區塊的呈現。D2 只求「量得準、看得出來」，
 * 完整的元件（選取態、浮動膠囊、Pop-up）在 D4 之後。
 */
export function BlockView({ block, settings, sizing, onEditText }: Props) {
  const scale = TEXT_SCALE[settings.textScale];

  // 非文字區塊：尺寸由 blockSizing 決定，跟量測用的是同一個函式，
  // 所以畫出來的一定等於量到的，不會撐破頁面。
  const box = blockBox(block, sizing);
  const boxStyle = box
    ? sizing.vertical
      ? { width: box.blockSize, height: box.inlineSize }
      : { width: box.inlineSize, height: box.blockSize }
    : undefined;

  switch (block.type) {
    case 'text': {
      const s = roleStyle(block.role, scale);
      const plain = block.spans.map((sp) => sp.text).join('');
      // 行內樣式（重點詞、注音、注釋號）目前是唯讀呈現。
      // 要能一邊打字一邊保留行內標記，需要真正的行內編輯器，那是 D5。
      const hasInline = block.spans.some((sp) => sp.keyword || sp.ruby || sp.footnoteRef);

      if (onEditText && !hasInline) {
        return (
          <EditableTextStyled
            style={s}
            value={plain}
            onChange={onEditText}
            placeholder={block.role === 'lessonTitle' ? '輸入標題…' : '輸入內容…'}
          />
        );
      }
      return (
        <Text style={s}>
          {block.spans.map((span, i) => (
            <Span key={i} span={span} />
          ))}
        </Text>
      );
    }
    case 'image':
      return (
        <figure style={{ margin: 0 }}>
          <Placeholder style={boxStyle}>{block.alt || '圖片'}</Placeholder>
          {block.caption && <Caption>{block.caption}</Caption>}
        </figure>
      );
    case 'dialogue':
      return (
        <Bubble>
          <Speaker>{block.speaker}</Speaker>
          {block.text}
        </Bubble>
      );
    case 'web':
      return (
        <Card>
          <strong>{block.title}</strong>
          <Url>{block.url}</Url>
        </Card>
      );
    case 'question':
      return (
        <Card>
          {block.questionType && <Tag>{block.questionType}</Tag>}
          <strong>
            {block.number}. {block.stem.map((s) => s.text).join('')}
          </strong>
          <Options>
            {block.options.map((o) => (
              <li key={o.key}>
                ({o.key}) {o.text.map((s) => s.text).join('')}
              </li>
            ))}
          </Options>
        </Card>
      );
    case 'table':
      return (
        <Card>
          <Tag>表格 {block.rows}×{block.cols}</Tag>
        </Card>
      );
    case 'reference':
      return <Ref>配合{block.target}第 {block.pages} 頁</Ref>;
    default:
      return <Card><Tag>{block.type}</Tag></Card>;
  }
}

/** 行內樣式。注音用 ruby，台灣的注音直排橫排都在字的右側。 */
function Span({ span }: { span: InlineSpan }) {
  const content = span.ruby ? (
    <ruby>
      {span.text}
      <rt>{span.ruby}</rt>
    </ruby>
  ) : (
    span.text
  );

  if (span.keyword) return <Keyword>{content}</Keyword>;
  if (span.bold) return <strong>{content}</strong>;
  if (span.footnoteRef) return <><>{content}</><Sup>{span.footnoteRef}</Sup></>;
  return <>{content}</>;
}

const Text = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.primary};
  white-space: pre-wrap;
  word-break: break-word;

  rt {
    font-size: 0.4em;
    color: ${(p) => p.theme.text.secondary};
  }
`;

const EditableTextStyled = styled(EditableText)`
  margin: 0;
  color: ${(p) => p.theme.text.primary};
  white-space: pre-wrap;
  word-break: break-word;
  outline: none;

  &:focus-visible {
    outline: ${(p) => p.theme.border.widthSelected} solid ${(p) => p.theme.border.accent};
    outline-offset: 4px;
    border-radius: 2px;
  }

  &:empty::before {
    content: attr(data-placeholder);
    color: ${(p) => p.theme.text.tertiary};
    pointer-events: none;
  }
`;

const Keyword = styled.span`
  border-block-end: 2px solid ${(p) => p.theme.border.accent};
`;

const Sup = styled.sup`
  font-size: 0.6em;
  color: ${(p) => p.theme.text.accent};
  font-weight: 700;
  margin-inline-start: 2px;
`;

const Placeholder = styled.div`
  background: ${(p) => p.theme.surface.media};
  border-radius: ${(p) => p.theme.radius.field};
  display: grid;
  place-items: center;
  color: ${(p) => p.theme.text.secondary};
  font-size: var(--ds-typography-caption-size);
  text-align: center;
  padding: 8px;
`;

const Caption = styled.figcaption`
  margin-block-start: 12px;
  font-size: calc(var(--ds-typography-caption-size));
  line-height: var(--ds-typography-caption-line-height);
  color: ${(p) => p.theme.text.secondary};
`;

const Bubble = styled.div`
  background: ${(p) => p.theme.surface.sunken};
  border-radius: ${(p) => p.theme.radius.card};
  padding: 12px 16px;
  font-size: var(--ds-typography-body-sm-size);
  line-height: var(--ds-typography-body-sm-line-height);
`;

const Speaker = styled.span`
  display: block;
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
  margin-block-end: 4px;
`;

const Card = styled.div`
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  border-radius: ${(p) => p.theme.radius.card};
  padding: 16px;
  font-size: var(--ds-typography-body-sm-size);
  line-height: var(--ds-typography-body-sm-line-height);
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Tag = styled.span`
  align-self: flex-start;
  background: ${(p) => p.theme.brand.primaryTint};
  color: ${(p) => p.theme.text.accent};
  border-radius: ${(p) => p.theme.radius.control};
  padding: 2px 10px;
  font-size: var(--ds-typography-label-size);
`;

const Options = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: ${(p) => p.theme.text.secondary};
`;

const Url = styled.span`
  color: ${(p) => p.theme.text.tertiary};
  font-family: var(--ds-typography-font-display);
  font-size: var(--ds-typography-label-size);
`;

const Ref = styled.div`
  align-self: flex-start;
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
`;
