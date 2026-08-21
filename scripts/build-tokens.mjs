/**
 * 從 design/tokens.raw.txt 產生 src/styles/tokens.css 與 src/styles/theme.ts。
 *
 * tokens.raw.txt 是從 Figma 的 2. Semantic collection 匯出的，格式為
 *   --ds-<name>|<COLOR|FLOAT|STRING>|<value>
 * 變數名稱直接來自 Figma 每個變數的 codeSyntax.WEB，因此 Figma 與程式碼
 * 用的是同一組名字。要改設計 token，改 Figma 後重新匯出這個檔，再跑 npm run tokens。
 * 不需要 Figma 存取權也可以直接編輯這個檔案。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = readFileSync(resolve(root, 'design/tokens.raw.txt'), 'utf8');

const FONT_FALLBACK = {
  '--ds-typography-font-sans':
    '"Noto Sans TC", "PingFang TC", "Hiragino Sans CNS", "Heiti TC", system-ui, sans-serif',
  '--ds-typography-font-display':
    '"Space Grotesk", "Noto Sans TC", system-ui, sans-serif',
};

const tokens = raw
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((line) => {
    const [name, type, value] = line.split('|');
    return { name, type, value };
  });

/** FLOAT 除了字重之外一律帶 px。 */
const cssValue = ({ name, type, value }) => {
  if (FONT_FALLBACK[name]) return FONT_FALLBACK[name];
  if (type === 'STRING') return value;
  if (type === 'FLOAT') return /weight/.test(name) ? value : `${value}px`;
  return value;
};

const css = `/* 由 scripts/build-tokens.mjs 產生，請勿手動編輯。 */
/* 來源：design/tokens.raw.txt（Figma「2. Semantic」collection，${tokens.length} 個變數） */

:root {
${tokens.map((t) => `  ${t.name}: ${cssValue(t)};`).join('\n')}
}
`;
writeFileSync(resolve(root, 'src/styles/tokens.css'), css);

/** --ds-space-gap-sm → group "space"、key "gapSm" */
const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const groups = {};
for (const t of tokens) {
  const rest = t.name.replace(/^--ds-/, '');
  const [group, ...tail] = rest.split('-');
  (groups[group] ??= {})[camel(tail.join('-'))] = `var(${t.name})`;
}

const body = Object.entries(groups)
  .map(([g, entries]) => {
    const lines = Object.entries(entries)
      .map(([k, v]) => `    ${k}: '${v}',`)
      .join('\n');
    return `  ${g}: {\n${lines}\n  },`;
  })
  .join('\n');

const ts = `/* 由 scripts/build-tokens.mjs 產生，請勿手動編輯。 */
/* 值一律是 var(--ds-*)，實際色值由 tokens.css 決定。 */
/* 因此換配色只要動 tokens.css，元件一行都不用改。 */

export const theme = {
${body}
} as const;

export type Theme = typeof theme;
`;
writeFileSync(resolve(root, 'src/styles/theme.ts'), ts);

console.log(
  `tokens: ${tokens.length} → src/styles/tokens.css, src/styles/theme.ts (${Object.keys(groups).length} groups)`
);
