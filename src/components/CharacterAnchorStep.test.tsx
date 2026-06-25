import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharacterAnchorStep from './CharacterAnchorStep';
import * as api from '../utils/api';

vi.mock('../utils/api', () => ({
  generateCharacterSheetApi: vi.fn(),
  generateCharacterViewApi: vi.fn(),
  optimizePromptApi: vi.fn(),
}));

describe('CharacterAnchorStep', () => {
  const defaultProps = {
    apiKey: 'test-key',
    characterAnchor: null,
    onSetCharacterAnchor: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToast: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step title and description', () => {
    render(<CharacterAnchorStep {...defaultProps} />);

    expect(screen.getByText('1.5 Character Anchor')).toBeInTheDocument();
    expect(screen.getByText(/multi-angle character reference/)).toBeInTheDocument();
  });

  it('calls onPrev when back button clicked', () => {
    render(<CharacterAnchorStep {...defaultProps} />);

    // Back button is the arrow-left icon button
    const backButton = screen.getAllByRole('button')[0];
    fireEvent.click(backButton);

    expect(defaultProps.onPrev).toHaveBeenCalled();
  });

  it('disables generate button when description is empty', () => {
    render(<CharacterAnchorStep {...defaultProps} />);

    const generateButton = screen.getByRole('button', { name: /generate character anchor/i });
    expect(generateButton).toBeDisabled();
  });

  it('enables generate button when description is provided', () => {
    render(<CharacterAnchorStep {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/25-year-old East Asian woman/);
    fireEvent.change(textarea, { target: { value: 'A tall woman with red hair' } });

    const generateButton = screen.getByRole('button', { name: /generate character anchor/i });
    expect(generateButton).toBeEnabled();
  });

  it('calls generateCharacterSheetApi on generate with single sheet mode', async () => {
    vi.mocked(api.generateCharacterSheetApi).mockResolvedValue('https://example.com/sheet.png');

    render(<CharacterAnchorStep {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/25-year-old East Asian woman/);
    fireEvent.change(textarea, { target: { value: 'Red hair, blue eyes' } });

    const generateButton = screen.getByRole('button', { name: /generate character anchor/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(api.generateCharacterSheetApi).toHaveBeenCalledWith('test-key', 'Red hair, blue eyes');
    });
  });

  it('calls onSetCharacterAnchor with generated sheet URL', async () => {
    vi.mocked(api.generateCharacterSheetApi).mockResolvedValue('https://example.com/sheet.png');

    render(<CharacterAnchorStep {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/25-year-old East Asian woman/);
    fireEvent.change(textarea, { target: { value: 'Red hair, blue eyes' } });

    const generateButton = screen.getByRole('button', { name: /generate character anchor/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(defaultProps.onSetCharacterAnchor).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Red hair, blue eyes',
          sheetUrl: expect.stringContaining('https://example.com/sheet.png'),
        })
      );
    });
  });

  it('shows error toast on generation failure', async () => {
    vi.mocked(api.generateCharacterSheetApi).mockRejectedValue(new Error('API failed'));

    render(<CharacterAnchorStep {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/25-year-old East Asian woman/);
    fireEvent.change(textarea, { target: { value: 'Test' } });

    const generateButton = screen.getByRole('button', { name: /generate character anchor/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(defaultProps.onToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('API failed'),
        })
      );
    });
  });

  it('shows character anchor when provided', () => {
    const anchor = {
      id: 'test-id',
      description: 'Red hair character',
      sheetUrl: 'https://example.com/existing.png',
      viewUrls: {},
    };

    render(<CharacterAnchorStep {...defaultProps} characterAnchor={anchor} />);

    // Description appears in both textarea and preview, so use getAllByText
    const descriptions = screen.getAllByText('Red hair character');
    expect(descriptions.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByAltText('Character reference sheet')).toHaveAttribute(
      'src',
      expect.stringContaining('https://example.com/existing.png')
    );
  });

  it('calls onNext when next button clicked with anchor', () => {
    const anchor = {
      id: 'test-id',
      description: 'Test',
      sheetUrl: 'https://example.com/img.png',
      viewUrls: {},
    };

    render(<CharacterAnchorStep {...defaultProps} characterAnchor={anchor} />);

    const nextButton = screen.getByRole('button', { name: /step 2: generate image/i });
    fireEvent.click(nextButton);

    expect(defaultProps.onNext).toHaveBeenCalled();
  });

  it('disables next button when no anchor', () => {
    render(<CharacterAnchorStep {...defaultProps} />);

    const nextButton = screen.getByRole('button', { name: /step 2: generate image/i });
    expect(nextButton).toBeDisabled();
  });

  it('switches to individual views mode', async () => {
    vi.mocked(api.generateCharacterViewApi).mockResolvedValue('https://example.com/view.png');

    render(<CharacterAnchorStep {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/25-year-old East Asian woman/);
    fireEvent.change(textarea, { target: { value: 'Test character' } });

    const individualButton = screen.getByRole('button', { name: /individual views/i });
    fireEvent.click(individualButton);

    const generateButton = screen.getByRole('button', { name: /generate character anchor/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(api.generateCharacterViewApi).toHaveBeenCalled();
    });
  });
});
