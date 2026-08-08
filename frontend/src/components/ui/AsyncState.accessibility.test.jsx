// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { ErrorState, LoadingCards, OfflineBanner } from './AsyncState';

describe('automated accessibility smoke tests', () => {
  it('keeps common async states free of axe violations', async () => {
    const { container } = render(
      <main>
        <LoadingCards count={1} />
        <ErrorState error={{ message: 'Network failed' }} onRetry={() => {}} />
        <OfflineBanner />
      </main>,
    );

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
