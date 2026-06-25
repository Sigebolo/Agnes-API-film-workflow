import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImageGenerateStep from './ImageGenerateStep';
import * as api from '../utils/api';

vi.mock('../utils/api', () => ({
  generateImageApi: vi.fn(),
}));

describe('ImageGenerateStep - 生图流程', () => {
  const defaultProps = {
    apiKey: 'test-key',
    activeClip: {
      id: 'clip-1',
      imagePrompt: 'A red-haired astronaut on Mars',
      videoPrompt: 'Slow pan right',
    },
    characterAnchor: null,
    onUpdateClip: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToast: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初始状态显示空画布提示', () => {
    render(<ImageGenerateStep {...defaultProps} />);
    expect(screen.getByText('No keyframe generated yet')).toBeInTheDocument();
  });

  it('点击生成后显示 Job ID 格式', async () => {
    vi.mocked(api.generateImageApi).mockResolvedValue('https://example.com/img.png');

    render(<ImageGenerateStep {...defaultProps} />);

    const genButton = screen.getByRole('button', { name: /generate keyframe/i });
    fireEvent.click(genButton);

    await waitFor(() => {
      expect(screen.getByText(/Dispatched job ID: IMG-/)).toBeInTheDocument();
    });
  });

  it('生成过程中显示 Pipeline Logs 标题', async () => {
    vi.mocked(api.generateImageApi).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('https://example.com/img.png'), 2000))
    );

    render(<ImageGenerateStep {...defaultProps} />);

    const genButton = screen.getByRole('button', { name: /generate keyframe/i });
    fireEvent.click(genButton);

    await waitFor(() => {
      expect(screen.getByText('PIPELINE LOGS')).toBeInTheDocument();
      expect(screen.getByText('LIVE TRACKING')).toBeInTheDocument();
    });
  });

  it('生成成功后触发 Toast 通知', async () => {
    vi.mocked(api.generateImageApi).mockResolvedValue('https://example.com/img.png');

    render(<ImageGenerateStep {...defaultProps} />);

    const genButton = screen.getByRole('button', { name: /generate keyframe/i });
    fireEvent.click(genButton);

    await waitFor(() => {
      expect(defaultProps.onToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          message: expect.stringContaining('Image generated successfully'),
        })
      );
    });
  });

  it('生成失败后显示错误信息和 Toast', async () => {
    vi.mocked(api.generateImageApi).mockRejectedValue(new Error('Rate limit exceeded'));

    render(<ImageGenerateStep {...defaultProps} />);

    const genButton = screen.getByRole('button', { name: /generate keyframe/i });
    fireEvent.click(genButton);

    await waitFor(() => {
      // 错误信息显示在 inline error 区域和 error panel 中
      const errorElements = screen.getAllByText('Rate limit exceeded');
      expect(errorElements.length).toBeGreaterThanOrEqual(1);
      // Toast 通知
      expect(defaultProps.onToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('Rate limit exceeded'),
        })
      );
    });
  });

  it('失败后显示重试按钮', async () => {
    vi.mocked(api.generateImageApi).mockRejectedValue(new Error('Network error'));

    render(<ImageGenerateStep {...defaultProps} />);

    const genButton = screen.getByRole('button', { name: /generate keyframe/i });
    fireEvent.click(genButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('生成中按钮显示 Loading 状态', async () => {
    vi.mocked(api.generateImageApi).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('https://example.com/img.png'), 1000))
    );

    render(<ImageGenerateStep {...defaultProps} />);

    const genButton = screen.getByRole('button', { name: /generate keyframe/i });
    fireEvent.click(genButton);

    await waitFor(() => {
      expect(screen.getByText(/Agnes Generating Base Image/)).toBeInTheDocument();
    });
  });

  it('task ID 持久化到 clip 状态', async () => {
    vi.mocked(api.generateImageApi).mockResolvedValue('https://example.com/img.png');

    render(<ImageGenerateStep {...defaultProps} />);

    const genButton = screen.getByRole('button', { name: /generate keyframe/i });
    fireEvent.click(genButton);

    await waitFor(() => {
      expect(defaultProps.onUpdateClip).toHaveBeenCalledWith(
        expect.objectContaining({
          imageTaskId: expect.stringMatching(/^IMG-/),
        })
      );
    });
  });

  it('成功后持久化图片 URL 到 clip', async () => {
    vi.mocked(api.generateImageApi).mockResolvedValue('https://example.com/img.png');

    render(<ImageGenerateStep {...defaultProps} />);

    const genButton = screen.getByRole('button', { name: /generate keyframe/i });
    fireEvent.click(genButton);

    await waitFor(() => {
      expect(defaultProps.onUpdateClip).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: expect.stringContaining('https://example.com/img.png'),
        })
      );
    });
  });

  it('有角色锚点时显示引用日志', async () => {
    const anchor = {
      id: 'anchor-1',
      description: 'Red hair woman',
      sheetUrl: 'https://example.com/sheet.png',
      viewUrls: {},
    };

    vi.mocked(api.generateImageApi).mockResolvedValue('https://example.com/img.png');

    render(<ImageGenerateStep {...defaultProps} characterAnchor={anchor} />);

    const genButton = screen.getByRole('button', { name: /generate keyframe/i });
    fireEvent.click(genButton);

    await waitFor(() => {
      expect(screen.getByText(/Using character anchor as reference/)).toBeInTheDocument();
    });
  });
});
