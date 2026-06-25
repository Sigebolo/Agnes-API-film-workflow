/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowState } from "../types";

const STORAGE_KEY = "agnes_workflow_v2";
const LEGACY_API_KEY = "agnes_api_key_v2";

const DEFAULT_CLIP = {
  id: "clip_initial_1",
  imagePrompt: "",
  videoPrompt: "",
  subtitle: "",
};

function getDefaultState(): WorkflowState {
  return {
    apiKey: "",
    clips: [DEFAULT_CLIP],
    activeClipId: DEFAULT_CLIP.id,
    currentStep: "prompt",
    characterAnchor: null,
    mergedVideoUrl: null,
    mergedSubtitlesUrl: null,
    mergedVoiceoverUrl: null,
    isMerging: false,
  };
}

export function saveWorkflow(state: WorkflowState): void {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (err) {
    console.warn("[Storage] Failed to save workflow state:", err);
  }
}

export function loadWorkflow(): Partial<WorkflowState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return migrateLegacyState(parsed);
  } catch {
    return null;
  }
}

export function migrateLegacyState(raw: any): Partial<WorkflowState> {
  const state: Partial<WorkflowState> = {};

  if (raw.apiKey) state.apiKey = raw.apiKey;
  if (Array.isArray(raw.clips) && raw.clips.length > 0) state.clips = raw.clips;
  if (raw.activeClipId) state.activeClipId = raw.activeClipId;
  if (raw.currentStep) state.currentStep = raw.currentStep;
  if (raw.characterAnchor) state.characterAnchor = raw.characterAnchor;
  if (raw.mergedVideoUrl) state.mergedVideoUrl = raw.mergedVideoUrl;
  if (raw.mergedSubtitlesUrl) state.mergedSubtitlesUrl = raw.mergedSubtitlesUrl;
  if (raw.mergedVoiceoverUrl) state.mergedVoiceoverUrl = raw.mergedVoiceoverUrl;
  if (typeof raw.isMerging === "boolean") state.isMerging = raw.isMerging;

  if (!state.apiKey && typeof window !== "undefined") {
    const legacyKey = localStorage.getItem(LEGACY_API_KEY);
    if (legacyKey) state.apiKey = legacyKey;
  }

  return state;
}
