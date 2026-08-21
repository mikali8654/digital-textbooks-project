/**
 * 把 design/icons/*.svg 編成 src/assets/icons.generated.ts。
 *
 * 這些 SVG 與 Figma 的 Icon/* 元件是同一份來源（Lucide，ISC 授權，stroke-width 統一
 * 改為 1.5 以符合設計系統）。要新增圖示：把 SVG 放進 design/icons/，跑 npm run icons，
 * 並在 Figma 建同名的 Icon/<name> 元件，兩邊才不會漂移。
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'design/icons');

const files = readdirSync(dir).filter((f) => f.endsWith('.svg')).sort();
const entries = files.map((f) => {
  const name = basename(f, '.svg');
  const body = readFileSync(resolve(dir, f), 'utf8')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [name, body];
});

const ts = `/* 由 scripts/build-icons.mjs 產生，請勿手動編輯。 */
/* 來源：design/icons/*.svg（Lucide，ISC 授權）。與 Figma 的 Icon/* 元件同源。 */

export const iconPaths = {
${entries.map(([n, b]) => `  '${n}': \`${b}\`,`).join('\n')}
} as const;

export type IconName = keyof typeof iconPaths;
export const iconNames = Object.keys(iconPaths) as IconName[];
`;
writeFileSync(resolve(root, 'src/assets/icons.generated.ts'), ts);
console.log(`icons: ${entries.length} → src/assets/icons.generated.ts`);
