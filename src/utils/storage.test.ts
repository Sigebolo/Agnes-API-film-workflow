import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveWorkflow, loadWorkflow, migrateLegacyState } from './storage';
import { WorkflowState } from '../types';

const STORAGE_KEY = 'agnes_workflow_v2';

function createMockStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
}

let mockStorage: ReturnType<typeof createMockStorage>;

const fullState: WorkflowState = {
  apiKey: 'test-key-123',
  clips: [
    {
      id: 'clip-1',
      imagePrompt: 'A red-haired astronaut on Mars',
      videoPrompt: 'Slow pan-right',
      imageUrl: 'https://example.com/img.png',
      videoUrl: 'https://example.com/vid.mp4',
      subtitle: 'Hello world',
      imageTaskId: 'IMG-abc123',
      videoTaskId: 'VID-xyz789',
      imageTaskStatus: 'completed',
      videoTaskStatus: 'polling',
    },
  ],
  activeClipId: 'clip-1',
  currentStep: 'video',
  characterAnchor: {
    id: 'anchor-1',
    description: 'Red hair woman',
    sheetUrl: 'https://example.com/sheet.png',
    viewUrls: { front: 'https://example.com/front.png' },
  },
  mergedVideoUrl: 'https://example.com/merged.mp4',
  mergedSubtitlesUrl: 'https://example.com/subs.vtt',
  mergedVoiceoverUrl: 'https://example.com/voice.mp3',
  isMerging: false,
};

describe('storage', () => {
  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  describe('saveWorkflow + loadWorkflow 往返', () => {
    it('完整恢复所有字段', () => {
      saveWorkflow(fullState);
      const loaded = loadWorkflow();

      expect(loaded).not.toBeNull();
      expect(loaded!.apiKey).toBe('test-key-123');
      expect(loaded!.clips).toHaveLength(1);
      expect(loaded!.clips[0].id).toBe('clip-1');
      expect(loaded!.clips[0].imagePrompt).toBe('A red-haired astronaut on Mars');
      expect(loaded!.clips[0].videoPrompt).toBe('Slow pan-right');
      expect(loaded!.clips[0].imageUrl).toBe('https://example.com/img.png');
      expect(loaded!.clips[0].videoUrl).toBe('https://example.com/vid.mp4');
      expect(loaded!.clips[0].subtitle).toBe('Hello world');
      expect(loaded!.clips[0].imageTaskId).toBe('IMG-abc123');
      expect(loaded!.clips[0].videoTaskId).toBe('VID-xyz789');
      expect(loaded!.clips[0].imageTaskStatus).toBe('completed');
      expect(loaded!.clips[0].videoTaskStatus).toBe('polling');
      expect(loaded!.activeClipId).toBe('clip-1');
      expect(loaded!.currentStep).toBe('video');
      expect(loaded!.characterAnchor!.id).toBe('anchor-1');
      expect(loaded!.characterAnchor!.description).toBe('Red hair woman');
      expect(loaded!.mergedVideoUrl).toBe('https://example.com/merged.mp4');
      expect(loaded!.mergedSubtitlesUrl).toBe('https://example.com/subs.vtt');
      expect(loaded!.mergedVoiceoverUrl).toBe('https://example.com/voice.mp3');
      expect(loaded!.isMerging).toBe(false);
    });
  });

  describe('loadWorkflow edge cases', () => {
    it('空 localStorage 返回 null', () => {
      expect(loadWorkflow()).toBeNull();
    });

    it('损坏 JSON 返回 null 不抛异常', () => {
      mockStorage.setItem(STORAGE_KEY, '{invalid json!!!');
      expect(loadWorkflow()).toBeNull();
    });

    it('非对象 JSON 返回 null', () => {
      mockStorage.setItem(STORAGE_KEY, '"just a string"');
      expect(loadWorkflow()).toBeNull();
    });
  });

  describe('migrateLegacyState', () => {
    it('从旧格式提取 apiKey', () => {
      const legacy = { someOldField: 'value', apiKey: 'legacy-key' };
      const result = migrateLegacyState(legacy);
      expect(result.apiKey).toBe('legacy-key');
    });

    it('保留新格式所有字段', () => {
      const newFormat = {
        apiKey: 'new-key',
        clips: [{ id: 'c1', imagePrompt: 'test', videoPrompt: 'test' }],
        currentStep: 'image',
      };
      const result = migrateLegacyState(newFormat);
      expect(result.apiKey).toBe('new-key');
      expect(result.clips).toHaveLength(1);
      expect(result.currentStep).toBe('image');
    });

    it('缺失字段不设默认值', () => {
      const partial = { apiKey: 'key-only' };
      const result = migrateLegacyState(partial);
      expect(result.apiKey).toBe('key-only');
      expect(result.clips).toBeUndefined();
      expect(result.currentStep).toBeUndefined();
    });
  });

  describe('saveWorkflow quota exceeded', () => {
    it('超大 state 不抛异常', () => {
      mockStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const hugeState = {
        ...fullState,
        clips: Array.from({ length: 1000 }, (_, i) => ({
          id: `clip-${i}`,
          imagePrompt: 'x'.repeat(5000),
          videoPrompt: 'y'.repeat(5000),
        })),
      };
      expect(() => saveWorkflow(hugeState)).not.toThrow();
    });
  });
});
