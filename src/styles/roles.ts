import type { TextRole } from '../model/types';

/**
 * 九種內容角色 → 設計系統的字級 token。
 *
 * 字級由角色決定，老師不能逐段調整——這不只是為了效率：
 * 學生用平板看全版面的前提是每一頁的字級一致，
 * 逐段調整會讓整頁縮放後的資訊密度忽大忽小。
 * 老師要調整時改的是整本的 textScale。
 */
export const ROLE_TOKEN: Record<TextRole, string> = {
  lessonTitle: 'heading-1',
  sectionTitle: 'heading-2',
  itemTitle: 'heading-3',
  subItemTitle: 'heading-4',
  lead: 'lead',
  body: 'body-lg',
  supplement: 'body',
  annotation: 'body-sm',
  caption: 'caption',
};

/** 整本的字級檔位。所有角色一起等比縮放，相對關係不變。 */
export const TEXT_SCALE: Record<'sm' | 'md' | 'lg', number> = {
  sm: 0.875,
  md: 1,
  lg: 1.125,
};

export type RoleStyle = {
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  fontFamily: string;
};

/** 取得某個角色的實際 CSS 值。scale 會乘進字級與行高。 */
export function roleStyle(role: TextRole, scale = 1): RoleStyle {
  const t = ROLE_TOKEN[role];
  const scaled = (name: string) =>
    scale === 1
      ? `var(--ds-typography-${t}-${name})`
      : `calc(var(--ds-typography-${t}-${name}) * ${scale})`;
  return {
    fontSize: scaled('size'),
    lineHeight: scaled('line-height'),
    fontWeight: `var(--ds-typography-${t}-weight)`,
    fontFamily: 'var(--ds-typography-font-sans)',
  };
}
