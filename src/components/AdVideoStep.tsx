/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Film, ArrowLeft, Sparkles, RefreshCw, Play, CheckCircle, AlertTriangle, User } from "lucide-react";
import { Product, AdVideoResult, TaskStatus } from "../types";
import { generateAdVideoApi } from "../utils/api";

interface AdVideoStepProps {
  apiKey: string;
  product: Product;
  sourceImageUrl: string;
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

  const handleOptimizePrompt = async () => {
    setIsOptimizing(true);
    try {
      const result = await generateAdVideoApi(
        apiKey,
        product,
        sourceImageUrl,
        adCopy,
        characterName || undefined,
        dialogue || undefined
      );
      setVideoPrompt(result.videoPrompt);
    } catch (err: any) {
      console.error("Failed to optimize prompt:", err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!videoPrompt) return;

    setIsGenerating(true);
    setVideoStatus("generating");

    try {
      // Create video task
      const createResponse = await fetch("/api/proxy/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "agnes-video-v2.0",
          prompt: videoPrompt,
          image: sourceImageUrl,
          num_frames: 361,
          frame_rate: 24,
        }),
      });

      if (!createResponse.ok) {
        throw new Error(`Video task creation failed: ${createResponse.status}`);
      }

      const createData = await createResponse.json();
      const taskId = createData.id || createData.task_id || createData.video_id;

      if (!taskId) {
        throw new Error("No task ID in response");
      }

      setVideoTaskId(taskId);
      setVideoStatus("polling");

      // Poll for completion
      let completed = false;
      let attempts = 0;
      const maxAttempts = 120;

      while (!completed && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;

        try {
          const pollResponse = await fetch(`/api/proxy/status?video_id=${taskId}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });

          if (!pollResponse.ok) continue;

          const pollData = await pollResponse.json();
          const status = (pollData.status || pollData.state || "").toLowerCase();

          if (status === "completed" || status === "success") {
            const url =
              pollData.remixed_from_video_id ||
              pollData.urls?.[0] ||
              pollData.video_url ||
              pollData.url;

            if (url) {
              setVideoUrl(url);
              setVideoStatus("completed");
              completed = true;
            }
          } else if (status === "failed" || status === "error") {
            throw new Error(pollData.error || "Video generation failed");
          }
        } catch (pollErr: any) {
          if (pollErr.message?.includes("failed") || pollErr.message?.includes("error")) {
            throw pollErr;
          }
        }
      }

      if (!completed) {
        throw new Error("Video generation timed out");
      }
    } catch (err: any) {
      console.error("Failed to generate video:", err);
      setVideoStatus("failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleComplete = () => {
    onComplete({
      id: `ad_video_${Date.now()}`,
      product,
      sourceImageUrl,
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
                <img
                  src={sourceImageUrl}
                  alt={product.name}
                  className="w-20 h-20 object-contain bg-[#1f1f22] rounded-lg"
                />
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

            {/* Video Preview */}
            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl overflow-hidden">
              {videoUrl ? (
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
          </div>
        </div>
      </div>
    </div>
  );
}
