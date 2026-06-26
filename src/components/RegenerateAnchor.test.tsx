/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PromptOptimizeStep from './PromptOptimizeStep';
import { VideoClip, CharacterAnchor } from '../types';

const mockClip: VideoClip = {
  id: 'test-clip',
  imagePrompt: '',
  videoPrompt: '',
  subtitle: '',
};

const mockAnchor: CharacterAnchor = {
  id: 'anchor_1',
  description: 'a small fluffy bird',
  sheetUrl: 'https://example.com/front.jpg',
  viewUrls: {
    front: 'https://example.com/front.jpg',
    side: 'https://example.com/side.jpg',
    back: 'https://example.com/back.jpg',
    threeQuarter: 'https://example.com/34.jpg',
  },
};

describe('PromptOptimizeStep - Regenerate Character Anchor', () => {
  const mockOnNext = vi.fn();
  const mockOnSetCharacterAnchor = vi.fn();
  const mockOnUpdateClip = vi.fn();
  const mockOnToast = vi.fn();
  const mockOnSkipToVideo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Regenerate Character Anchor" button when anchor exists', () => {
    render(
      <PromptOptimizeStep
        apiKey="test-key"
        activeClip={mockClip}
        characterAnchor={mockAnchor}
        onUpdateClip={mockOnUpdateClip}
        onSetCharacterAnchor={mockOnSetCharacterAnchor}
        onNext={mockOnNext}
        onSkipToVideo={mockOnSkipToVideo}
        onToast={mockOnToast}
      />
    );

    expect(screen.getByText(/Regenerate Character Anchor/i)).toBeInTheDocument();
  });

  it('does not show regenerate button when no anchor', () => {
    render(
      <PromptOptimizeStep
        apiKey="test-key"
        activeClip={mockClip}
        characterAnchor={null}
        onUpdateClip={mockOnUpdateClip}
        onSetCharacterAnchor={mockOnSetCharacterAnchor}
        onNext={mockOnNext}
        onSkipToVideo={mockOnSkipToVideo}
        onToast={mockOnToast}
      />
    );

    expect(screen.queryByText(/Regenerate Character Anchor/i)).not.toBeInTheDocument();
  });

  it('shows character anchor images when anchor exists', () => {
    render(
      <PromptOptimizeStep
        apiKey="test-key"
        activeClip={mockClip}
        characterAnchor={mockAnchor}
        onUpdateClip={mockOnUpdateClip}
        onSetCharacterAnchor={mockOnSetCharacterAnchor}
        onNext={mockOnNext}
        onSkipToVideo={mockOnSkipToVideo}
        onToast={mockOnToast}
      />
    );

    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
  });
});
