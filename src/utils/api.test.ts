import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  optimizePromptApi,
  generateImageApi,
  generateCharacterSheetApi,
  generateCharacterViewApi,
  createVideoTaskApi,
  pollVideoStatusApi,
} from './api';

describe('API Functions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('optimizePromptApi', () => {
    it('should return optimized prompt on success', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'optimized prompt text' } }],
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await optimizePromptApi('test-key', 'test prompt', 'image');

      expect(result).toBe('optimized prompt text');
      expect(fetch).toHaveBeenCalledWith('/api/proxy/chat', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
        }),
      }));
    });

    it('should throw error on API failure', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid prompt' }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await expect(optimizePromptApi('test-key', 'test', 'image')).rejects.toThrow('Invalid prompt');
    });

    it('should throw error on empty response', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ choices: [] }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await expect(optimizePromptApi('test-key', 'test', 'image')).rejects.toThrow('empty prompt');
    });

    it('should send video mode prompt when mode is video', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'video prompt' } }],
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await optimizePromptApi('test-key', 'test', 'video');

      const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
      expect(callBody.messages[0].content).toContain('Camera Movement');
    });
  });

  describe('generateImageApi', () => {
    it('should return image URL on success', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: [{ url: 'https://example.com/image.png' }],
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await generateImageApi('test-key', 'test prompt');

      expect(result).toBe('https://example.com/image.png');
    });

    it('should include image and strength for img2img', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: [{ url: 'https://example.com/img2img.png' }],
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await generateImageApi('test-key', 'test', '1024x768', 'https://ref.com/img.jpg', 0.6);

      const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
      expect(callBody.image).toBe('https://ref.com/img.jpg');
      expect(callBody.strength).toBe(0.6);
    });

    it('should throw error when no image URL returned', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ data: [] }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await expect(generateImageApi('test-key', 'test')).rejects.toThrow('No image URL');
    });
  });

  describe('generateCharacterSheetApi', () => {
    it('should return character sheet URL', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: [{ url: 'https://example.com/sheet.png' }],
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await generateCharacterSheetApi('test-key', 'brown hair, blue eyes');

      expect(result).toBe('https://example.com/sheet.png');
    });

    it('should include character description in prompt', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: [{ url: 'https://example.com/sheet.png' }],
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await generateCharacterSheetApi('test-key', 'tall woman with red hair');

      const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
      expect(callBody.prompt).toContain('tall woman with red hair');
      expect(callBody.prompt).toContain('character turnaround reference sheet');
    });
  });

  describe('generateCharacterViewApi', () => {
    it('should generate front view', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: [{ url: 'https://example.com/front.png' }],
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await generateCharacterViewApi('test-key', 'test desc', 'front');

      expect(result).toBe('https://example.com/front.png');
      const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
      expect(callBody.prompt).toContain('front view');
    });

    it('should use reference image for img2img when provided', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: [{ url: 'https://example.com/side.png' }],
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await generateCharacterViewApi('test-key', 'desc', 'side', 'https://ref.com/sheet.png');

      const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
      expect(callBody.image).toBe('https://ref.com/sheet.png');
      expect(callBody.strength).toBe(0.6);
    });
  });

  describe('createVideoTaskApi', () => {
    it('should return video_id and task_id', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          video_id: 'vid-123',
          task_id: 'task-456',
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await createVideoTaskApi('test-key', 'video prompt', 'https://img.com/img.png');

      expect(result).toEqual({ video_id: 'vid-123', task_id: 'task-456' });
    });

    it('should include image URL for img2video', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ video_id: 'vid-123' }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await createVideoTaskApi('test-key', 'prompt', 'https://img.com/img.png');

      const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
      expect(callBody.image).toBe('https://img.com/img.png');
    });

    it('should throw error on failure', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await expect(createVideoTaskApi('test-key', 'prompt')).rejects.toThrow('Server error');
    });
  });

  describe('pollVideoStatusApi', () => {
    it('should return video URL when completed', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          status: 'completed',
          urls: ['https://example.com/video.mp4'],
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await pollVideoStatusApi('test-key', 'vid-123');

      expect(result).toBe('https://example.com/video.mp4');
    });

    it('should throw when no video_id or task_id provided', async () => {
      await expect(pollVideoStatusApi('test-key')).rejects.toThrow('Either video_id or task_id');
    });

    it('should throw on failed status', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          status: 'failed',
          error: 'Generation failed',
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await expect(pollVideoStatusApi('test-key', 'vid-123')).rejects.toThrow('Generation failed');
    });
  });
});
