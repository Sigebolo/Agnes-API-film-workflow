/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  User,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Layers,
  Wand2,
  SkipForward,
} from "lucide-react";
import { VideoClip, CharacterAnchor } from "../types";
import {
  optimizePromptApi,
  generateCharacterSheetApi,
  generateCharacterViewApi,
} from "../utils/api";
import { ToastItem, createToast } from "./Toast";

interface PromptOptimizeStepProps {
  apiKey: string;
  activeClip: VideoClip;
  characterAnchor: CharacterAnchor | null;
  onUpdateClip: (updates: Partial<VideoClip>) => void;
  onSetCharacterAnchor: (anchor: CharacterAnchor | null) => void;
  onNext: () => void;
  onSkipToVideo?: () => void;
  onToast?: (toast: ToastItem) => void;
}

type PipelineState =
  | "idle"
  | "optimizing"
  | "extracting"
  | "generating_anchor"
  | "ready"
  | "error";

export default function PromptOptimizeStep({
  apiKey,
  activeClip,
  characterAnchor,
  onUpdateClip,
  onSetCharacterAnchor,
  onNext,
  onSkipToVideo,
  onToast,
}: PromptOptimizeStepProps) {
  // Prompt state
  const [rawPrompt, setRawPrompt] = useState("");
  const [stylePreset, setStylePreset] = useState(
    "cinematic realism, high-density detail, volumetric lighting"
  );

  // Character state
  const [characterDesc, setCharacterDesc] = useState("");
  const [isCharacterManuallyEdited, setIsCharacterManuallyEdited] =
    useState(false);

  // Generation state
  const [pipelineState, setPipelineState] = useState<PipelineState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [genLogs, setGenLogs] = useState<string[]>([]);
  const [previewAngle, setPreviewAngle] = useState<string>("front");

  // Anchor history for comparison
  const [anchorHistory, setAnchorHistory] = useState<CharacterAnchor[]>([]);

  // --- Pipeline: Optimize → Extract → Generate Anchor ---
  const handleSkipPipeline = () => {
    setPipelineState("ready");
    setGenLogs(["📝 Manual mode — edit prompts directly below"]);
  };

  const handleRunPipeline = async () => {
    if (!rawPrompt.trim()) {
      setError("Please write an idea prompt first.");
      return;
    }

    setPipelineState("optimizing");
    setError(null);
    setGenLogs([]);
    const startTime = Date.now();
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });

    setGenLogs([`🕐 Pipeline started at ${ts}`]);

    try {
      // Step 1: Optimize prompt
      setGenLogs((prev) => [
        ...prev,
        "🔄 Step 1/4: Optimizing prompt via Agnes Chat API...",
      ]);
      const optStart = Date.now();
      let promptToOptimize = rawPrompt;
      if (characterDesc.trim()) {
        promptToOptimize = `Character: [${characterDesc}]. Style: [${stylePreset}]. Scene: ${rawPrompt}`;
      } else if (stylePreset.trim()) {
        promptToOptimize = `Style: [${stylePreset}]. Scene: ${rawPrompt}`;
      }

      const optimized = await optimizePromptApi(
        apiKey,
        promptToOptimize,
        "image"
      );
      const optElapsed = ((Date.now() - optStart) / 1000).toFixed(1);
      onUpdateClip({
        imagePrompt: optimized,
        videoPrompt: `Animate subtle camera movement, cinematic panning, emphasizing details from the scene: ${optimized}`,
      });
      setGenLogs((prev) => [
        ...prev,
        `✅ Prompt optimized in ${optElapsed}s`,
      ]);

      // Step 2: Extract character description (if not manually edited)
      let finalCharDesc = characterDesc;
      if (!isCharacterManuallyEdited && !characterDesc.trim()) {
        setPipelineState("extracting");
        setGenLogs((prev) => [
          ...prev,
          "🔄 Step 2/4: Extracting character description...",
        ]);
        const extStart = Date.now();
        try {
          const response = await fetch("/api/analyze-character", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ prompt: rawPrompt }),
          });
          if (response.ok) {
            const data = await response.json();
            if (data.character) {
              finalCharDesc = data.character;
              setCharacterDesc(data.character);
              const extElapsed = ((Date.now() - extStart) / 1000).toFixed(1);
              setGenLogs((prev) => [
                ...prev,
                `✅ Character extracted in ${extElapsed}s`,
              ]);
            }
          }
        } catch {
          setGenLogs((prev) => [
            ...prev,
            "⚠️ Character extraction failed, continuing without anchor",
          ]);
        }
      } else {
        setGenLogs((prev) => [
          ...prev,
          "⏭️ Step 2/4: Using provided character description",
        ]);
      }

      // Step 3: Generate anchor image (if character description exists)
      if (finalCharDesc.trim()) {
        setPipelineState("generating_anchor");
        setGenLogs((prev) => [
          ...prev,
          "🔄 Step 3/3: Generating anchor image...",
        ]);
        const frontStart = Date.now();

        // Optimize character description for image generation
        let optimizedCharDesc = finalCharDesc;
        try {
          const charOptResponse = await fetch("/api/proxy/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "agnes-2.0-flash",
              messages: [
                {
                  role: "system",
                  content:
                    "Convert the character description into a detailed comma-separated prompt for image generation. Focus on: hair, eyes, skin, clothing, accessories, features. Output ONLY the prompt.",
                },
                { role: "user", content: finalCharDesc },
              ],
            }),
          });
          if (charOptResponse.ok) {
            const charOptData = await charOptResponse.json();
            optimizedCharDesc =
              charOptData.choices?.[0]?.message?.content || finalCharDesc;
          }
        } catch {
          // Use raw description
        }

        const anchorPrompt = `masterpiece, best quality, cinematic still, ${optimizedCharDesc}, film lighting, detailed, sharp focus`;
        const anchorUrl = await generateCharacterViewApi(
          apiKey,
          anchorPrompt,
          "front"
        );
        const frontElapsed = ((Date.now() - frontStart) / 1000).toFixed(1);
        const cacheUrl = `${anchorUrl}${anchorUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
        setGenLogs((prev) => [
          ...prev,
          `✅ Anchor image done in ${frontElapsed}s`,
        ]);

        const newAnchor: CharacterAnchor = {
          id: `anchor_${Date.now()}`,
          description: optimizedCharDesc,
          sheetUrl: cacheUrl,
          viewUrls: { front: cacheUrl },
        };
        onSetCharacterAnchor(newAnchor);
        setAnchorHistory((prev) => [...prev, newAnchor]);

        const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        setGenLogs((prev) => [
          ...prev,
          `🎉 All done in ${totalElapsed}s — ready to generate!`,
        ]);
      } else {
        setGenLogs((prev) => [
          ...prev,
          "⏭️ Step 3-4: Skipped (no character description)",
        ]);
      }

      setPipelineState("ready");
      if (onToast) {
        onToast(
          createToast(
            "success",
            "Pipeline complete! Ready to generate scene image."
          )
        );
      }
    } catch (err: any) {
      const errMsg = err.message || "Pipeline failed";
      setError(errMsg);
      setPipelineState("error");
      setGenLogs((prev) => [...prev, `❌ Error: ${errMsg}`]);
      if (onToast) {
        onToast(createToast("error", errMsg));
      }
    }
  };

  const handleRegenerateAnchor = async () => {
    if (!characterDesc.trim()) {
      setError("Please describe the character first.");
      return;
    }
    setPipelineState("generating_anchor");
    setError(null);
    const startTime = Date.now();

    setGenLogs([`🔄 Regenerating character anchor...`]);

    try {
      // Optimize character description
      let optimizedCharDesc = characterDesc;
      try {
        const charOptResponse = await fetch("/api/proxy/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "agnes-2.0-flash",
            messages: [
              {
                role: "system",
                content:
                  "Convert the character description into a detailed comma-separated prompt for image generation. Focus on: hair, eyes, skin, clothing, accessories, features. Output ONLY the prompt.",
              },
              { role: "user", content: characterDesc },
            ],
          }),
        });
        if (charOptResponse.ok) {
          const charOptData = await charOptResponse.json();
          optimizedCharDesc =
            charOptData.choices?.[0]?.message?.content || characterDesc;
        }
      } catch {
        // Use raw description
      }

      // Generate single anchor image
      setGenLogs((prev) => [...prev, "🔄 Generating anchor image..."]);
      const imgStart = Date.now();
      const anchorPrompt = `masterpiece, best quality, cinematic still, ${optimizedCharDesc}, film lighting, detailed, sharp focus`;
      const anchorUrl = await generateCharacterViewApi(
        apiKey,
        anchorPrompt,
        "front"
      );
      const imgElapsed = ((Date.now() - imgStart) / 1000).toFixed(1);
      const cacheUrl = `${anchorUrl}${anchorUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
      setGenLogs((prev) => [
        ...prev,
        `✅ Anchor image done in ${imgElapsed}s`,
      ]);

      const newAnchor: CharacterAnchor = {
        id: `anchor_${Date.now()}`,
        description: optimizedCharDesc,
        sheetUrl: cacheUrl,
        viewUrls: { front: cacheUrl },
      };
      onSetCharacterAnchor(newAnchor);
      setAnchorHistory((prev) => [...prev, newAnchor]);

      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      setGenLogs((prev) => [
        ...prev,
        `🎉 Anchor regenerated in ${totalElapsed}s`,
      ]);
      setPipelineState("ready");

      if (onToast) {
        onToast(createToast("success", "Character anchor regenerated!"));
      }
    } catch (err: any) {
      const errMsg = err.message || "Anchor generation failed";
      setError(errMsg);
      setPipelineState("error");
      setGenLogs((prev) => [...prev, `❌ Error: ${errMsg}`]);
    }
  };

  return (
    <div
      className="bg-[#161618] rounded-2xl border border-white/5 p-6 space-y-6"
      id="prompt-optimize-step"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            1. Prompt & Character Anchor
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Write your idea, then run the pipeline to optimize and generate
            character references.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {characterAnchor && (
            <div className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
              <User className="w-3 h-3" />
              Anchor Ready
            </div>
          )}
          <div className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Agnes 2.0 Flash
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 text-red-400 rounded-xl text-sm border border-red-900/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Input & Controls */}
        <div className="space-y-4">
          {/* Prompt Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Your Idea (English or 中文)
            </label>
            <textarea
              className="w-full h-32 px-4 py-3 bg-[#1f1f22] border border-white/10 rounded-xl focus:outline-none focus:border-orange-500/50 text-slate-100 text-sm placeholder:text-slate-600 resize-none transition-all"
              placeholder="e.g., A red-haired astronaut drinking coffee inside a Mars dome base, looking out at the sunset..."
              value={rawPrompt}
              onChange={(e) => setRawPrompt(e.target.value)}
            />
          </div>

          {/* Style Preset */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              视觉风格
            </label>
            <input
              type="text"
              className="w-full px-3 py-1.5 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
              placeholder="cinematic realism, high-density detail..."
              value={stylePreset}
              onChange={(e) => setStylePreset(e.target.value)}
            />
          </div>

          {/* Character Description */}
          <div className="bg-[#1a1a1c] border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-purple-400" />
                Character Description
              </label>
              <span className="text-[10px] text-slate-500">
                可选但推荐
              </span>
            </div>
            <textarea
              className="w-full h-24 px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500/50 resize-none leading-relaxed"
              placeholder="e.g., A 25-year-old woman with short blonde hair, wearing a high-tech blue jacket, amber glasses..."
              value={characterDesc}
              onChange={(e) => {
                setCharacterDesc(e.target.value);
                setIsCharacterManuallyEdited(true);
              }}
            />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              留空则流水线将从提示词中自动提取角色描述。
              或手动输入以获得更多控制。
            </p>
          </div>

          {/* Run Pipeline Button */}
          <button
            onClick={handleRunPipeline}
            disabled={
              pipelineState === "optimizing" ||
              pipelineState === "extracting" ||
              pipelineState === "generating_anchor" ||
              !rawPrompt.trim()
            }
            className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 disabled:bg-[#1f1f22] disabled:text-slate-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {pipelineState === "optimizing" ||
            pipelineState === "extracting" ||
            pipelineState === "generating_anchor" ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                {pipelineState === "optimizing" && "优化提示词中..."}
                {pipelineState === "extracting" && "提取角色描述..."}
                {pipelineState === "generating_anchor" &&
                  "正在生成角色锚点..."}
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 text-orange-300" />
                执行流水线（优化 → 提取 → 锚定）
              </>
            )}
          </button>

          {/* Regenerate Anchor Button (shown when anchor exists) */}
          {characterAnchor && (
            <button
              onClick={handleRegenerateAnchor}
              disabled={pipelineState === "generating_anchor"}
              className="w-full py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${pipelineState === "generating_anchor" ? "animate-spin" : ""}`}
              />
              重新生成角色锚点
            </button>
          )}

          {/* Skip Pipeline Button */}
          <button
            onClick={handleSkipPipeline}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-white/10 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <SkipForward className="w-3.5 h-3.5" />
            跳过流水线 — 直接编辑提示词
          </button>
        </div>

        {/* Right Column: Results & Preview */}
        <div className="bg-[#1a1a1c] rounded-xl border border-white/5 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3 flex-1">
            <h3 className="text-sm font-semibold text-slate-200">
              优化结果
            </h3>

            {/* Generation Logs */}
            {genLogs.length > 0 && (
              <div className="bg-[#131315] border border-white/5 rounded-xl p-3 font-mono text-[10px] space-y-1 max-h-40 overflow-y-auto">
                {genLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 ${i === genLogs.length - 1 ? "text-orange-400" : "text-slate-400"}`}
                  >
                    <span className="text-[9px] text-slate-600 select-none">
                      [{i + 1}]
                    </span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Editable Prompts */}
            <div className="space-y-3 mt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  图片提示词
                </label>
                <textarea
                  className="w-full h-20 px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-orange-500/50 resize-none leading-relaxed"
                  value={activeClip.imagePrompt}
                  onChange={(e) =>
                    onUpdateClip({ imagePrompt: e.target.value })
                  }
                  placeholder="AI 优化后的图片提示词将显示在此处..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  视频提示词
                </label>
                <textarea
                  className="w-full h-20 px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-orange-500/50 resize-none leading-relaxed"
                  value={activeClip.videoPrompt}
                  onChange={(e) =>
                    onUpdateClip({ videoPrompt: e.target.value })
                  }
                  placeholder="AI 优化后的视频提示词将显示在此处..."
                />
              </div>
            </div>

            {/* Character Anchor Preview */}
            {characterAnchor && (
              <div className="space-y-2 mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-purple-400 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Character Anchor
                  </h4>
                  <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Set
                  </div>
                </div>

                {/* Sheet Preview */}
                <div className="relative rounded-xl overflow-hidden border border-white/5 bg-[#09090A] flex items-center justify-center min-h-[180px]">
                  <img
                    src={characterAnchor.viewUrls[previewAngle as keyof typeof characterAnchor.viewUrls] || characterAnchor.sheetUrl}
                    alt={`Character reference - ${previewAngle}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-auto max-h-[250px] object-contain"
                  />
                </div>

                {/* View Selector */}
                {Object.keys(characterAnchor.viewUrls).length > 1 && (
                  <div className="flex gap-2">
                    {["front", "side", "back", "threeQuarter"].map((view) => (
                      <button
                        key={view}
                        onClick={() => setPreviewAngle(view)}
                        disabled={
                          !characterAnchor.viewUrls[
                            view as keyof typeof characterAnchor.viewUrls
                          ]
                        }
                        className={`flex-1 px-2 py-1.5 text-[10px] rounded-lg border text-center transition-all cursor-pointer font-medium ${
                          previewAngle === view
                            ? "border-purple-500/40 bg-purple-500/10 text-purple-400 font-bold"
                            : "border-white/5 bg-[#1f1f22] text-slate-400 hover:border-white/10 disabled:opacity-40"
                        }`}
                      >
                        {view === "threeQuarter"
                          ? "3/4"
                          : view.charAt(0).toUpperCase() + view.slice(1)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Description */}
                <div className="bg-[#131315] border border-white/5 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    {characterAnchor.description}
                  </p>
                </div>

                {/* Anchor History */}
                {anchorHistory.length > 1 && (
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Anchor History ({anchorHistory.length})
                    </h5>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {anchorHistory.map((anchor, idx) => (
                        <button
                          key={anchor.id}
                          onClick={() => onSetCharacterAnchor(anchor)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                            anchor.id === characterAnchor.id
                              ? "border-purple-500 ring-2 ring-purple-500/30"
                              : "border-white/10 hover:border-white/20"
                          }`}
                        >
                          <img
                            src={anchor.sheetUrl}
                            alt={`Anchor ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Next Button */}
          <div className="pt-3 border-t border-white/5 flex justify-between">
            {characterAnchor && onSkipToVideo && (
              <button
                onClick={onSkipToVideo}
                className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
              >
                ⚡ Skip to Video
              </button>
            )}
            <button
              onClick={onNext}
              disabled={!activeClip.imagePrompt}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-800/60 disabled:text-slate-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-orange-950/20 ml-auto"
            >
              Step 2: Generate Image
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
