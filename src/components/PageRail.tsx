import { useState } from 'react';
import styled from 'styled-components';
import { PageView } from './PageView';
import { Icon } from './Icon';
import { PAGE_SIZE } from '../model/pageSize';
import { outlineOf, pageOfRow } from '../model/outline';
import type { Page } from '../model/paginate';
import type { Doc } from '../model/types';

type Props = {
  doc: Doc;
  pages: Page[];
  /** 目前這一頁（預覽模式才有意義）。 */
  current: number;
  onGoPage: (index: number) => void;
  onGoRow: (rowId: string) => void;
};

/** 縮圖的寬度。實際縮放倍率由它跟頁寬算出來，不是寫死的。 */
const THUMB_INLINE = 132;

/**
 * 左側的頁面縮圖與目次。
 *
 * 縮圖是用**同一個 PageView 縮小**畫的，不是另外做一套簡化的示意圖。
 * 兩套渲染遲早會不一樣，而縮圖跟內文不一樣就等於沒有用。
 * 量測結果是共用快取的，所以縮圖不會讓分頁重算一次。
 */
export function PageRail({ doc, pages, current, onGoPage, onGoRow }: Props) {
  const [tab, setTab] = useState<'pages' | 'outline'>('pages');
  const size = PAGE_SIZE[doc.settings.aspectRatio];
  const scale = THUMB_INLINE / size.width;
  const outline = outlineOf(doc);

  return (
    <Rail>
      <Tabs>
        <Tab $on={tab === 'pages'} onClick={() => setTab('pages')}>
          頁面 {pages.length}
        </Tab>
        <Tab $on={tab === 'outline'} onClick={() => setTab('outline')}>
          目次 {outline.length}
        </Tab>
      </Tabs>

      {tab === 'pages' ? (
        <Scroll>
          {pages.map((p, i) => (
            <Thumb key={p.index} $on={i === current} onClick={() => onGoPage(i)}>
              <Shot style={{ width: size.width * scale, height: size.height * scale }}>
                {/* 縮圖不能被點進去編輯，所以不傳 rowIndexOf——
                    沒有它就是唯讀，跟預覽走同一條路徑 */}
                <PageView page={p} settings={doc.settings} scale={scale} />
              </Shot>
              <Meta>
                <Num>{i + 1}</Num>
                {/* 老師自己放的換頁線要看得出來：它的位置固定，
                    不像自動換頁會隨內容移動 */}
                {p.startedBy === 'manual' && (
                  <Icon name="page-break" size={16} label="手動換頁" />
                )}
              </Meta>
            </Thumb>
          ))}
        </Scroll>
      ) : (
        <Scroll>
          {outline.length === 0 && <Empty>還沒有標題。把一段設成課名或大標就會出現在這裡。</Empty>}
          {outline.map((item) => {
            const page = pageOfRow(pages, item.rowId);
            return (
              <Entry
                key={item.rowId}
                $depth={item.depth}
                $on={page === current}
                onClick={() => onGoRow(item.rowId)}
              >
                <EntryText>{item.text}</EntryText>
                {page >= 0 && <EntryPage>{page + 1}</EntryPage>}
              </Entry>
            );
          })}
        </Scroll>
      )}
    </Rail>
  );
}

const Rail = styled.nav`
  inline-size: 180px;
  flex: none;
  display: flex;
  flex-direction: column;
  border-inline-end: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  background: ${(p) => p.theme.surface.raised};
  /* 縮圖列永遠橫排，即使教材是直排——它是介面不是內容 */
  writing-mode: horizontal-tb;
`;

const Tabs = styled.div`
  display: flex;
  padding: 6px;
  gap: 4px;
  border-block-end: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
`;

const Tab = styled.button<{ $on: boolean }>`
  flex: 1;
  font: inherit;
  font-size: var(--ds-typography-label-size);
  min-block-size: 36px;
  cursor: pointer;
  border: none;
  border-radius: ${(p) => p.theme.radius.control};
  background: ${(p) => (p.$on ? p.theme.brand.primaryTint : 'transparent')};
  color: ${(p) => (p.$on ? p.theme.text.accent : p.theme.text.secondary)};
`;

const Scroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${(p) => p.theme.space.insetSm};
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.gapSm};
`;

const Thumb = styled.button<{ $on: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  padding: 4px;
  cursor: pointer;
  border-radius: ${(p) => p.theme.radius.field};
  background: ${(p) => (p.$on ? p.theme.brand.primaryTint : 'transparent')};

  &:hover { background: ${(p) => p.theme.surface.sunken}; }
`;

const Shot = styled.div`
  flex: none;
  overflow: hidden;
  border-radius: 2px;
  /* 縮圖只是給人認位置的，點的是整塊，裡面不該吃到任何事件 */
  pointer-events: none;
  position: relative;
`;

const Meta = styled.span`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: ${(p) => p.theme.text.tertiary};
`;

const Num = styled.span`
  font-size: var(--ds-typography-label-size);
  font-variant-numeric: tabular-nums;
`;

const Entry = styled.button<{ $depth: number; $on: boolean }>`
  display: flex;
  align-items: baseline;
  gap: 8px;
  text-align: start;
  font: inherit;
  font-size: var(--ds-typography-label-size);
  /* 縮排就是標題層級，不必再標「大標／中標」 */
  padding: 8px 8px 8px ${(p) => 8 + p.$depth * 12}px;
  min-block-size: 36px;
  cursor: pointer;
  border: none;
  border-radius: ${(p) => p.theme.radius.control};
  background: ${(p) => (p.$on ? p.theme.brand.primaryTint : 'transparent')};
  color: ${(p) => (p.$depth === 0 ? p.theme.text.primary : p.theme.text.secondary)};
  font-weight: ${(p) => (p.$depth === 0 ? 600 : 400)};

  &:hover { background: ${(p) => p.theme.surface.sunken}; }
`;

const EntryText = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EntryPage = styled.span`
  color: ${(p) => p.theme.text.tertiary};
  font-variant-numeric: tabular-nums;
`;

const Empty = styled.p`
  margin: 0;
  padding: ${(p) => p.theme.space.insetSm};
  font-size: var(--ds-typography-label-size);
  line-height: 1.6;
  color: ${(p) => p.theme.text.tertiary};
`;
