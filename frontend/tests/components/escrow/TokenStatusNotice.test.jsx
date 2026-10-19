import { render, screen } from '@testing-library/react';
import TokenStatusNotice from '../../../app/escrow/create/TokenStatusNotice';

describe('TokenStatusNotice reduced motion', () => {
  it('shows a pulse indicator that is disabled under reduced motion while checking', () => {
    render(<TokenStatusNotice status="checking" />);

    const indicator = screen.getByTestId('token-status-indicator');
    expect(indicator).toHaveClass('motion-safe:animate-pulse', 'motion-reduce:animate-none');
    expect(indicator).not.toHaveClass('animate-pulse');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Checking payment token status…');
  });

  it('keeps text feedback during a background refresh of a confirmed status', () => {
    render(<TokenStatusNotice status="whitelisted" pending />);

    expect(screen.getByTestId('token-status-indicator')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Payment token is whitelisted. Refreshing…');
  });

  it('renders no indicator once settled, including stale and blocked states', () => {
    const { rerender } = render(<TokenStatusNotice status="supported" stale />);
    expect(screen.queryByTestId('token-status-indicator')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('showing last confirmed status');

    rerender(<TokenStatusNotice status="paused" />);
    expect(screen.queryByTestId('token-status-indicator')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('contract is paused');
  });
});
