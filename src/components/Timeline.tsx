/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from "react";
import { Film, ListOrdered, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Sparkles, Volume2, Download, Subtitles, Layers, RefreshCw, Plus, GripVertical, Upload, ExternalLink } from "lucide-react";
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [editingVideoUrl, setEditingVideoUrl] = useState<Record<string, string>>({});

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
      onUpdateState({ activeClipId: newClips[0]?.id || null });
    }
  };

  // Insert a new blank clip at a specific index
  const handleInsertAtIndex = (index: number) => {
    const newId = `clip_${Date.now()}`;
    const newClip: VideoClip = {
      id: newId,
      imagePrompt: "",
      videoPrompt: "",
      subtitle: "",
    };
    const newClips = [...clips];
    newClips.splice(index, 0, newClip);
    onSetClips(newClips);
    onSelectClip(newId);
  };

  // Drag and drop reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIndex(index);
  };

  const handleDragLeave = () => {
    setDropIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const newClips = [...clips];
    const [draggedClip] = newClips.splice(dragIndex, 1);
    newClips.splice(targetIndex, 0, draggedClip);
    onSetClips(newClips);
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleSubtitleChange = (index: number, val: string) => {
    const newClips = [...clips];
    newClips[index].subtitle = val;
    onSetClips(newClips);
  };

  // Handle manual video URL paste for a specific clip
  const handleVideoUrlChange = (clipId: string, url: string) => {
    setEditingVideoUrl(prev => ({ ...prev, [clipId]: url }));
  };

  const handleApplyVideoUrl = (clipId: string) => {
    const url = editingVideoUrl[clipId];
    if (!url?.trim()) return;

    const cleanUrl = url.trim();
    const cacheBustedUrl = `${cleanUrl}${cleanUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;

    const newClips = clips.map(clip =>
      clip.id === clipId ? { ...clip, videoUrl: cacheBustedUrl } : clip
    );
    onSetClips(newClips);
    setEditingVideoUrl(prev => {
      const next = { ...prev };
      delete next[clipId];
      return next;
    });
  };

  const handleCompile = async () => {
    const validClips = clips.filter((c) => c.videoUrl);
    if (validClips.length === 0) {
      setError("请至少为一个片段生成或粘贴视频 URL 后再合并。");
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
      setError(err.message || "编译视频时出错。");
    } finally {
      onUpdateState({ isMerging: false });
    }
  };

  return (
    <div className="bg-[#161618] rounded-2xl border border-white/5 p-6 space-y-6" id="timeline-component">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">4. 时间线 — 合并与导出</h2>
          <p className="text-sm text-slate-400 mt-1">
            拖拽排序片段，任意位置插入场景，或直接粘贴视频 URL。
          </p>
        </div>
        <div className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
          <Layers className="w-3 h-3" />
          序列编辑器
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 text-red-400 rounded-xl text-sm border border-red-900/30 flex items-center gap-2">
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column: Timeline Items (7 Cols) */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-orange-500" />
              视频片段（{clips.length} 个场景）
            </h3>
            <button
              onClick={() => handleInsertAtIndex(clips.length)}
              className="px-3 py-1.5 bg-slate-800/60 hover:bg-slate-750 border border-white/5 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Scene at End
            </button>
          </div>

          <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
            {clips.map((clip, index) => {
              const isActive = state.activeClipId === clip.id;
              const isDragging = dragIndex === index;
              const isDropTarget = dropIndex === index;

              return (
                <div key={clip.id} className="space-y-1">
                  {/* Insert button between clips */}
                  {index > 0 && (
                    <div className="flex items-center justify-center py-0.5">
                      <button
                        onClick={() => handleInsertAtIndex(index)}
                        className="w-full py-0.5 text-[10px] text-slate-600 hover:text-orange-400 hover:bg-orange-500/5 rounded transition-all flex items-center justify-center gap-1 opacity-0 hover:opacity-100 group"
                        title="在此插入场景"
                      >
                        <Plus className="w-3 h-3" />
                        插入场景
                      </button>
                    </div>
                  )}

                  {/* Clip card with drag handle */}
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onSelectClip(clip.id)}
                    className={`
                      p-4 rounded-xl border transition-all cursor-pointer flex gap-3 items-start
                      ${isActive
                        ? "border-orange-500/40 bg-orange-500/10 shadow-sm"
                        : isDropTarget
                        ? "border-orange-300/40 bg-orange-500/5"
                        : "border-white/5 bg-[#1a1a1c] hover:border-white/10"
                      }
                      ${isDragging ? "opacity-50 scale-[0.98]" : ""}
                    `}
                  >
                    {/* Drag handle */}
                    <div className="flex-shrink-0 flex items-center justify-center w-6 pt-1">
                      <GripVertical className="w-4 h-4 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing" />
                    </div>

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

                    {/* Clip Info & Direct Editing */}
                    <div className="flex-grow space-y-2 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${
                          clip.videoUrl ? "text-green-400" : "text-yellow-400"
                        }`}>
                          {clip.videoUrl ? "✓ Video Ready" : "⚠ Draft — Needs Video"}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleMoveUp(index, e)}
                            disabled={index === 0}
                            className="p-1 hover:bg-white/5 text-slate-500 hover:text-slate-200 disabled:opacity-30 rounded transition-colors"
                            title="上移"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleMoveDown(index, e)}
                            disabled={index === clips.length - 1}
                            className="p-1 hover:bg-white/5 text-slate-500 hover:text-slate-200 disabled:opacity-30 rounded transition-colors"
                            title="下移"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(index, e)}
                            className="p-1 hover:bg-red-950/30 text-slate-500 hover:text-red-400 rounded transition-colors"
                            title="删除场景"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Subtitle input */}
                      <input
                        type="text"
                        className="w-full px-3 py-1.5 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
                        placeholder="此场景的字幕/旁白..."
                        value={clip.subtitle || ""}
                        onChange={(e) => handleSubtitleChange(index, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />

                      {/* Manual Video URL paste */}
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="flex-1 min-w-0 px-2 py-1 bg-[#1f1f22] border border-white/5 rounded-lg text-[10px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/30 font-mono"
                          placeholder={clip.videoUrl || "粘贴视频 URL..."}
                          value={editingVideoUrl[clip.id] || ""}
                          onChange={(e) => handleVideoUrlChange(clip.id, e.target.value)}
                        />
                        {editingVideoUrl[clip.id] && (
                          <button
                            onClick={() => handleApplyVideoUrl(clip.id)}
                            className="px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded text-[10px] font-semibold transition-colors flex items-center gap-1"
                            title="应用 URL 作为片段视频"
                          >
                            <Upload className="w-3 h-3" />
                            Set
                          </button>
                        )}
                        {clip.videoUrl && (
                          <a
                            href={clip.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-500 hover:text-green-400 transition-colors"
                            title="打开视频"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Final "Add Scene" at end */}
            <div className="pt-2">
              <button
                onClick={() => handleInsertAtIndex(clips.length)}
                className="w-full py-2 border border-dashed border-white/10 hover:border-orange-500/30 hover:bg-orange-500/5 rounded-xl text-xs text-slate-500 hover:text-orange-400 transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3 h-3" />
                添加新场景（结尾）
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Audio & Final Compilation Preview (5 Cols) */}
        <div className="xl:col-span-5 space-y-5">
          <div className="bg-[#1a1a1c] border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-orange-500" />
              配音与字幕设置
            </h3>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                配音语言
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
                  中文配音
                </button>
                <button
                  onClick={() => setLang("en")}
                  className={`py-2 text-xs font-medium rounded-xl border text-center transition-all cursor-pointer ${
                    lang === "en"
                      ? "border-orange-500/40 bg-orange-500/10 text-orange-400 font-bold"
                      : "border-white/10 bg-[#1f1f22] text-slate-400 hover:border-white/20"
                  }`}
                >
                  英文配音
                </button>
              </div>
            </div>

            <button
              onClick={handleCompile}
              disabled={state.isMerging || clips.filter(c => c.videoUrl).length === 0}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 disabled:bg-[#1f1f22] disabled:text-slate-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {state.isMerging ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  正在合并视频...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-orange-300" />
                  合并、配音、导出完整视频
                </>
              )}
            </button>

            {clips.filter(c => c.videoUrl).length === 0 && (
              <p className="text-[10px] text-slate-500 text-center">
                请为上方的片段生成或粘贴视频 URL 以启用编译。
              </p>
            )}
          </div>

          {/* Master Output Video Player */}
          {state.mergedVideoUrl && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Subtitles className="w-4 h-4 text-emerald-500" />
                合并预览
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
                  下载完整 MP4
                </a>
                {state.mergedSubtitlesUrl && (
                  <a
                    href={state.mergedSubtitlesUrl}
                    download="subtitles.vtt"
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="下载字幕文件"
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