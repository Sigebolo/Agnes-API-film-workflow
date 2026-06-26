/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageHistoryPanel from './ImageHistoryPanel';

const mockImages = [
  { id: 'img_1', url: 'https://example.com/img1.jpg', prompt: 'bird in forest', timestamp: Date.now() - 60000 },
  { id: 'img_2', url: 'https://example.com/img2.jpg', prompt: 'bird in city', timestamp: Date.now() },
];

describe('ImageHistoryPanel', () => {
  const mockOnSelect = vi.fn();
  const mockOnCompare = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no images', () => {
    render(<ImageHistoryPanel images={[]} onSelect={mockOnSelect} />);
    expect(screen.getByText(/No images yet/i)).toBeInTheDocument();
  });

  it('renders image list when images provided', () => {
    render(<ImageHistoryPanel images={mockImages} onSelect={mockOnSelect} />);
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('calls onSelect when image clicked', () => {
    render(<ImageHistoryPanel images={mockImages} onSelect={mockOnSelect} />);
    fireEvent.click(screen.getAllByRole('img')[0]);
    expect(mockOnSelect).toHaveBeenCalledWith(mockImages[0]);
  });

  it('shows compare toggle when 2+ images exist', () => {
    render(<ImageHistoryPanel images={mockImages} onSelect={mockOnSelect} onCompare={mockOnCompare} />);
    expect(screen.getByText(/Compare/i)).toBeInTheDocument();
  });

  it('enters compare mode when compare button clicked', () => {
    render(<ImageHistoryPanel images={mockImages} onSelect={mockOnSelect} onCompare={mockOnCompare} />);
    fireEvent.click(screen.getByText(/Compare/i));
    expect(screen.getByText(/Exit Compare/i)).toBeInTheDocument();
  });

  it('shows side-by-side in compare mode', () => {
    render(<ImageHistoryPanel images={mockImages} onSelect={mockOnSelect} onCompare={mockOnCompare} />);
    fireEvent.click(screen.getByText(/Compare/i));
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });
});
