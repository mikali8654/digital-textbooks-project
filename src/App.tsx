import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import shehuiMd from '../design/sample-shehui.md?raw';
import guowenMd from '../design/sample-guowen.md?raw';
import { applyImport, parseMarkdown } from './model/markdown';
import { emptyDoc } from './model/document';
import { PAGE_SIZE } from './model/pageSize';
import { usePages } from './hooks/usePages';
import { PageView } from './components/PageView';
import type { Doc, DocSettings } from './model/types';

const SOURCES = {
  社會: shehuiMd,
  國文: guowenMd,
} as const;

type Subject = keyof typeof SOURCES;

/**
 * D2 的驗證畫面：把真的教材匯入、量測、分頁、畫出來。
 * 編輯功能在 D4 之後，這裡只證明「量得準、分得對、縮放不重排」。
 */
export function App() {
  const [subject, setSubject] = useState<Subject>('社會');
  const [doc, setDoc] = useState<Doc>(() => load('社會'));

  const switchTo = (s: Subject) => {
    setSubject(s);
    setDoc(load(s));
  };

  const patch = (p: Partial<DocSettings>) =>
    setDoc((d) => ({ ...d, settings: { ...d.settings, ...p } }));

  const { pages, stats } = usePages(doc);

  // 整頁等比縮放：分頁已經在頁座標裡算完，這裡只負責縮到看得見
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const recompute = () => {
      const pageW = PAGE_SIZE[doc.settings.aspectRatio].width;
      setScale(Math.min(1, (el.clientWidth - 48) / pageW));
    };

    // 直接算一次。不能只靠 ResizeObserver——某些環境（例如內嵌的
    // 瀏覽器面板）不會觸發它，那時倍率會靜靜地停在錯的值。
    recompute();
    window.addEventListener('resize', recompute);

    // RO 是加強，不是唯一來源：容器因為側欄開合而改變寬度時，
    // window 的 resize 不會觸發，這時才輪到它。
    const ro =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(recompute);
    ro?.observe(el);

    return () => {
      window.removeEventListener('resize', recompute);
      ro?.disconnect();
    };
  }, [doc.settings.aspectRatio]);

  const total = stats.hits + stats.misses;

  return (
    <Layout>
      <Bar>
        <Group>
          {(Object.keys(SOURCES) as Subject[]).map((s) => (
            <Toggle key={s} $on={s === subject} onClick={() => switchTo(s)}>
              {s}
            </Toggle>
          ))}
        </Group>
        <Group>
          <Toggle
            $on={doc.settings.writingMode === 'horizontal'}
            onClick={() => patch({ writingMode: 'horizontal' })}
          >
            橫排
          </Toggle>
          <Toggle
            $on={doc.settings.writingMode === 'vertical'}
            onClick={() => patch({ writingMode: 'vertical' })}
          >
            直排
          </Toggle>
        </Group>
        <Group>
          {(['4:3', '16:9'] as const).map((r) => (
            <Toggle
              key={r}
              $on={doc.settings.aspectRatio === r}
              onClick={() => patch({ aspectRatio: r })}
            >
              {r}
            </Toggle>
          ))}
        </Group>
        <Group>
          {(['sm', 'md', 'lg'] as const).map((t) => (
            <Toggle
              key={t}
              $on={doc.settings.textScale === t}
              onClick={() => patch({ textScale: t })}
            >
              字級 {t}
            </Toggle>
          ))}
        </Group>
        <Stats>
          {pages.length} 頁 · 量測快取命中 {total ? Math.round((stats.hits / total) * 100) : 0}%
        </Stats>
      </Bar>

      <Stage ref={stageRef}>
        {pages.map((page) => (
          <PageView key={page.index} page={page} settings={doc.settings} scale={scale} />
        ))}
      </Stage>
    </Layout>
  );
}

function load(key: Subject): Doc {
  return applyImport(emptyDoc(), parseMarkdown(SOURCES[key], { autoPageBreak: true }));
}

const Layout = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Bar = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space.gapLg};
  padding: ${(p) => p.theme.space.insetSm} ${(p) => p.theme.space.insetLg};
  background: ${(p) => p.theme.surface.raised};
  border-block-end: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
`;

const Group = styled.div`
  display: flex;
  gap: ${(p) => p.theme.space.gapXs};
`;

const Toggle = styled.button<{ $on: boolean }>`
  height: ${(p) => p.theme.control.heightSm};
  padding: 0 ${(p) => p.theme.space.insetSm};
  border-radius: ${(p) => p.theme.radius.control};
  cursor: pointer;
  font-family: inherit;
  font-size: var(--ds-typography-body-sm-size);
  border: ${(p) => p.theme.border.widthDefault} solid
    ${(p) => (p.$on ? p.theme.border.accent : p.theme.border.subtle)};
  background: ${(p) => (p.$on ? p.theme.brand.primaryTint : p.theme.surface.raised)};
  color: ${(p) => (p.$on ? p.theme.text.accent : p.theme.text.secondary)};

  &:hover {
    border-color: ${(p) => p.theme.border.accent};
    background: ${(p) => p.theme.brand.primaryTintSubtle};
  }
`;

const Stats = styled.div`
  margin-inline-start: auto;
  font-size: var(--ds-typography-body-sm-size);
  color: ${(p) => p.theme.text.tertiary};
  font-variant-numeric: tabular-nums;
`;

const Stage = styled.main`
  flex: 1;
  overflow: auto;
  padding: ${(p) => p.theme.space.insetLg};
  background: ${(p) => p.theme.surface.muted};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 48px;
`;
