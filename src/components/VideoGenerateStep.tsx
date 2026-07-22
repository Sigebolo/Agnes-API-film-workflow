/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Film, Sparkles, RefreshCw, ArrowLeft, Plus, ArrowRight, Hourglass, AlertTriangle, StopCircle, Link2 } from "lucide-react";
import { VideoClip } from "../types";
import { createVideoTaskApi, subscribeVideoProgress, saveTask, autoSaveVideo, extractLastFrameApi, framesForDuration } from "../utils/api";
import { compressImage, getImageSizeInfo } from "../utils/imageCompress";
import { ToastItem, createToast } from "./Toast";
import { t } from "../utils/locale";

interface VideoGenerateStepProps {
  apiKey: string;
  activeClip: VideoClip;
  onUpdateClip: (updates: Partial<VideoClip>) => void;
  onPrev: () => void;
  onSaveToTimeline: () => void;
  onGoToTimeline: () => void;
  /** Create next chain segment using this clip's last frame as reference */
  onContinueChain?: (lastFrameUrl: string) => void;
  /** Create a brand new independent clip (not chained) */
  onNewVideo?: () => void;
  onToast?: (toast: ToastItem) => void;
}

export default function VideoGenerateStep({
  apiKey,
  activeClip,
  onUpdateClip,
  onPrev,
  onSaveToTimeline,
  onGoToTimeline,
  onContinueChain,
  onNewVideo,
  onToast,
}: VideoGenerateStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoLogs, setVideoLogs] = useState<string[]>([]);
  const [pollStatus, setPollStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [subtitleText, setSubtitleText] = useState(activeClip.subtitle || "");
  const [isPolling, setIsPolling] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState<number>(activeClip.duration || 15);
  const [isExtractingFrame, setIsExtractingFrame] = useState(false);
  const [chainHint, setChainHint] = useState<string | null>(null);
  const activeJobId = activeClip.videoTaskId || null;
  const wsRef = useRef<WebSocket | null>(null);
  const extractingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  // Sync subtitle / duration when switching active clip
  useEffect(() => {
    setSubtitleText(activeClip.subtitle || "");
    setVideoDuration(activeClip.duration || 15);
    setError(null);
    setChainHint(
      activeClip.chainIndex != null && activeClip.chainIndex > 0
        ? `Chain segment #${activeClip.chainIndex + 1} — reference is previous segment's last frame`
        : null
    );
  }, [activeClip.id]);

  useEffect(() => {
    if (activeClip.videoTaskStatus === "polling" && activeClip.videoTaskId && !activeClip.videoUrl) {
      if (!activeClip.videoTaskId.startsWith("sim_")) {
        connectWebSocket(activeClip.videoTaskId);
      }
    }
  }, [activeClip.videoTaskId]);

  const ensureLastFrame = async (
    videoUrl: string,
    existingFrameUrl?: string
  ): Promise<string | null> => {
    if (existingFrameUrl) return existingFrameUrl;
    if (extractingRef.current) return null;
    extractingRef.current = true;
    setIsExtractingFrame(true);
    try {
      setVideoLogs((prev) =>
        prev.some((l) => l.includes("last frame") || l.includes("Last frame"))
          ? prev
          : [...prev, "🎞️ Extracting last frame for chain continuity..."]
      );
      const result = await extractLastFrameApi(videoUrl);
      const frameUrl = result.publicUrl || result.frameUrl;
      if (frameUrl) {
        onUpdateClip({ lastFrameUrl: frameUrl });
        setVideoLogs((prev) => [...prev, "✅ Last frame ready — can continue next segment"]);
        if (onToast) onToast(createToast("info", "Last frame extracted for video chain"));
        return frameUrl;
      }
      return null;
    } catch (err: any) {
      console.error("Last frame extraction failed:", err);
      setVideoLogs((prev) => [
        ...prev,
        `⚠️ Last frame extract failed: ${err.message || err} (chain extend may be unavailable)`,
      ]);
      return null;
    } finally {
      extractingRef.current = false;
      setIsExtractingFrame(false);
    }
  };

  // If video exists but last frame missing, extract in background
  useEffect(() => {
    if (activeClip.videoUrl && !activeClip.lastFrameUrl && !extractingRef.current) {
      void ensureLastFrame(activeClip.videoUrl, activeClip.lastFrameUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when video/frame identity changes
  }, [activeClip.id, activeClip.videoUrl, activeClip.lastFrameUrl]);

  const connectWebSocket = (videoId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    if (videoId.startsWith("sim_")) {
      const errMsg =
        "Invalid task ID (simulated). This is not a real Agnes task. Please retry with a real API key.";
      setError(errMsg);
      setVideoLogs((prev) => [...prev, `❌ Error: ${errMsg}`, "⚠️ Render pipeline aborted."]);
      setPollStatus("");
      setIsGenerating(false);
      setIsVideoLoading(false);
      onUpdateClip({ videoTaskStatus: "failed" });
      if (onToast) onToast(createToast("error", errMsg));
      return;
    }

    const taskId = videoId;
    setIsGenerating(true);
    setIsVideoLoading(true);
    setVideoLogs((prev) =>
      prev.length > 0
        ? prev
        : ["🔄 Reconnecting to video generation...", `📡 Job ID: ${videoId}`]
    );

    const ws = subscribeVideoProgress(
      videoId,
      apiKey,
      taskId,
      (msg) => {
        setPollStatus(msg.message || "");
        if (msg.progress !== undefined) {
          setVideoProgress(msg.progress);
        }
        setVideoLogs((prev) => {
          const newLog = msg.message || "";
          if (!newLog || prev[prev.length - 1] === newLog) return prev;
          return [...prev, newLog];
        });
      },
      async (url) => {
        const cacheBustedUrl = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
        onUpdateClip({
          videoUrl: cacheBustedUrl,
          subtitle: subtitleText,
          videoTaskStatus: "completed",
        });
        setPollStatus("Success");
        setVideoProgress(100);
        setVideoLogs((prev) => [
          ...prev,
          "✅ Video rendering completed successfully!",
          "🎉 Cinematic motion clip synchronized.",
        ]);
        setIsGenerating(false);
        setIsVideoLoading(false);
        saveTask({ id: taskId, type: "video", status: "completed", videoUrl: cacheBustedUrl });
        autoSaveVideo(cacheBustedUrl, `video_${Date.now()}`);
        if (onToast) onToast(createToast("success", "Video generated successfully!"));

        // Auto-extract last frame so next segment can keep character/object consistency
        try {
          await ensureLastFrame(cacheBustedUrl);
        } catch (frameErr) {
          console.warn("Post-complete last-frame extract failed:", frameErr);
        }
      },
      (errMsg) => {
        setError(errMsg);
        setVideoLogs((prev) => [...prev, `❌ Error: ${errMsg}`, "⚠️ Render pipeline aborted."]);
        setPollStatus("");
        setVideoProgress(0);
        setIsGenerating(false);
        setIsVideoLoading(false);
        onUpdateClip({ videoTaskStatus: "failed" });
        saveTask({ id: taskId, type: "video", status: "failed", error: errMsg });
        if (onToast) onToast(createToast("error", `Video generation failed: ${errMsg}`));
      }
    );

    wsRef.current = ws;
  };

  const handleGenerateVideo = async () => {
    setIsGenerating(true);
    setIsVideoLoading(true);
    setError(null);
    setVideoProgress(0);
    setPollStatus("Submitting task to Agnes AI...");
    setVideoLogs([
      "🔄 Initializing video generation pipeline...",
      "📡 Constructing Frame-to-Video parameters...",
      "🌐 Preparing reference keyframe...",
    ]);

    try {
      let imageUrlToSend = activeClip.imageUrl;
      if (activeClip.imageUrl) {
        if (activeClip.imageUrl.startsWith("http")) {
          imageUrlToSend = activeClip.imageUrl;
          setVideoLogs((prev) => [...prev, "✅ Using image URL directly"]);
        } else if (activeClip.imageUrl.startsWith("/uploads/") || activeClip.imageUrl.startsWith("/outputs/")) {
          // Local path — convert to absolute for display; still need public URL for Agnes
          setVideoLogs((prev) => [...prev, "🌐 Local frame detected, re-uploading for public URL..."]);
          try {
            const abs = `${window.location.origin}${activeClip.imageUrl}`;
            const imgResp = await fetch(abs);
            const blob = await imgResp.blob();
            const reader = new FileReader();
            const base64: string = await new Promise((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            const compressed = await compressImage(base64, 2048, 0.95);
            const uploadResp = await fetch("/api/upload-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ base64: compressed, name: "video_ref" }),
            });
            const uploadData = await uploadResp.json();
            if (uploadData.url) {
              imageUrlToSend = uploadData.url;
              setVideoLogs((prev) => [...prev, "✅ Local frame uploaded as public URL"]);
            } else {
              setVideoLogs((prev) => [
                ...prev,
                "⚠️ Upload failed for local frame; Agnes may not accept localhost URLs",
              ]);
              imageUrlToSend = abs;
            }
          } catch (e: any) {
            setVideoLogs((prev) => [...prev, `⚠️ Local frame upload error: ${e.message}`]);
          }
        } else {
          try {
            const compressed = await compressImage(activeClip.imageUrl, 2048, 0.95);
            const sizeInfo = getImageSizeInfo(compressed);
            setVideoLogs((prev) => [
              ...prev,
              `📐 Image compressed: ${sizeInfo.sizeKB}KB (${sizeInfo.sizeMB}MB)`,
            ]);
            setVideoLogs((prev) => [...prev, "🌐 Uploading image to get public URL..."]);
            const uploadResp = await fetch("/api/upload-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ base64: compressed, name: "video_ref" }),
            });
            const uploadData = await uploadResp.json();
            if (uploadData.url) {
              imageUrlToSend = uploadData.url;
              setVideoLogs((prev) => [...prev, "✅ Image uploaded, using public URL"]);
            } else {
              setVideoLogs((prev) => [...prev, "⚠️ Upload failed, proceeding without image"]);
              imageUrlToSend = undefined;
            }
          } catch {
            setVideoLogs((prev) => [...prev, "⚠️ Compression failed, using original image"]);
          }
        }
      }

      setVideoLogs((prev) => [...prev, "🌐 Submitting reference keyframe to Agnes neural cluster..."]);

      const effectiveDuration = Math.min(videoDuration, 18);
      const frames = framesForDuration(effectiveDuration, 24);
      if (videoDuration > 18) {
        setVideoLogs((prev) => [
          ...prev,
          `⚠️ ${videoDuration}s capped to ${effectiveDuration}s (model max 441 frames). Use Continue Chain for longer.`,
        ]);
      }
      setVideoLogs((prev) => [...prev, `🎞 frames=${frames} (~${effectiveDuration}s @ 24fps)`]);

      let result: {
        video_id?: string;
        task_id?: string;
        poll_id?: string;
        poll_mode?: string;
      } | null = null;
      const MAX_SUBMIT_RETRIES = 5;
      const RETRY_DELAY_S = 30;
      for (let attempt = 1; attempt <= MAX_SUBMIT_RETRIES; attempt++) {
        try {
          result = await createVideoTaskApi(
            apiKey,
            activeClip.videoPrompt,
            imageUrlToSend,
            effectiveDuration
          );
          break;
        } catch (submitErr: any) {
          const is503 =
            submitErr.message?.includes("503") || submitErr.message?.includes("busy");
          if (is503 && attempt < MAX_SUBMIT_RETRIES) {
            for (let s = RETRY_DELAY_S; s > 0; s--) {
              setPollStatus(`Server busy, retrying in ${s}s (attempt ${attempt})...`);
              setVideoLogs((prev) => {
                const last = prev[prev.length - 1];
                const msg = `⏳ Server busy, retrying in ${s}s (attempt ${attempt})...`;
                if (last?.startsWith("⏳")) return [...prev.slice(0, -1), msg];
                return [...prev, msg];
              });
              await new Promise((r) => setTimeout(r, 1000));
            }
            continue;
          }
          throw submitErr;
        }
      }

      if (!result) {
        throw new Error("Submission failed: server busy after multiple retries, please try again later.");
      }

      // Prefer video_id for polling; task_id is legacy-only
      const resolvedJobId =
        result.poll_id ||
        result.video_id ||
        result.task_id ||
        "VID-" + Math.random().toString(36).substr(2, 9).toUpperCase();
      onUpdateClip({
        videoTaskId: resolvedJobId,
        videoTaskStatus: "polling",
        duration: effectiveDuration,
      });
      setVideoLogs((prev) => [
        ...prev,
        `✓ Task submitted successfully`,
        result?.video_id ? `🎬 video_id: ${result.video_id}` : null,
        result?.task_id ? `🪪 task_id: ${result.task_id}` : null,
        `🔎 Polling: ${resolvedJobId} (${result?.video_id ? "video_id" : "task_id"} mode)`,
        "⚙️ Generating video (often 2–8 minutes)...",
      ].filter(Boolean) as string[]);
      setPollStatus("Video task created, connecting...");

      saveTask({
        id: resolvedJobId,
        type: "video",
        prompt: activeClip.videoPrompt,
        imageUrl: imageUrlToSend,
        status: "queued",
        extra: { video_id: result.video_id, task_id: result.task_id },
      });

      connectWebSocket(resolvedJobId);
    } catch (err: any) {
      const errMsg = err.message || "An error occurred during video creation.";
      setError(errMsg);
      setVideoLogs((prev) => [...prev, `❌ Error: ${errMsg}`, "⚠️ Render pipeline aborted."]);
      setPollStatus("");
      setIsVideoLoading(false);
      setIsGenerating(false);
      onUpdateClip({ videoTaskStatus: "failed" });
      if (onToast) onToast(createToast("error", `Video generation failed: ${errMsg}`));
    }
  };

  const handleManualPoll = () => {
    if (!activeClip.videoTaskId) return;
    setIsPolling(true);
    setVideoLogs((prev) => [...prev, "🔄 Manual WebSocket reconnect triggered..."]);
    connectWebSocket(activeClip.videoTaskId);
    setIsPolling(false);
  };

  const handleCancel = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsGenerating(false);
    setIsVideoLoading(false);
    setPollStatus("");
    setError(null);
    onUpdateClip({ videoTaskStatus: "failed" });
  };

  const handleSaveClip = () => {
    onUpdateClip({ subtitle: subtitleText });
    onSaveToTimeline();
  };

  const handleContinueChain = async () => {
    if (!activeClip.videoUrl) return;
    let frameUrl = activeClip.lastFrameUrl;
    if (!frameUrl) {
      frameUrl = (await ensureLastFrame(activeClip.videoUrl, activeClip.lastFrameUrl)) || undefined;
    }
    if (!frameUrl) {
      if (onToast) {
        onToast(
          createToast(
            "error",
            "Could not extract last frame. Ensure ffmpeg is installed and try again."
          )
        );
      }
      return;
    }
    if (onContinueChain) {
      onContinueChain(frameUrl);
      if (onToast) {
        onToast(
          createToast(
            "success",
            "Next chain segment created — last frame is the new reference image"
          )
        );
      }
    }
  };

  const canContinueChain =
    !!activeClip.videoUrl && !!onContinueChain && !isGenerating && !isExtractingFrame;

  return (
    <div className="bg-[#161618] rounded-2xl border border-white/5 p-6 space-y-6" id="video-generate-step">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onPrev}
            className="p-1.5 hover:bg-white/5 text-slate-500 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">3. 图片转视频</h2>
            <p className="text-sm text-slate-400 mt-1">
              上传图片或拖拽到提示词区域，一键生成视频
            </p>
          </div>
        </div>
        <div className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Agnes Video
        </div>
      </div>

      {chainHint && (
        <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
          {chainHint}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/40 text-red-400 rounded-xl text-sm border border-red-900/30">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 左侧：图片和设置 */}
        <div className="lg:col-span-5 space-y-5">
          {/* 图片上传区域 */}
          {activeClip.imageUrl ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  参考图片
                </span>
                <label className="text-xs text-orange-400 hover:text-orange-300 cursor-pointer flex items-center gap-1">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const dataUrl = ev.target?.result as string;
                          const compressed = await compressImage(dataUrl, 2048, 0.95);
                          onUpdateClip({ imageUrl: compressed });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <RefreshCw className="w-3 h-3" />
                  更换图片
                </label>
              </div>
              <div className="border border-white/5 rounded-xl overflow-hidden shadow-inner max-h-48 bg-[#1a1a1c] flex items-center justify-center relative group">
                <img
                  src={activeClip.imageUrl}
                  alt="参考图片"
                  referrerPolicy="no-referrer"
                  className="w-full h-auto max-h-48 object-contain"
                />
                <button
                  onClick={() => onUpdateClip({ imageUrl: "" })}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="移除图片"
                >
                  <AlertTriangle className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-orange-500/30 hover:border-orange-500/60 rounded-xl p-8 text-center transition-all cursor-pointer bg-orange-500/5"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith("image/")) {
                  const reader = new FileReader();
                  reader.onload = async (ev) => {
                    const dataUrl = ev.target?.result as string;
                    const compressed = await compressImage(dataUrl, 2048, 0.95);
                    onUpdateClip({ imageUrl: compressed });
                  };
                  reader.readAsDataURL(file);
                }
              }}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                      const dataUrl = ev.target?.result as string;
                      const compressed = await compressImage(dataUrl, 2048, 0.95);
                      onUpdateClip({ imageUrl: compressed });
                    };
                    reader.readAsDataURL(file);
                  }
                };
                input.click();
              }}
            >
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Plus className="w-8 h-8 text-orange-400" />
              </div>
              <p className="text-sm font-medium text-slate-300">点击上传图片</p>
              <p className="text-xs text-slate-500 mt-1">或拖拽图片到这里</p>
              <p className="text-xs text-slate-600 mt-2">支持 JPG、PNG、WebP 格式</p>
            </div>
          )}

          {/* 提示词 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              运动提示词（可选）
            </label>
            <textarea
              className="w-full h-20 px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-orange-500/50 resize-none leading-relaxed"
              value={activeClip.videoPrompt}
              onChange={(e) => onUpdateClip({ videoPrompt: e.target.value })}
              placeholder="例如：镜头缓慢右移，柔和的光线..."
            />
          </div>

          {/* 时长选择 */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              视频时长
            </label>
            <div className="grid grid-cols-5 gap-1">
              {[5, 10, 15, 20, 25, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setVideoDuration(d)}
                  disabled={isGenerating}
                  className={`py-1.5 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer ${
                    videoDuration === d
                      ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
                      : "border-white/10 bg-[#1f1f22] text-slate-400 hover:border-white/20"
                  } disabled:opacity-50`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* 字幕（可选） */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              字幕文字（可选）
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
              placeholder="输入字幕内容..."
              value={subtitleText}
              onChange={(e) => setSubtitleText(e.target.value)}
            />
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerateVideo}
            disabled={isGenerating || !activeClip.imageUrl}
            className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 disabled:bg-[#1f1f22] disabled:text-slate-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-orange-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                生成中...
              </>
            ) : (
              <>
                <Film className="w-4 h-4 text-orange-300" />
                生成视频
              </>
            )}
          </button>

          {/* 链式扩展提示 */}
          {activeClip.videoUrl && (
            <div className="p-3 bg-[#1a1a1c] border border-white/5 rounded-xl space-y-2">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                <span className="text-orange-400 font-semibold">链式扩展：</span>
                视频完成后，可提取最后一帧作为下一段的参考图，实现超长视频生成。
              </p>
              {activeClip.lastFrameUrl && (
                <div className="flex items-center gap-2">
                  <img
                    src={activeClip.lastFrameUrl}
                    alt="最后一帧"
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 object-cover rounded-lg border border-white/10"
                  />
                  <span className="text-[10px] text-slate-500">最后一帧已就绪</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center min-h-[300px]">
          {isGenerating ? (
            <div className="w-full h-full bg-[#131315] border border-orange-500/20 rounded-2xl p-8 flex flex-col items-center justify-center gap-6 text-center min-h-[350px] shadow-lg shadow-orange-950/5">
              <div className="relative flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-4 border-orange-500/10 border-t-orange-500 animate-spin"></div>
                <Hourglass className="w-8 h-8 text-orange-500 absolute animate-bounce" />
              </div>
              <div className="space-y-3 max-w-md">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
                  JOB ID: {activeJobId || "CREATING..."}
                </div>
                <h3 className="text-base font-semibold text-slate-100">正在生成电影级动态画面</h3>

                <div className="inline-block bg-[#1a1a1c] border border-white/5 px-3 py-1.5 rounded-lg text-xs font-medium text-orange-400 font-mono shadow-inner animate-pulse">
                  ⚡ {pollStatus || "Awaiting task ID..."}
                </div>
                {videoProgress > 0 && (
                  <div className="w-full max-w-xs mx-auto">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>进度</span>
                      <span className="text-orange-400 font-bold">{videoProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#1f1f22] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500 ease-out"
                        style={{ width: `${videoProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  视频引擎正在生成高清动态画面...
                </p>
              </div>

              <div className="w-full max-w-sm bg-[#1a1a1c] border border-white/5 rounded-xl p-4 text-left font-mono text-[10px] space-y-1.5 shadow-inner max-h-48 overflow-y-auto">
                <div className="text-xs font-semibold text-slate-400 border-b border-white/5 pb-1 mb-2 flex items-center justify-between">
                  <span>渲染流程日志</span>
                  <span className="text-[10px] text-orange-500 animate-pulse">实时追踪</span>
                </div>
                {videoLogs.map((log, idx) => {
                  const isLast = idx === videoLogs.length - 1;
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 transition-all duration-300 ${
                        isLast ? "text-orange-400 font-medium animate-pulse" : "text-slate-400"
                      }`}
                    >
                      <span className="text-[9px] text-slate-600 select-none">[{idx + 1}]</span>
                      <span>{log}</span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <StopCircle className="w-3.5 h-3.5" />
                取消
              </button>
            </div>
          ) : error ? (
            <div className="w-full h-full bg-[#131315] border border-red-500/20 rounded-2xl p-8 flex flex-col items-center justify-center gap-6 text-center min-h-[350px] shadow-lg shadow-red-950/5">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 animate-pulse">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </div>
              <div className="space-y-3 max-w-md">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-mono">
                  🔴 生成失败 {activeJobId && `(任务: ${activeJobId})`}
                </div>
                <h3 className="text-base font-semibold text-slate-100">视频生成出错</h3>
                <p className="text-xs text-red-300 leading-relaxed bg-red-950/20 border border-red-900/30 p-3 rounded-xl max-h-24 overflow-y-auto w-full">
                  {error}
                </p>
              </div>

              <div className="w-full max-w-sm bg-[#1a1a1c] border border-white/5 rounded-xl p-4 text-left font-mono text-[10px] space-y-1.5 shadow-inner max-h-48 overflow-y-auto">
                <div className="text-xs font-semibold text-slate-400 border-b border-white/5 pb-1 mb-2 flex items-center justify-between">
                  <span>渲染流程日志（已中止）</span>
                  <span className="text-[10px] text-red-500 font-bold">失败</span>
                </div>
                {videoLogs.map((log, idx) => {
                  const isError = log.includes("❌") || log.includes("⚠️") || log.includes("Error:");
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 transition-all duration-300 ${
                        isError ? "text-red-400 font-semibold" : "text-slate-400"
                      }`}
                    >
                      <span className="text-[9px] text-slate-600 select-none">[{idx + 1}]</span>
                      <span>{log}</span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleGenerateVideo}
                className="px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                重新生成
              </button>
            </div>
          ) : activeClip.videoUrl ? (
            <div className="w-full space-y-4">
              <div className="rounded-2xl overflow-hidden border border-white/5 shadow-lg bg-[#09090A] aspect-video relative flex items-center justify-center min-h-[250px]">
                {isVideoLoading && (
                  <div className="absolute inset-0 bg-[#1a1a1c] flex flex-col items-center justify-center gap-3 text-center z-10">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin"></div>
                      <Film className="w-4 h-4 text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <p className="text-xs text-slate-400">正在加载影片到浏览器播放器...</p>
                  </div>
                )}
                <video
                  src={activeClip.videoUrl}
                  controls
                  playsInline
                  autoPlay
                  loop
                  className={`w-full h-full object-contain transition-all duration-300 ${
                    isVideoLoading ? "opacity-0 scale-95" : "opacity-100 scale-100"
                  }`}
                  onLoadedData={() => setIsVideoLoading(false)}
                  onCanPlay={() => setIsVideoLoading(false)}
                  onError={() => setIsVideoLoading(false)}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  onClick={handleSaveClip}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-white/5 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4 text-orange-400" />
                  {t('video.saveTimeline')}
                </button>

                {onNewVideo && (
                  <button
                    onClick={onNewVideo}
                    className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white border border-white/5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 text-green-400" />
                    {t('video.newVideo')}
                  </button>
                )}

                <button
                  onClick={handleContinueChain}
                  disabled={!canContinueChain}
                  className="px-5 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-blue-300 border border-blue-500/30 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="使用最后一帧作为下一段视频的参考图"
                >
                  {isExtractingFrame ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  Continue Chain (next {videoDuration}s)
                </button>

                <button
                  onClick={onGoToTimeline}
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-orange-950/20"
                >
                  Go to Timeline Step
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full h-full bg-[#1a1a1c] border-2 border-dashed border-white/5 rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-center min-h-[350px]">
              <div className="w-12 h-12 rounded-full bg-[#1f1f22] flex items-center justify-center text-slate-500">
                <Film className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-300">尚未渲染影片</p>
                <p className="text-xs text-slate-500 max-w-sm">
                  Once you generate the base image keyframe above, click &quot;Render Movie Clip&quot; to generate
                  high-fidelity camera dynamics. After it finishes, use{" "}
                  使用「链式扩展」超越单片段限制。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
