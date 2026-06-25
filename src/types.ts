/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CharacterAnchor {
  id: string;
  description: string;
  sheetUrl: string;
  viewUrls: {
    front?: string;
    side?: string;
    back?: string;
    threeQuarter?: string;
  };
}

export interface VideoClip {
  id: string;
  imagePrompt: string;
  videoPrompt: string;
  imageUrl?: string;
  videoUrl?: string;
  subtitle?: string;
  duration?: number;
  voiceoverUrl?: string;
  imageTaskId?: string;
  videoTaskId?: string;
  useCharacterAnchor?: boolean;
}

export type AppStep = 'prompt' | 'character' | 'image' | 'video' | 'timeline';

export interface WorkflowState {
  apiKey: string;
  clips: VideoClip[];
  activeClipId: string | null;
  currentStep: AppStep;
  characterAnchor: CharacterAnchor | null;
  mergedVideoUrl: string | null;
  mergedSubtitlesUrl: string | null;
  mergedVoiceoverUrl: string | null;
  isMerging: boolean;
}
