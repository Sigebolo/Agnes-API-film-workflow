/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageHistoryPanel from './ImageHistoryPanel';
import { HistoryImage } from '../types';

const mockImages: HistoryImage[] = [
  { id: 'img_1', url: 'https://example.com/img1.jpg', prompt: 'bird in forest', timestamp: Date.now() - 60000 },
  { id: 'img_2', url: 'https://example.com/img2.jpg', prompt: 'bird in city', timestamp: Date.now() },
];

describe('ImageHistoryPanel - Drag and Drop', () => {
  const mockOnSelect = vi.fn();
  const mockOnDragStart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('images are draggable when onReorder provided', () => {
    render(<ImageHistoryPanel images={mockImages} onSelect={mockOnSelect} onDragStart={mockOnDragStart} onReorder={vi.fn()} />);
    const images = screen.getAllByRole('img');
    images.forEach(img => {
      // draggable is on the parent div, not the img
      expect(img.parentElement).toHaveAttribute('draggable', 'true');
    });
  });

  it('calls onDragStart when image dragged', () => {
    render(<ImageHistoryPanel images={mockImages} onSelect={mockOnSelect} onDragStart={mockOnDragStart} />);
    const img = screen.getAllByRole('img')[0];
    
    fireEvent.dragStart(img, {
      dataTransfer: {
        setData: vi.fn(),
        effectAllowed: 'copy',
      },
    });
    
    expect(mockOnDragStart).toHaveBeenCalledWith(mockImages[0]);
  });

  it('shows drag hint text', () => {
    render(<ImageHistoryPanel images={mockImages} onSelect={mockOnSelect} onDragStart={mockOnDragStart} />);
    expect(screen.getByText(/Drag to use in next step/i)).toBeInTheDocument();
  });
});
