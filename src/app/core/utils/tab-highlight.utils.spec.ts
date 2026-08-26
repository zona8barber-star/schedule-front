import { computeTabHighlightStyle } from './tab-highlight.utils';

describe('computeTabHighlightStyle', () => {
  it('translates the highlight to the tab offset and matches its width', () => {
    const style = computeTabHighlightStyle(120, 48);
    expect(style.transform).toBe('translateX(120px)');
    expect(style.width).toBe('48px');
  });

  it('handles a zero offset for the first tab', () => {
    const style = computeTabHighlightStyle(0, 56);
    expect(style.transform).toBe('translateX(0px)');
    expect(style.width).toBe('56px');
  });
});
