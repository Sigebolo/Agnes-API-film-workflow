/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { User, Sparkles, RefreshCw, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, Layers, Eye } from "lucide-react";
import { CharacterAnchor } from "../types";
import { generateCharacterSheetApi, generateCharacterViewApi, optimizePromptApi } from "../utils/api";
import { ToastItem, createToast } from "./Toast";

interface CharacterAnchorStepProps {
  apiKey: string;
  characterAnchor: CharacterAnchor | null;
  onSetCharacterAnchor: (anchor: CharacterAnchor | null) => void;
  onPrev: () => void;
  onNext: () => void;
  onToast?: (toast: ToastItem) => void;
}

export default function CharacterAnchorStep({
  apiKey,
  characterAnchor,
  onSetCharacterAnchor,
  onPrev,
  onNext,
  onToast,
}: CharacterAnchorStepProps) {
  const [description, setDescription] = useState(characterAnchor?.description || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMode, setGenerationMode] = useState<"sheet" | "individual">("sheet");
  const [error, setError] = useState<string | null>(null);
  const [isAutoExtracting, setIsAutoExtracting] = useState(false);
  const [previewAngle, setPreviewAngle] = useState<string>("front");
  const [genLogs, setGenLogs] = useState<string[]>([]);

  const handleAutoExtract = async () => {
    setIsAutoExtracting(true);
    setError(null);
    try {
      const response = await fetch("/api/analyze-character", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ prompt: "Extract detailed character appearance description for consistency anchoring. Include: age, gender, hair (color, style, length), eyes, skin, body type, clothing, accessories, distinctive features." }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.character) {
          setDescription(data.character);
          if (onToast) {
            onToast(createToast("success", "Character description extracted from story!"));
          }
        }
      }
    } catch (err) {
      console.error("Auto-extract failed:", err);
      if (onToast) {
        onToast(createToast("error", "Failed to auto-extract character. Please describe manually."));
      }
    } finally {
      setIsAutoExtracting(false);
    }
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError("Please describe the character's appearance first.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    const startTime = Date.now();

    // New workflow: optimize → front view → img2img other angles
    setGenLogs([
      `🕐 Started at ${ts}`,
      `📝 Raw input: ${description.slice(0, 80)}${description.length > 80 ? "..." : ""}`,
      "🔄 Step 1/5: Optimizing character prompt via Agnes Chat API...",
    ]);

    try {
      // Step 1: Optimize the character description
      let optimizedDesc = description;
      try {
        const optResponse = await fetch("/api/proxy/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "agnes-2.0-flash",
            messages: [
              {
                role: "system",
                content: "You are a Stable Diffusion prompt engineer. Convert the user's character description into a detailed, comma-separated English prompt for image generation. Focus on: hair (color, style, length), eyes (color), skin tone, body type, age, clothing, accessories, distinctive features. Output ONLY the prompt text, no explanation."
              },
              { role: "user", content: description }
            ],
          }),
        });
        if (optResponse.ok) {
          const optData = await optResponse.json();
          optimizedDesc = optData.choices?.[0]?.message?.content || description;
          setGenLogs(prev => [...prev, `✅ Optimized prompt: ${optimizedDesc.slice(0, 80)}...`]);
        } else {
          setGenLogs(prev => [...prev, "⚠️ Prompt optimization failed, using raw description"]);
        }
      } catch {
        setGenLogs(prev => [...prev, "⚠️ Chat API unavailable, using raw description"]);
      }

      // Step 2: Generate front view (text-to-image)
      setGenLogs(prev => [...prev, "🔄 Step 2/5: Generating front view (text-to-image)..."]);
      const frontStart = Date.now();
      const frontPrompt = `masterpiece, best quality, character reference, front view, facing camera, neutral expression, full body, ${optimizedDesc}, white background, clean design`;
      const frontUrl = await generateCharacterViewApi(apiKey, frontPrompt, "front");
      const frontElapsed = ((Date.now() - frontStart) / 1000).toFixed(1);
      const frontCacheUrl = `${frontUrl}${frontUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
      setGenLogs(prev => [...prev, `✅ Front view done in ${frontElapsed}s`]);

      // Step 3-5: Generate other views using img2img (front as reference)
      const otherViews = [
        { key: "side", angle: "side profile view, facing right", label: "Side" },
        { key: "back", angle: "back view, rear perspective", label: "Back" },
        { key: "threeQuarter", angle: "three-quarter angle view, 45 degrees", label: "3/4" },
      ];

      const viewUrls: Record<string, string> = { front: frontCacheUrl };

      for (let i = 0; i < otherViews.length; i++) {
        const v = otherViews[i];
        setGenLogs(prev => [...prev, `🔄 Step ${i + 3}/5: Generating ${v.label} view (img2img from front)...`]);
        const viewStart = Date.now();
        const viewPrompt = `masterpiece, best quality, character reference, ${v.angle}, neutral expression, full body, ${optimizedDesc}, white background, consistent character design`;
        const viewUrl = await generateCharacterViewApi(apiKey, viewPrompt, v.key, frontUrl, 0.55);
        const viewElapsed = ((Date.now() - viewStart) / 1000).toFixed(1);
        viewUrls[v.key] = `${viewUrl}${viewUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
        setGenLogs(prev => [...prev, `✅ ${v.label} view done in ${viewElapsed}s`]);
      }

      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      onSetCharacterAnchor({
        id: `anchor_${Date.now()}`,
        description: optimizedDesc,
        sheetUrl: frontCacheUrl,
        viewUrls,
      });
      setGenLogs(prev => [...prev, `🎉 All 4 views generated in ${totalElapsed}s — anchor ready!`]);

      if (onToast) {
        onToast(createToast("success", "Character anchor generated successfully!"));
      }
    } catch (err: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const errMsg = err.message || "An error occurred while generating character.";
      setError(errMsg);
      setGenLogs(prev => [...prev, `❌ API error after ${elapsed}s: ${errMsg}`]);
      if (onToast) {
        onToast(createToast("error", `Character generation failed: ${errMsg}`));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-[#161618] rounded-2xl border border-white/5 p-6 space-y-6" id="character-anchor-step">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onPrev}
            className="p-1.5 hover:bg-white/5 text-slate-500 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">1.5 Character Anchor</h2>
            <p className="text-sm text-slate-400 mt-1">
              Generate multi-angle character reference for consistent visuals across clips.
            </p>
          </div>
        </div>
        <div className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
          <User className="w-3 h-3" />
          Character Consistency
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 text-red-400 rounded-xl text-sm border border-red-900/30">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Description Input */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-300">
                Character Description
              </label>
              <button
                onClick={handleAutoExtract}
                disabled={isAutoExtracting}
                type="button"
                className="px-2 py-0.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded border border-purple-500/20 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isAutoExtracting ? (
                  <>
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-2.5 h-2.5 text-purple-300" />
                    Auto-Extract from Story
                  </>
                )}
              </button>
            </div>
            <textarea
              className="w-full h-36 px-4 py-3 bg-[#1f1f22] border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-slate-100 text-sm placeholder:text-slate-600 resize-none transition-all"
              placeholder="e.g., A 25-year-old East Asian woman with long flowing black hair, amber eyes, wearing a weathered brown leather jacket with brass buckles, high-collar white shirt underneath, dark cargo pants, and utility boots..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-[10px] text-slate-500">
              Be as specific as possible: hair color/style, eye color, skin tone, clothing materials, accessories, body type, age, distinctive features.
            </p>
          </div>

          {/* Generation Mode */}
          <div className="bg-[#1a1a1c] border border-white/5 rounded-xl p-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Generation Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setGenerationMode("sheet")}
                className={`px-3 py-2 text-xs rounded-xl border text-center transition-all cursor-pointer font-medium ${
                  generationMode === "sheet"
                    ? "border-purple-500/40 bg-purple-500/10 text-purple-400 font-bold"
                    : "border-white/10 bg-[#1f1f22] text-slate-400 hover:border-white/20"
                }`}
              >
                <Layers className="w-4 h-4 mx-auto mb-1" />
                Single Sheet
              </button>
              <button
                onClick={() => setGenerationMode("individual")}
                className={`px-3 py-2 text-xs rounded-xl border text-center transition-all cursor-pointer font-medium ${
                  generationMode === "individual"
                    ? "border-purple-500/40 bg-purple-500/10 text-purple-400 font-bold"
                    : "border-white/10 bg-[#1f1f22] text-slate-400 hover:border-white/20"
                }`}
              >
                <Eye className="w-4 h-4 mx-auto mb-1" />
                Individual Views
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              {generationMode === "sheet" 
                ? "Generate a single image containing front, side, back, and 3/4 views. Faster but views may vary slightly."
                : "Generate each view separately (4 API calls). More consistent but higher token usage."}
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !description.trim()}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:brightness-110 disabled:bg-[#1f1f22] disabled:text-slate-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                Generating Character Reference...
              </>
            ) : (
              <>
                <User className="w-4 h-4 text-purple-300" />
                Generate Character Anchor
              </>
            )}
          </button>
        </div>

        {/* Right Column - Preview */}
        <div className="bg-[#1a1a1c] rounded-xl border border-white/5 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3 flex-1">
            <h3 className="text-sm font-semibold text-slate-200">角色参考图预览</h3>

            {/* Generation Logs */}
            {genLogs.length > 0 && (
              <div className="bg-[#131315] border border-white/5 rounded-xl p-3 font-mono text-[10px] space-y-1 max-h-36 overflow-y-auto">
                {genLogs.map((log, i) => (
                  <div key={i} className={`flex items-start gap-2 ${i === genLogs.length - 1 ? "text-orange-400" : "text-slate-400"}`}>
                    <span className="text-[9px] text-slate-600 select-none">[{i + 1}]</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500 leading-relaxed">
              {characterAnchor 
                ? "角色锚点已设置，将作为所有图片生成的参考。"
                : "在上方生成角色锚点，以确保所有片段中角色视觉一致。"}
            </p>

            {characterAnchor ? (
              <div className="space-y-3 mt-3">
                {/* Sheet Preview */}
                <div className="relative rounded-xl overflow-hidden border border-white/5 bg-[#09090A] flex items-center justify-center min-h-[200px]">
                  <img
                    src={characterAnchor.sheetUrl}
                    alt="Character reference sheet"
                    referrerPolicy="no-referrer"
                    className="w-full h-auto max-h-[300px] object-contain"
                  />
                  <div className="absolute top-2 right-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    锚点已设置
                  </div>
                </div>

                {/* View Selector (if individual views exist) */}
                {Object.keys(characterAnchor.viewUrls).length > 1 && (
                  <div className="flex gap-2">
                    {["front", "side", "back", "threeQuarter"].map((view) => (
                      <button
                        key={view}
                        onClick={() => setPreviewAngle(view)}
                        disabled={!characterAnchor.viewUrls[view as keyof typeof characterAnchor.viewUrls]}
                        className={`flex-1 px-2 py-1.5 text-[10px] rounded-lg border text-center transition-all cursor-pointer font-medium ${
                          previewAngle === view
                            ? "border-purple-500/40 bg-purple-500/10 text-purple-400 font-bold"
                            : "border-white/5 bg-[#1f1f22] text-slate-400 hover:border-white/10 disabled:opacity-40"
                        }`}
                      >
                        {view === "threeQuarter" ? "3/4" : view.charAt(0).toUpperCase() + view.slice(1)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Description Preview */}
                <div className="bg-[#131315] border border-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">角色描述</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{characterAnchor.description}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-[#1f1f22] flex items-center justify-center text-slate-600 mb-3">
                  <User className="w-8 h-8" />
                </div>
                <p className="text-sm text-slate-500">尚未设置角色锚点</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/5 flex justify-end">
            <button
              onClick={onNext}
              disabled={!characterAnchor}
              className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-800/60 disabled:text-slate-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-purple-950/20"
            >
              步骤 2：生成图像
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
