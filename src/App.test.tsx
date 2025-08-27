import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the main heading', () => {
    render(<App />);
    const heading = screen.getByText(/GAINAGE/i);
    expect(heading).toBeInTheDocument();
  });
});
