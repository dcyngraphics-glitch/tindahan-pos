import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GateNoticeBanner } from '../GateNotice';

describe('GateNoticeBanner', () => {
  it('renders the console notice as text and allows dismissal', () => {
    const onDismiss = vi.fn();
    render(
      <GateNoticeBanner
        notice={{
          id: 1,
          title: 'Subscription overdue',
          body: 'Settle ₱500 to keep access.',
          severity: 'warn',
          dismissible: true,
          expires_at: null,
        }}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText('Subscription overdue')).toBeInTheDocument();
    expect(screen.getByText('Settle ₱500 to keep access.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dismiss notice/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders a block notice as a non-dismissible modal', () => {
    const onDismiss = vi.fn();
    render(
      <GateNoticeBanner
        notice={{
          id: 2, title: 'Access paused', body: 'Contact the owner.',
          severity: 'block', dismissible: false, expires_at: null,
        }}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Access paused')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it('never renders notice text as markup', () => {
    const { container } = render(
      <GateNoticeBanner
        notice={{
          id: 3, title: 'Notice', body: '<img src=x onerror=alert(1)>',
          severity: 'info', dismissible: true, expires_at: null,
        }}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
});
