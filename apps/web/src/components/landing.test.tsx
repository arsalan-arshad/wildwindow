import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Landing } from './landing';

describe('Landing', () => {
  it('renders the coming soon headline', () => {
    render(<Landing />);
    expect(screen.getByRole('heading', { name: /WildWindow – coming soon/i })).toBeInTheDocument();
  });
});
