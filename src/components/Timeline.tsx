/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Film, ListOrdered, Trash2, ArrowUp, ArrowDown, Sparkles, Volume2, Download, Subtitles, Layers, RefreshCw } from "lucide-react";
import { VideoClip, WorkflowState } from "../types";
import { mergeClipsApi } from "../utils/api";

interface TimelineProps {
  apiKey: string;
  clips: VideoClip[];
  onSetClips: (clips: VideoClip[]) => void;
  onSelectClip: (clipId: string) => void;
  onAddBlankClip: () => void;
  state: WorkflowState;
  onUpdateState: (updates: Partial<WorkflowState>) => void;
}

export default function Timeline({
  apiKey,
  clips,
  onSetClips,
  onSelectClip,
  onAddBlankClip,
  state,
  onUpdateState,
}: TimelineProps) {
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const [error, setError] = useState<string | null>(null);

  const handleMoveUp = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === 0) return;
    const newClips = [...clips];
    const temp = newClips[index];
    newClips[index] = newClips[index - 1];
    newClips[index - 1] = temp;
    onSetClips(newClips);
  };

  const handleMoveDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === clips.length - 1) return;
    const newClips = [...clips];
    const temp = newClips[index];
    newClips[index] = newClips[index + 1];
    newClips[index + 1] = temp;
    onSetClips(newClips);
  };

  const handleDelete = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (clips.length <= 1) {
      setError("You must have at least one clip in your project.");
      return;
    }
    const clipToDelete = clips[index];
    const newClips = clips.filter((_, idx) => idx !== index);
    onSetClips(newClips);
    
    if (state.activeClipId === clipToDelete.id) {
      onUpdateState({ activeClipId: newClips[0].id });
    }
  };

  const handleSubtitleChange = (index: number, val: string) => {
    const newClips = [...clips];
    newClips[index].subtitle = val;
    onSetClips(newClips);
  };

  const handleCompile = async () => {
    const validClips = clips.filter((c) => c.videoUrl);
    if (validClips.length === 0) {
      setError("Please generate video files for at least one clip before merging.");
      return;
    }

    onUpdateState({ isMerging: true });
    setError(null);

    try {
      const response = await mergeClipsApi(validClips, lang);
      onUpdateState({
        mergedVideoUrl: response.videoUrl,
        mergedSubtitlesUrl: response.subtitlesUrl,
        mergedVoiceoverUrl: response.voiceoverUrl,
      });
    } catch (err: any) {
      setError(err.message || "An error occurred while compiling your video.");
    } finally {
      onUpdateState({ isMerging: false });
    }
  };

  return (
    <div className="bg-[#161618] rounded-2xl border border-white/5 p-6 space-y-6" id="timeline-component">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">4. Compile Master Movie</h2>
          <p className="text-sm text-slate-400 mt-1">
            Arrange generated clips, edit local speech/subtitles, and merge them into a single high-quality film.
          </p>
        </div>
        <div className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
          <Layers className="w-3 h-3" />
          Sequence Editor
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 text-red-400 rounded-xl text-sm border border-red-900/30">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column: Timeline Items (7 Cols) */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-orange-500" />
              Clip Timeline ({clips.length} scenes)
            </h3>
            <button
              onClick={onAddBlankClip}
              className="px-3 py-1.5 bg-slate-800/60 hover:bg-slate-750 border border-white/5 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
            >
              + Add Scene Segment
            </button>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {clips.map((clip, index) => {
              const isActive = state.activeClipId === clip.id;
              return (
                <div
                  key={clip.id}
                  onClick={() => onSelectClip(clip.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex gap-4 items-start ${
                    isActive
                      ? "border-orange-500/40 bg-orange-500/10 shadow-sm"
                      : "border-white/5 bg-[#1a1a1c] hover:border-white/10"
                  }`}
                >
                  {/* Clip Thumbnail Preview */}
                  <div className="w-24 h-16 bg-[#1f1f22] rounded-lg overflow-hidden border border-white/5 flex-shrink-0 flex items-center justify-center relative">
                    {clip.imageUrl ? (
                      <img
                        src={clip.imageUrl}
                        alt="Scene thumbnail"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-80"
                      />
                    ) : (
                      <Film className="w-6 h-6 text-slate-500" />
                    )}
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-medium">
                      Scene #{index + 1}
                    </span>
                  </div>

                  {/* Clip Info & Direct Subtitle Editing */}
                  <div className="flex-grow space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">
                        {clip.videoUrl ? "✓ Video Generated" : "⚠ Draft / Needs Rendering"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleMoveUp(index, e)}
                          disabled={index === 0}
                          className="p-1 hover:bg-white/5 text-slate-500 hover:text-slate-200 disabled:opacity-30 rounded transition-colors"
                          title="Move Scene Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleMoveDown(index, e)}
                          disabled={index === clips.length - 1}
                          className="p-1 hover:bg-white/5 text-slate-500 hover:text-slate-200 disabled:opacity-30 rounded transition-colors"
                          title="Move Scene Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(index, e)}
                          className="p-1 hover:bg-red-950/30 text-slate-500 hover:text-red-400 rounded transition-colors"
                          title="Delete Scene"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      className="w-full px-3 py-1.5 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
                      placeholder="Enter subtitle narration line for this scene..."
                      value={clip.subtitle || ""}
                      onChange={(e) => handleSubtitleChange(index, e.target.value)}
                      onClick={(e) => e.stopPropagation()} // Keep focus on input without swapping clip step
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Audio & Final Compilation Preview (5 Cols) */}
        <div className="xl:col-span-5 space-y-5">
          <div className="bg-[#1a1a1c] border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-orange-500" />
              Voiceover & Subtitle Presets
            </h3>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Narration Speech Language
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => setLang("zh")}
                  className={`py-2 text-xs font-medium rounded-xl border text-center transition-all cursor-pointer ${
                    lang === "zh"
                      ? "border-orange-500/40 bg-orange-500/10 text-orange-400 font-bold"
                      : "border-white/10 bg-[#1f1f22] text-slate-400 hover:border-white/20"
                  }`}
                >
                  Chinese Voiceover (中文配音)
                </button>
                <button
                  onClick={() => setLang("en")}
                  className={`py-2 text-xs font-medium rounded-xl border text-center transition-all cursor-pointer ${
                    lang === "en"
                      ? "border-orange-500/40 bg-orange-500/10 text-orange-400 font-bold"
                      : "border-white/10 bg-[#1f1f22] text-slate-400 hover:border-white/20"
                  }`}
                >
                  English Voiceover (英文配音)
                </button>
              </div>
            </div>

            <button
              onClick={handleCompile}
              disabled={state.isMerging}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 disabled:bg-[#1f1f22] disabled:text-slate-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {state.isMerging ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  Compiling & Stitching video...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-orange-300" />
                  Stitch, Dub, & Render Long Video
                </>
              )}
            </button>
          </div>

          {/* Master Output Video Player */}
          {state.mergedVideoUrl && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Subtitles className="w-4 h-4 text-emerald-500" />
                Compiled Masterpiece Preview
              </h4>
              <div className="rounded-2xl overflow-hidden border border-white/5 bg-[#09090A] aspect-video relative">
                <video
                  src={state.mergedVideoUrl}
                  controls
                  playsInline
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain"
                  id="final-video-element"
                >
                  {state.mergedSubtitlesUrl && (
                    <track
                      src={state.mergedSubtitlesUrl}
                      kind="subtitles"
                      srcLang={lang}
                      label={lang === "zh" ? "中文" : "English"}
                      default
                    />
                  )}
                </video>
              </div>

              <div className="flex gap-2">
                <a
                  href={state.mergedVideoUrl}
                  download="agnes_final_movie.mp4"
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-orange-950/20 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Complete MP4
                </a>
                {state.mergedSubtitlesUrl && (
                  <a
                    href={state.mergedSubtitlesUrl}
                    download="subtitles.vtt"
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Download VTT Subtitle File"
                  >
                    WebVTT
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
