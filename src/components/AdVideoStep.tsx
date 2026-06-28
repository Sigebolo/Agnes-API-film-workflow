/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Film, ArrowLeft, Sparkles, RefreshCw, Play, CheckCircle, AlertTriangle, User, StopCircle, Scissors } from "lucide-react";
import { Product, AdVideoResult, TaskStatus } from "../types";
import { generateAdVideoApi, subscribeVideoProgress } from "../utils/api";

interface AdVideoStepProps {
  apiKey: string;
  product: Product;
  sourceImageUrl?: string;
  adCopy: string;
  onBack: () => void;
  onComplete: (videoResult: AdVideoResult) => void;
}

export default function AdVideoStep({
  apiKey,
  product,
  sourceImageUrl,
  adCopy,
  onBack,
  onComplete,
}: AdVideoStepProps) {
  const [characterName, setCharacterName] = useState("");
  const [characterDesc, setCharacterDesc] = useState("");
  const [dialogue, setDialogue] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [videoStatus, setVideoStatus] = useState<TaskStatus>("idle");
  const [videoTaskId, setVideoTaskId] = useState<string | undefined>();
  const [videoProgress, setVideoProgress] = useState(0);
  const [pollStatus, setPollStatus] = useState("");
  const [videoLogs, setVideoLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(15);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimmedVideoUrl, setTrimmedVideoUrl] = useState<string | undefined>();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleOptimizePrompt = async () => {
    setIsOptimizing(true);
    setVideoLogs(["🤖 AI is optimizing your video prompt..."]);
    try {
      const result = await generateAdVideoApi(
        apiKey,
        product,
        sourceImageUrl || "",
        adCopy,
        characterName || undefined,
        dialogue || undefined
      );
      setVideoPrompt(result.videoPrompt);
      setVideoLogs(prev => [...prev, "✅ Prompt optimized successfully!"]);
    } catch (err: any) {
      console.error("Failed to optimize prompt:", err);
      setVideoLogs(prev => [...prev, `❌ Error: ${err.message}`]);
    } finally {
      setIsOptimizing(false);
    }
  };

  const connectWebSocket = (taskId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?taskId=${encodeURIComponent(taskId)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", videoId: taskId, apiKey }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "done" && msg.url) {
          const cacheBustedUrl = `${msg.url}${msg.url.includes("?") ? "&" : "?"}t=${Date.now()}`;
          setVideoUrl(cacheBustedUrl);
          setVideoStatus("completed");
          setVideoProgress(100);
          setPollStatus("Success");
          setVideoLogs(prev => [...prev, "✅ Video rendering completed!", "🎉 Cinematic motion clip ready."]);
          setIsGenerating(false);
        } else if (msg.type === "error") {
          setError(msg.message);
          setVideoLogs(prev => [...prev, `❌ Error: ${msg.message}`]);
          setPollStatus("");
          setVideoProgress(0);
          setIsGenerating(false);
          setVideoStatus("failed");
        } else if (msg.type === "progress") {
          setPollStatus(msg.message || "");
          if (msg.progress !== undefined) {
            setVideoProgress(msg.progress);
          }
          setVideoLogs(prev => {
            const newLog = msg.message || "";
            if (!newLog || prev[prev.length - 1] === newLog) return prev;
            return [...prev, newLog];
          });
        }
      } catch {}
    };

    ws.onerror = () => {
      setError("WebSocket connection error");
      setVideoLogs(prev => [...prev, "❌ WebSocket connection error"]);
      setIsGenerating(false);
      setVideoStatus("failed");
    };

    wsRef.current = ws;
  };

  const handleGenerateVideo = async () => {
    if (!videoPrompt) return;

    setIsGenerating(true);
    setVideoStatus("generating");
    setVideoProgress(0);
    setError(null);
    setVideoLogs([
      "🔄 Initializing video generation pipeline...",
      "📡 Constructing video parameters...",
    ]);

    try {
      const videoBody: Record<string, any> = {
        model: "agnes-video-v2.0",
        prompt: videoPrompt,
        num_frames: 361,
        frame_rate: 24,
      };

      if (sourceImageUrl) {
        videoBody.image = sourceImageUrl;
        setVideoLogs(prev => [...prev, "🌐 Using reference image for video generation"]);
      }

      setVideoLogs(prev => [...prev, "🚀 Submitting task to Agnes AI..."]);

      const createResponse = await fetch("/api/proxy/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(videoBody),
      });

      if (!createResponse.ok) {
        const errData = await createResponse.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `Video task creation failed: ${createResponse.status}`);
      }

      const createData = await createResponse.json();
      const taskId = createData.id || createData.task_id || createData.video_id;

      if (!taskId) {
        throw new Error("No task ID in response");
      }

      setVideoTaskId(taskId);
      setVideoStatus("polling");
      setVideoLogs(prev => [...prev, `📡 Job ID: ${taskId}`, "⚙️ Bootstrapping video interpolation engine..."]);

      // Connect WebSocket for progress
      connectWebSocket(taskId);

    } catch (err: any) {
      console.error("Failed to generate video:", err);
      setError(err.message);
      setVideoLogs(prev => [...prev, `❌ Error: ${err.message}`, "⚠️ Render pipeline aborted."]);
      setVideoStatus("failed");
      setIsGenerating(false);
    }
  };

  const handleCancel = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    setIsGenerating(false);
    setVideoStatus("idle");
    setVideoProgress(0);
    setPollStatus("");
  };

  const handleTrimVideo = async () => {
    if (!videoUrl) return;

    setIsTrimming(true);
    setVideoLogs(prev => [...prev, `✂️ Trimming video: ${trimStart}s - ${trimEnd}s`]);

    try {
      const response = await fetch("/api/video/trim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl,
          startTime: trimStart,
          endTime: trimEnd,
        }),
      });

      if (!response.ok) {
        throw new Error(`Trim failed: ${response.status}`);
      }

      const data = await response.json();
      setTrimmedVideoUrl(data.trimmedUrl);
      setVideoLogs(prev => [...prev, "✅ Video trimmed successfully!"]);
    } catch (err: any) {
      setVideoLogs(prev => [...prev, `❌ Trim error: ${err.message}`]);
    } finally {
      setIsTrimming(false);
    }
  };

  const handleComplete = () => {
    onComplete({
      id: `ad_video_${Date.now()}`,
      product,
      sourceImageUrl: sourceImageUrl || "",
      adCopy,
      videoPrompt,
      characterName: characterName || undefined,
      characterDescription: characterDesc || undefined,
      dialogue: dialogue || undefined,
      videoUrl,
      videoTaskId,
      status: videoStatus,
      duration: 15,
      createdAt: Date.now(),
    });
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Film className="w-5 h-5 text-blue-400" />
                AI Ad Video
              </h1>
              <p className="text-xs text-slate-400 mt-1">AI optimizes prompts, generates 15s product ad video</p>
            </div>
          </div>
          {videoStatus === "completed" && (
            <button
              onClick={handleComplete}
              className="px-4 py-2 bg-green-600/20 text-green-300 border border-green-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-green-600/30 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Complete
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Settings */}
          <div className="space-y-4">
            {/* Product Preview */}
            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-300 block mb-3">Product Preview</span>
              <div className="flex gap-3">
                {sourceImageUrl ? (
                  <img
                    src={sourceImageUrl}
                    alt={product.name}
                    className="w-20 h-20 object-contain bg-[#1f1f22] rounded-lg"
                  />
                ) : (
                  <div className="w-20 h-20 bg-[#1f1f22] rounded-lg flex items-center justify-center">
                    <Film className="w-8 h-8 text-slate-600" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">{product.name}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">{adCopy}</p>
                </div>
              </div>
            </div>

            {/* Character Settings */}
            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-slate-300">Character Settings (optional)</span>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Character name"
                  className="w-full px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
                />
                <input
                  type="text"
                  value={characterDesc}
                  onChange={(e) => setCharacterDesc(e.target.value)}
                  placeholder="Character description (e.g. 28yo woman, short hair, business attire)"
                  className="w-full px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
                />
                <textarea
                  value={dialogue}
                  onChange={(e) => setDialogue(e.target.value)}
                  rows={2}
                  placeholder="Dialogue lines..."
                  className="w-full px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
                />
              </div>
            </div>

            {/* Optimize Button */}
            <button
              onClick={handleOptimizePrompt}
              disabled={isOptimizing}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:brightness-110 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              {isOptimizing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Optimize Prompt
                </>
              )}
            </button>
          </div>

          {/* Right: Prompt & Video */}
          <div className="space-y-4">
            {/* Video Prompt */}
            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-300 block mb-3">Video Prompt</span>
              <textarea
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                rows={6}
                placeholder="Click 'Optimize Prompt' to auto-generate, or enter manually..."
                className="w-full px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
              />
            </div>

            {/* Generate Video Button */}
            <button
              onClick={handleGenerateVideo}
              disabled={!videoPrompt || isGenerating}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:brightness-110 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {videoStatus === "polling" ? "Rendering..." : "Generating..."}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Generate 15s Video
                </>
              )}
            </button>

            {/* Progress & Logs */}
            {isGenerating && (
              <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
                {/* Progress Bar */}
                {videoProgress > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Progress</span>
                      <span className="text-blue-400 font-bold">{videoProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#1f1f22] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500 ease-out"
                        style={{ width: `${videoProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="inline-block bg-[#1f1f22] border border-white/5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 font-mono shadow-inner animate-pulse mb-4">
                  ⚡ {pollStatus || "Initializing..."}
                </div>

                {/* Logs */}
                <div className="bg-[#1f1f22] border border-white/5 rounded-lg p-3 text-left font-mono text-[10px] space-y-1.5 shadow-inner max-h-48 overflow-y-auto">
                  <div className="text-xs font-semibold text-slate-400 border-b border-white/5 pb-1 mb-2">
                    RENDER PIPELINE LOGS
                  </div>
                  {videoLogs.map((log, idx) => {
                    const isLast = idx === videoLogs.length - 1;
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 transition-all duration-300 ${
                          isLast ? "text-blue-400 font-medium animate-pulse" : "text-slate-400"
                        }`}
                      >
                        <span className="text-[9px] text-slate-600 select-none">[{idx + 1}]</span>
                        <span>{log}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Cancel Button */}
                <button
                  onClick={handleCancel}
                  className="mt-3 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            )}

            {/* Error Display */}
            {error && !isGenerating && (
              <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-semibold text-red-300">Error</span>
                </div>
                <p className="text-xs text-red-300 break-words">{error}</p>
                <p className="text-[10px] text-slate-500 mt-2">Please modify your prompt and try again.</p>
              </div>
            )}

            {/* Video Preview */}
            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl overflow-hidden">
              {trimmedVideoUrl ? (
                <video
                  src={trimmedVideoUrl}
                  controls
                  className="w-full aspect-video object-contain bg-black"
                />
              ) : videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  className="w-full aspect-video object-contain bg-black"
                />
              ) : videoStatus === "failed" ? (
                <div className="aspect-video flex items-center justify-center">
                  <div className="text-center">
                    <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-xs text-red-300">Video generation failed</p>
                  </div>
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center">
                  <div className="text-center">
                    <Film className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">
                      {videoStatus === "polling" ? "Rendering, please wait..." : "Video will appear here after generation"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Trim Controls */}
            {videoUrl && !trimmedVideoUrl && (
              <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Scissors className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold text-slate-300">Trim Video</span>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase mb-1">Start (seconds)</label>
                      <input
                        type="number"
                        min={0}
                        max={trimEnd - 1}
                        value={trimStart}
                        onChange={(e) => setTrimStart(Number(e.target.value))}
                        className="w-full px-2 py-1.5 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase mb-1">End (seconds)</label>
                      <input
                        type="number"
                        min={trimStart + 1}
                        max={15}
                        value={trimEnd}
                        onChange={(e) => setTrimEnd(Number(e.target.value))}
                        className="w-full px-2 py-1.5 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-200"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleTrimVideo}
                    disabled={isTrimming || trimStart >= trimEnd}
                    className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    {isTrimming ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Trimming...
                      </>
                    ) : (
                      <>
                        <Scissors className="w-3.5 h-3.5" />
                        Trim Video
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
