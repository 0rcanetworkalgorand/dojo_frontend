/**
 * Component rendering tests for core UI components.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LaneBadge } from '@/components/LaneBadge';

describe('LaneBadge', () => {
  it('renders research lane badge', () => {
    render(<LaneBadge lane="research" />);
    expect(screen.getByText('Research')).toBeInTheDocument();
  });

  it('renders code lane badge', () => {
    render(<LaneBadge lane="code" />);
    expect(screen.getByText('Code')).toBeInTheDocument();
  });

  it('renders data lane badge', () => {
    render(<LaneBadge lane="data" />);
    expect(screen.getByText('Data')).toBeInTheDocument();
  });

  it('renders outreach lane badge', () => {
    render(<LaneBadge lane="outreach" />);
    expect(screen.getByText('Outreach')).toBeInTheDocument();
  });

  it('applies subtle variant by default', () => {
    const { container } = render(<LaneBadge lane="code" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('lane-badge');
  });

  it('applies custom className', () => {
    const { container } = render(<LaneBadge lane="research" className="custom-class" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('custom-class');
  });
});
