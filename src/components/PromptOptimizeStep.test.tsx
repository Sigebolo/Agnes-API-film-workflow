import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PromptOptimizeStep from './PromptOptimizeStep';
import * as api from '../utils/api';

vi.mock('../utils/api', () => ({
  optimizePromptApi: vi.fn(),
  generateCharacterSheetApi: vi.fn(),
  generateCharacterViewApi: vi.fn(),
}));

describe('PromptOptimizeStep - 3-step workflow', () => {
  const defaultProps = {
    apiKey: 'test-key',
    activeClip: {
      id: 'clip-1',
      imagePrompt: '',
      videoPrompt: '',
    },
    characterAnchor: null,
    onUpdateClip: vi.fn(),
    onSetCharacterAnchor: vi.fn(),
    onNext: vi.fn(),
    onToast: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url === '/api/analyze-character') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ character: 'Yellow Pekingese dog with fluffy fur' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: 'optimized prompt' } }] }),
      });
    }));
  });

  it('renders step title', () => {
    render(<PromptOptimizeStep {...defaultProps} />);
    expect(screen.getByText('1. Prompt & Character Anchor')).toBeInTheDocument();
  });

  it('disables pipeline button when prompt is empty', () => {
    render(<PromptOptimizeStep {...defaultProps} />);
    const pipelineButton = screen.getByRole('button', { name: /run pipeline/i });
    expect(pipelineButton).toBeDisabled();
  });

  it('enables pipeline button when prompt is provided', () => {
    render(<PromptOptimizeStep {...defaultProps} />);
    const textarea = screen.getByPlaceholderText(/red-haired astronaut/);
    fireEvent.change(textarea, { target: { value: 'A test prompt' } });
    const pipelineButton = screen.getByRole('button', { name: /run pipeline/i });
    expect(pipelineButton).toBeEnabled();
  });

  it('runs full pipeline: optimize → extract → generate anchor', async () => {
    vi.mocked(api.optimizePromptApi).mockResolvedValue('Optimized prompt for image generation');
    vi.mocked(api.generateCharacterViewApi).mockResolvedValue('https://example.com/view.png');

    render(<PromptOptimizeStep {...defaultProps} />);
    const textarea = screen.getByPlaceholderText(/red-haired astronaut/);
    fireEvent.change(textarea, { target: { value: 'Yellow Pekingese dog' } });

    const pipelineButton = screen.getByRole('button', { name: /run pipeline/i });
    fireEvent.click(pipelineButton);

    await waitFor(() => {
      expect(api.optimizePromptApi).toHaveBeenCalled();
      expect(api.generateCharacterViewApi).toHaveBeenCalledTimes(4);
      expect(defaultProps.onSetCharacterAnchor).toHaveBeenCalledWith(
        expect.objectContaining({
          sheetUrl: expect.stringContaining('https://example.com/view.png'),
          viewUrls: expect.objectContaining({
            front: expect.any(String),
            side: expect.any(String),
            back: expect.stringContaining('https://example.com/view.png'),
            threeQuarter: expect.stringContaining('https://example.com/view.png'),
          }),
        })
      );
    });
  });

  it('shows generation logs during pipeline', async () => {
    vi.mocked(api.optimizePromptApi).mockResolvedValue('Optimized prompt');
    vi.mocked(api.generateCharacterViewApi).mockResolvedValue('https://example.com/view.png');

    render(<PromptOptimizeStep {...defaultProps} />);
    const textarea = screen.getByPlaceholderText(/red-haired astronaut/);
    fireEvent.change(textarea, { target: { value: 'Test character' } });

    const pipelineButton = screen.getByRole('button', { name: /run pipeline/i });
    fireEvent.click(pipelineButton);

    await waitFor(() => {
      expect(screen.getByText(/Pipeline started/)).toBeInTheDocument();
      expect(screen.getByText(/Optimizing prompt/)).toBeInTheDocument();
    });
  });

  it('allows manual character description', async () => {
    vi.mocked(api.optimizePromptApi).mockResolvedValue('Optimized prompt');
    vi.mocked(api.generateCharacterViewApi).mockResolvedValue('https://example.com/view.png');

    render(<PromptOptimizeStep {...defaultProps} />);
    
    // Enter character description manually
    const charTextarea = screen.getByPlaceholderText(/25-year-old woman/);
    fireEvent.change(charTextarea, { target: { value: 'A tall woman with red hair' } });

    // Enter prompt
    const promptTextarea = screen.getByPlaceholderText(/red-haired astronaut/);
    fireEvent.change(promptTextarea, { target: { value: 'Test scene' } });

    const pipelineButton = screen.getByRole('button', { name: /run pipeline/i });
    fireEvent.click(pipelineButton);

    await waitFor(() => {
      expect(api.generateCharacterViewApi).toHaveBeenCalledTimes(4);
    });
  });

  it('shows regenerate button when anchor exists', () => {
    const anchor = {
      id: 'test-id',
      description: 'Test character',
      sheetUrl: 'https://example.com/sheet.png',
      viewUrls: {},
    };
    render(<PromptOptimizeStep {...defaultProps} characterAnchor={anchor} />);
    expect(screen.getByRole('button', { name: /regenerate character anchor/i })).toBeInTheDocument();
  });

  it('calls onNext when next button clicked with image prompt', () => {
    const clipWithPrompt = {
      id: 'clip-1',
      imagePrompt: 'Optimized image prompt',
      videoPrompt: 'Optimized video prompt',
    };
    render(<PromptOptimizeStep {...defaultProps} activeClip={clipWithPrompt} />);
    const nextButton = screen.getByRole('button', { name: /step 2: generate image/i });
    fireEvent.click(nextButton);
    expect(defaultProps.onNext).toHaveBeenCalled();
  });

  it('disables next button when no image prompt', () => {
    render(<PromptOptimizeStep {...defaultProps} />);
    const nextButton = screen.getByRole('button', { name: /step 2: generate image/i });
    expect(nextButton).toBeDisabled();
  });
});
