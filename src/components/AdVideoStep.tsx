/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Film, ArrowLeft, Sparkles, RefreshCw, Play, CheckCircle, AlertTriangle, User, StopCircle, Scissors, Upload, X } from "lucide-react";
import { Product, AdVideoResult, TaskStatus } from "../types";
import { generateAdVideoApi, subscribeVideoProgress, saveTask, deleteTask, autoSaveVideo } from "../utils/api";
import { compressImage } from "../utils/imageCompress";

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
  const [videoDuration, setVideoDuration] = useState(15);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(videoDuration);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimmedVideoUrl, setTrimmedVideoUrl] = useState<string | undefined>();
  const [referenceImage, setReferenceImage] = useState<string | undefined>(sourceImageUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
          saveTask({ id: taskId, type: "video", status: "completed", videoUrl: cacheBustedUrl, imageUrl: referenceImage || sourceImageUrl, prompt: videoPrompt });
          // Auto-save reference image to output folder
          if (referenceImage || sourceImageUrl) {
            fetch("/api/output/save-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageUrl: referenceImage || sourceImageUrl, name: "reference" }),
            }).catch(() => {});
          }
        } else if (msg.type === "error") {
          setError(msg.message);
          setVideoLogs(prev => [...prev, `❌ Error: ${msg.message}`]);
          setPollStatus("");
          setVideoProgress(0);
          setIsGenerating(false);
          setVideoStatus("failed");
          saveTask({ id: taskId, type: "video", status: "failed", error: msg.message });
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

    // Save immediately with temp ID so it appears in sidebar
    const tempId = `pending_${Date.now()}`;
    setVideoTaskId(tempId);
    saveTask({
      id: tempId,
      type: "video",
      prompt: videoPrompt,
      imageUrl: referenceImage || sourceImageUrl,
      status: "submitting",
    });

    try {
      const videoBody: Record<string, any> = {
        model: "agnes-video-v2.0",
        prompt: videoPrompt,
        num_frames: Math.round((videoDuration * 24 - 1) / 8) * 8 + 1,
        frame_rate: 24,
      };

      if (referenceImage) {
        // If referenceImage is already a URL, use it directly
        if (referenceImage.startsWith("http")) {
          videoBody.image = referenceImage;
          setVideoLogs(prev => [...prev, "✅ Using reference image URL directly"]);
        } else {
          // It's base64, compress then upload to get a public URL
          setVideoLogs(prev => [...prev, "🌐 Compressing image..."]);
          try {
            const compressed = await compressImage(referenceImage, 1024, 0.85);
            setVideoLogs(prev => [...prev, "📤 Uploading reference image..."]);
            const uploadResp = await fetch("/api/upload-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ base64: compressed, name: "ref" }),
            });
            const uploadData = await uploadResp.json();
            if (uploadData.url) {
              videoBody.image = uploadData.url;
              setVideoLogs(prev => [...prev, "✅ Image uploaded, using URL"]);
            } else {
              setVideoLogs(prev => [...prev, `⚠️ Upload failed: ${uploadData.error || JSON.stringify(uploadData)}`]);
            }
          } catch (err: any) {
            setVideoLogs(prev => [...prev, `⚠️ Upload error: ${err.message}`]);
          }
        }
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

      // Delete pending task, replace with real one
      deleteTask(tempId);

      const createData = await createResponse.json();
      // CRITICAL: Use video_id for polling (NOT task_id!)
      // Agnes API: POST /v1/videos returns both task_id and video_id
      // Polling MUST use video_id with GET /agnesapi?video_id= or it queues forever
      const videoId = createData.video_id || createData.id || createData.task_id;
      const taskId = createData.task_id || videoId;

      if (!videoId) {
        throw new Error("No video_id in response");
      }

      setVideoTaskId(videoId);
      setVideoStatus("polling");
      setVideoLogs(prev => [...prev, `📡 Submitted, Video ID: ${videoId}`, "⚙️ Generating video..."]);

      // Save real task (use video_id as the ID for polling)
      saveTask({
        id: videoId,
        type: "video",
        prompt: videoPrompt,
        imageUrl: referenceImage || sourceImageUrl,
        status: "queued",
      });

      // Connect WebSocket for progress (using video_id for polling)
      connectWebSocket(videoId);

    } catch (err: any) {
      console.error("Failed to generate video:", err);
      setError(err.message);
      setVideoLogs(prev => [...prev, `❌ Error: ${err.message}`, "⚠️ Render pipeline aborted."]);
      setVideoStatus("failed");
      setIsGenerating(false);
      saveTask({ id: tempId, type: "video", status: "failed", error: err.message });
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setReferenceImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const url = e.dataTransfer.getData("text/plain");
    const file = e.dataTransfer.files?.[0];

    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReferenceImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else if (url && (url.startsWith("http") || url.startsWith("data:image"))) {
      setReferenceImage(url);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleClearImage = () => {
    setReferenceImage(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
      duration: videoDuration,
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
              <p className="text-xs text-slate-400 mt-1">AI optimizes prompts, generates product ad video</p>
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
              <span className="text-xs font-semibold text-slate-300 block mb-3">Reference Image (optional)</span>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="relative"
              >
                {referenceImage ? (
                  <div className="relative">
                    <img
                      src={referenceImage}
                      alt="Reference"
                      className="w-full h-32 object-contain bg-[#1f1f22] rounded-lg"
                    />
                    <button
                      onClick={handleClearImage}
                      className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-500 rounded-full text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/30 hover:bg-purple-500/5 transition-colors"
                  >
                    <Upload className="w-6 h-6 text-slate-500 mb-2" />
                    <p className="text-xs text-slate-400">Drag & drop image or click to upload</p>
                    <p className="text-[10px] text-slate-500 mt-1">Used as reference for video generation</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                {referenceImage ? "Image will be used as reference for video generation" : "Optional: Upload an image to guide video generation"}
              </p>
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

            {/* Duration Selector */}
            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
              <label className="text-xs font-semibold text-slate-300 block mb-3">Video Duration</label>
              <div className="flex gap-2">
                {[5, 10, 15, 20, 25, 30].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setVideoDuration(sec)}
                    disabled={isGenerating}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      videoDuration === sec
                        ? "bg-blue-600 text-white"
                        : "bg-[#1f1f22] text-slate-400 hover:bg-white/5"
                    } disabled:opacity-50`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
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
                  Generate {videoDuration}s Video
                </>
              )}
            </button>

            {/* Progress & Logs */}
            {isGenerating && (
              <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
                {/* Submission spinner */}
                {videoStatus === "generating" && (
                  <div className="mb-4 flex items-center gap-2 text-yellow-400 text-sm">
                    <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                    <span>Submitting to Agnes API, please wait...</span>
                  </div>
                )}

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
