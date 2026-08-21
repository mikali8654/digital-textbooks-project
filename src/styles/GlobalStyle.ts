import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }

  html, body, #root { height: 100%; }

  body {
    margin: 0;
    background: ${(p) => p.theme.surface.sunken};
    color: ${(p) => p.theme.text.primary};
    font-family: ${(p) => p.theme.typography.fontSans};
    font-size: ${(p) => p.theme.typography.bodyLgSize};
    line-height: ${(p) => p.theme.typography.bodyLgLineHeight};
    -webkit-font-smoothing: antialiased;
  }

  /* 只有鍵盤操作才顯示 focus 環，滑鼠點擊不觸發 */
  :focus-visible {
    outline: ${(p) => p.theme.border.widthFocus} solid ${(p) => p.theme.action.ghostFocusRing};
    outline-offset: 2px;
  }
  :focus:not(:focus-visible) { outline: none; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
