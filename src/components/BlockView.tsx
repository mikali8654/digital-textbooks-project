import styled from 'styled-components';
import { roleStyle, TEXT_SCALE } from '../styles/roles';
import { blockBox, type SizingContext } from '../model/blockSizing';
import { spansToHtml } from '../model/inlineDom';
import { EditableText } from './EditableText';
import { ImageBlockView } from './blocks/ImageBlockView';
import { VideoBlockView } from './blocks/VideoBlockView';
import { WebBlockView } from './blocks/WebBlockView';
import { TableBlockView } from './blocks/TableBlockView';
import { AudioBlockView } from './blocks/AudioBlockView';
import { ModuleBlockView } from './blocks/ModuleBlockView';
import { ShapeBlockView } from './blocks/ShapeBlockView';
import type { BlockPatch } from '../model/actions';
import type { Block, DocSettings, InlineSpan } from '../model/types';

type Props = {
  block: Block;
  settings: DocSettings;
  sizing: SizingContext;
  /** 唯讀（預覽模式）時不給編輯。 */
  onEditSpans?: (spans: InlineSpan[]) => void;
  /** 改元件屬性（圖說、標題、尺寸）。唯讀時不傳。 */
  onPatch?: (patch: BlockPatch) => void;
  /** 選了一段字。浮動膠囊靠它決定要不要出現。 */
  onSelectRange?: (range: { start: number; end: number } | null) => void;
  /** 點下去選中這個元件。唯讀時不傳。 */
  onSelect?: () => void;
};

/**
 * 區塊的呈現。
 *
 * 編輯與唯讀走同一組 HTML（spansToHtml）與同一個 class（ds-rich），
 * 所以老師編的樣子、學生看的樣子、量測器量的樣子是同一個。
 */
export function BlockView({
  block,
  settings,
  sizing,
  onEditSpans,
  onPatch,
  onSelectRange,
  onSelect,
}: Props) {
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

      // 帶注音、重點詞、注釋號的段落也能直接編：標記存在 DOM 上，
      // 打字動的是文字節點，碰不到標記本身。
      if (onEditSpans) {
        return (
          <EditableTextStyled
            className="ds-rich"
            style={s}
            spans={block.spans}
            onFocus={onSelect}
            onChange={onEditSpans}
            onSelect={onSelectRange}
            placeholder={block.role === 'lessonTitle' ? '輸入標題…' : '輸入內容…'}
          />
        );
      }
      return (
        <Text
          className="ds-rich"
          style={s}
          dangerouslySetInnerHTML={{ __html: spansToHtml(block.spans) }}
        />
      );
    }
    case 'image':
      return (
        <ImageBlockView
          block={block}
          boxStyle={boxStyle}
          onPatch={onPatch}
          onSelect={onSelect}
        />
      );
    case 'video':
      return (
        <VideoBlockView
          block={block}
          boxStyle={boxStyle}
          onPatch={onPatch}
          onSelect={onSelect}
        />
      );
    case 'web':
      return (
        <WebBlockView block={block} boxStyle={boxStyle} onPatch={onPatch} onSelect={onSelect} />
      );
    case 'dialogue':
      return (
        <Bubble onPointerDown={onSelect}>
          <Speaker>{block.speaker}</Speaker>
          {block.text}
        </Bubble>
      );
    case 'question':
      return (
        <Card onPointerDown={onSelect}>
          {block.questionType && <Tag>{block.questionType}</Tag>}
          <strong>
            {block.number}. {block.stem.map((s2) => s2.text).join('')}
          </strong>
          <Options>
            {block.options.map((o) => (
              <li key={o.key}>
                ({o.key}) {o.text.map((s2) => s2.text).join('')}
              </li>
            ))}
          </Options>
        </Card>
      );
    case 'table':
      return (
        <TableBlockView block={block} boxStyle={boxStyle} sizing={sizing} onSelect={onSelect} />
      );
    case 'audio':
      return (
        <AudioBlockView block={block} boxStyle={boxStyle} onPatch={onPatch} onSelect={onSelect} />
      );
    case 'module':
      return <ModuleBlockView block={block} boxStyle={boxStyle} onSelect={onSelect} />;
    case 'shape':
      return <ShapeBlockView block={block} boxStyle={boxStyle} onSelect={onSelect} />;
    case 'reference':
      return <Ref onPointerDown={onSelect}>配合{block.target}第 {block.pages} 頁</Ref>;
    default: {
      // 十一種元件都畫過了。之後在 Block union 加一種卻忘了在這裡處理，
      // 這一行會編譯失敗——不會等到畫面上出現一個空白方塊才發現。
      const never: never = block;
      return never;
    }
  }
}

const Text = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.primary};
`;

const EditableTextStyled = styled(EditableText)`
  margin: 0;
  color: ${(p) => p.theme.text.primary};
  outline: none;

  &:focus-visible {
    outline: ${(p) => p.theme.border.widthSelected} solid ${(p) => p.theme.tool.border};
    outline-offset: 4px;
    border-radius: 2px;
  }

  &:empty::before {
    content: attr(data-placeholder);
    color: ${(p) => p.theme.text.tertiary};
    pointer-events: none;
  }
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
  background: ${(p) => p.theme.tool.surface};
  color: ${(p) => p.theme.tool.accent};
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



const Ref = styled.div`
  align-self: flex-start;
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
`;
