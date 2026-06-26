/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Film, Sparkles, RefreshCw, Save, ArrowLeft, Plus, CheckCircle, ArrowRight, Hourglass, AlertTriangle, RotateCw, Image as ImageIcon } from "lucide-react";
import { VideoClip } from "../types";
import { createVideoTaskApi, subscribeVideoProgress } from "../utils/api";
import { compressImage, getImageSizeInfo } from "../utils/imageCompress";
import { ToastItem, createToast } from "./Toast";

interface VideoGenerateStepProps {
  apiKey: string;
  activeClip: VideoClip;
  onUpdateClip: (updates: Partial<VideoClip>) => void;
  onPrev: () => void;
  onSaveToTimeline: () => void;
  onGoToTimeline: () => void;
  onToast?: (toast: ToastItem) => void;
}

export default function VideoGenerateStep({
  apiKey,
  activeClip,
  onUpdateClip,
  onPrev,
  onSaveToTimeline,
  onGoToTimeline,
  onToast,
}: VideoGenerateStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoLogs, setVideoLogs] = useState<string[]>([]);
  const [pollStatus, setPollStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [subtitleText, setSubtitleText] = useState(activeClip.subtitle || "");
  const [isPolling, setIsPolling] = useState(false);
  const activeJobId = activeClip.videoTaskId || null;
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (activeClip.videoTaskStatus === "polling" && activeClip.videoTaskId && !activeClip.videoUrl) {
      connectWebSocket(activeClip.videoTaskId);
    }
  }, [activeClip.videoTaskId]);

  const connectWebSocket = (videoId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    const taskId = videoId;
    setIsGenerating(true);
    setIsVideoLoading(true);
    setVideoLogs(prev => prev.length > 0 ? prev : [
      "🔄 Reconnecting to video generation...",
      `📡 Job ID: ${videoId}`
    ]);

    const ws = subscribeVideoProgress(
      videoId,
      apiKey,
      taskId,
      (msg) => {
        setPollStatus(msg.message || "");
        setVideoLogs(prev => {
          const newLog = msg.message || "";
          if (!newLog || prev[prev.length - 1] === newLog) return prev;
          return [...prev, newLog];
        });
      },
      (url) => {
        const cacheBustedUrl = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
        onUpdateClip({
          videoUrl: cacheBustedUrl,
          subtitle: subtitleText,
          videoTaskStatus: "completed",
        });
        setPollStatus("Success");
        setVideoLogs(prev => [...prev, "✅ Video rendering completed successfully!", "🎉 Cinematic motion clip synchronized."]);
        setIsGenerating(false);
        setIsVideoLoading(false);
        if (onToast) onToast(createToast("success", "Video generated successfully!"));
      },
      (errMsg) => {
        setError(errMsg);
        setVideoLogs(prev => [...prev, `❌ Error: ${errMsg}`, "⚠️ Render pipeline aborted."]);
        setPollStatus("");
        setIsGenerating(false);
        setIsVideoLoading(false);
        onUpdateClip({ videoTaskStatus: "failed" });
        if (onToast) onToast(createToast("error", `Video generation failed: ${errMsg}`));
      }
    );

    wsRef.current = ws;
  };

  const handleGenerateVideo = async () => {
    setIsGenerating(true);
    setIsVideoLoading(true);
    setError(null);
    setPollStatus("Submitting task to Agnes AI...");
    setVideoLogs([
      "🔄 Initializing video generation pipeline...",
      "📡 Constructing Frame-to-Video parameters...",
      "🌐 Compressing reference keyframe for faster upload..."
    ]);

    try {
      // Compress image before uploading
      let imageUrlToSend = activeClip.imageUrl;
      if (activeClip.imageUrl) {
        try {
          const compressed = await compressImage(activeClip.imageUrl, 1024, 0.8);
          const sizeInfo = getImageSizeInfo(compressed);
          imageUrlToSend = compressed;
          setVideoLogs(prev => [
            ...prev,
            `📐 Image compressed: ${sizeInfo.sizeKB}KB (${sizeInfo.sizeMB}MB)`
          ]);
        } catch (compressErr) {
          // If compression fails, use original
          setVideoLogs(prev => [
            ...prev,
            "⚠️ Compression failed, using original image"
          ]);
        }
      }

      setVideoLogs(prev => [
        ...prev,
        "🌐 Uploading reference keyframe to Agnes neural cluster..."
      ]);

      const { video_id, task_id } = await createVideoTaskApi(
        apiKey,
        activeClip.videoPrompt,
        imageUrlToSend
      );

      const resolvedJobId = video_id || task_id || "VID-" + Math.random().toString(36).substr(2, 9).toUpperCase();
      onUpdateClip({ videoTaskId: resolvedJobId, videoTaskStatus: "polling" });
      setVideoLogs(prev => [
        ...prev,
        `✓ Reference keyframe validated successfully.`,
        `📡 Dispatched Agnes Job ID: ${resolvedJobId}`,
        "⚙️ Bootstrapping Agnes video interpolation engine..."
      ]);
      setPollStatus("Video task created. Connecting via WebSocket...");

      connectWebSocket(resolvedJobId);
    } catch (err: any) {
      const errMsg = err.message || "An error occurred during video creation.";
      setError(errMsg);
      setVideoLogs(prev => [...prev, `❌ Error: ${errMsg}`, "⚠️ Render pipeline aborted."]);
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
    setVideoLogs(prev => [...prev, "🔄 Manual WebSocket reconnect triggered..."]);
    connectWebSocket(activeClip.videoTaskId);
    setIsPolling(false);
  };

  const handleSaveClip = () => {
    onUpdateClip({ subtitle: subtitleText });
    onSaveToTimeline();
  };

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
            <h2 className="text-xl font-semibold text-slate-100">3. Transform Keyframe to Video</h2>
            <p className="text-sm text-slate-400 mt-1">
              Animate your visual base frame with customized movie-grade camera trajectories.
            </p>
          </div>
        </div>
        <div className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Agnes Video v2.0
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 text-red-400 rounded-xl text-sm border border-red-900/30">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Form & Prompts (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {activeClip.imageUrl && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Reference Base Frame
              </span>
              <div className="border border-white/5 rounded-xl overflow-hidden shadow-inner max-h-36 bg-[#1a1a1c] flex items-center justify-center">
                <img
                  src={activeClip.imageUrl}
                  alt="Reference keyframe"
                  referrerPolicy="no-referrer"
                  className="w-full h-auto max-h-36 object-contain"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Motion Guidance Prompt
            </label>
            <textarea
              className="w-full h-24 px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-orange-500/50 resize-none leading-relaxed"
              value={activeClip.videoPrompt}
              onChange={(e) => onUpdateClip({ videoPrompt: e.target.value })}
              placeholder="e.g., Camera slow pan-right, soft volumetric lighting flickering, ultra-high realism..."
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Speech script / Subtitles
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
              placeholder="e.g., We have successfully established base contact on the red planet."
              value={subtitleText}
              onChange={(e) => setSubtitleText(e.target.value)}
            />
            <p className="text-[10px] text-slate-500">
              This text will be synthesized as audio voiceover and displayed as synced subtitles in the timeline step.
            </p>
          </div>

          <button
            onClick={handleGenerateVideo}
            disabled={isGenerating || !activeClip.imageUrl}
            className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 disabled:bg-[#1f1f22] disabled:text-slate-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                Processing...
              </>
            ) : (
              <>
                <Film className="w-4 h-4 text-orange-300" />
                Render Movie Clip
              </>
            )}
          </button>
        </div>

        {/* Right Column - Results (7 Cols) */}
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
                <h3 className="text-base font-semibold text-slate-100">Generating Cinematic Motion</h3>
                
                <div className="inline-block bg-[#1a1a1c] border border-white/5 px-3 py-1.5 rounded-lg text-xs font-medium text-orange-400 font-mono shadow-inner animate-pulse">
                  ⚡ {pollStatus || "Awaiting task ID..."}
                </div>
                
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  Agnes's video engine is generating 121 high-definition frames at 24fps with cinematic temporal flow.
                </p>
              </div>

              {/* Interactive Pipeline Logs */}
              <div className="w-full max-w-sm bg-[#1a1a1c] border border-white/5 rounded-xl p-4 text-left font-mono text-[10px] space-y-1.5 shadow-inner max-h-48 overflow-y-auto">
                <div className="text-xs font-semibold text-slate-400 border-b border-white/5 pb-1 mb-2 flex items-center justify-between">
                  <span>RENDER PIPELINE LOGS</span>
                  <span className="text-[10px] text-orange-500 animate-pulse">LIVE TRACKING</span>
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
                  🔴 RENDER FAILED {activeJobId && `(JOB: ${activeJobId})`}
                </div>
                <h3 className="text-base font-semibold text-slate-100">Video Synthesis Interrupted</h3>
                <p className="text-xs text-red-300 leading-relaxed bg-red-950/20 border border-red-900/30 p-3 rounded-xl max-h-24 overflow-y-auto w-full">
                  {error}
                </p>
                <p className="text-[11px] text-slate-400">
                  Please review the logs below, verify your API settings or reference frame, and try again.
                </p>
              </div>

              {/* Interactive Pipeline Logs (Failed State) */}
              <div className="w-full max-w-sm bg-[#1a1a1c] border border-white/5 rounded-xl p-4 text-left font-mono text-[10px] space-y-1.5 shadow-inner max-h-48 overflow-y-auto">
                <div className="text-xs font-semibold text-slate-400 border-b border-white/5 pb-1 mb-2 flex items-center justify-between">
                  <span>RENDER PIPELINE LOGS (ABORTED)</span>
                  <span className="text-[10px] text-red-500 font-bold">FAILED</span>
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
                className="px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Video Generation
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
                    <p className="text-xs text-slate-400">Loading movie clip into browser player...</p>
                  </div>
                )}
                <video
                  src={activeClip.videoUrl}
                  controls
                  playsInline
                  autoPlay
                  loop
                  className={`w-full h-full object-contain transition-all duration-300 ${isVideoLoading ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
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
                  Save & Append to Story Timeline
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
                <p className="text-sm font-semibold text-slate-300">No movie rendered yet</p>
                <p className="text-xs text-slate-500 max-w-sm">
                  Once you generate the base image keyframe above, click "Render Movie Clip" to generate high-fidelity camera dynamics.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
