import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import AlertBadge from './AlertBadge';

describe('AlertBadge', () => {
  it('renders a clickable badge with hover details', () => {
    render(
      <MemoryRouter>
        <AlertBadge
          href="/stocks/FPT"
          icon="🦈"
          tone="border-rose-400/80 bg-rose-950/55 text-rose-100"
          severityLabel="Nghiêm trọng"
          sideLabel="MUA"
          matchedValueLabel="1.2T"
          title="FPT · Nghiêm trọng · MUA · 1.2T"
        />
      </MemoryRouter>,
    );

    const badge = screen.getByRole('link', { name: 'FPT · Nghiêm trọng · MUA · 1.2T' });
    expect(badge.getAttribute('title')).toBe('FPT · Nghiêm trọng · MUA · 1.2T');
    expect(screen.getByText('🦈')).toBeTruthy();
    expect(screen.getByText('Nghiêm trọng')).toBeTruthy();
    expect(screen.getByText('MUA')).toBeTruthy();
    expect(screen.getByText('1.2T')).toBeTruthy();
  });
});