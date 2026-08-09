// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SafeRichText from './SafeRichText';

describe('SafeRichText', () => {
  it('removes executable markup and unsafe URL protocols', () => {
    const { container } = render(
      <SafeRichText html={'<p onclick="steal()">Safe</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a>'} />,
    );
    expect(screen.getByText('Safe')).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBeNull();
  });
});
