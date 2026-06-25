/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sparkles, ArrowRight, UserPlus, HelpCircle, RefreshCw, User } from "lucide-react";
import { VideoClip, CharacterAnchor } from "../types";
import { optimizePromptApi } from "../utils/api";

interface PromptOptimizeStepProps {
  apiKey: string;
  activeClip: VideoClip;
  characterAnchor: CharacterAnchor | null;
  onUpdateClip: (updates: Partial<VideoClip>) => void;
  onNext: () => void;
}

export default function PromptOptimizeStep({
  apiKey,
  activeClip,
  characterAnchor,
  onUpdateClip,
  onNext,
}: PromptOptimizeStepProps) {
  const [rawPrompt, setRawPrompt] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Character consistency state
  const [enableConsistency, setEnableConsistency] = useState(false);
  const [characterDesc, setCharacterDesc] = useState(
    "a 25-year-old female with short blonde hair, wearing a high-tech blue jacket, amber glasses"
  );
  const [isCharacterDescManuallyEdited, setIsCharacterDescManuallyEdited] = useState(false);
  const [stylePreset, setStylePreset] = useState("cinematic realism, high-density detail, volumetric lighting");
  const [isDetecting, setIsDetecting] = useState(false);

  const handleAutoDetectCharacter = async () => {
    if (!rawPrompt.trim()) return;
    setIsDetecting(true);
    setError(null);
    try {
      const response = await fetch("/api/analyze-character", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ prompt: rawPrompt }),
      });
      if (!response.ok) {
        throw new Error("Failed to analyze prompt for character anchoring.");
      }
      const data = await response.json();
      if (data.character) {
        setCharacterDesc(data.character);
        setIsCharacterDescManuallyEdited(false);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to automatically detect character characteristics. Please describe them manually.");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleToggleConsistency = async (checked: boolean) => {
    setEnableConsistency(checked);
    if (checked && rawPrompt.trim() && characterDesc === "a 25-year-old female with short blonde hair, wearing a high-tech blue jacket, amber glasses") {
      setIsDetecting(true);
      try {
        const response = await fetch("/api/analyze-character", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ prompt: rawPrompt }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.character) {
            setCharacterDesc(data.character);
            setIsCharacterDescManuallyEdited(false);
          }
        }
      } catch (err) {
        console.error("Auto detect failed during toggle", err);
      } finally {
        setIsDetecting(false);
      }
    }
  };

  const handleOptimize = async () => {
    if (!rawPrompt.trim()) {
      setError("Please write an idea prompt first.");
      return;
    }

    setIsOptimizing(true);
    setError(null);

    try {
      let activeCharacterDesc = characterDesc;
      // Auto-detect character traits before optimizing if consistency is enabled but not customized yet
      if (enableConsistency && !isCharacterDescManuallyEdited) {
        try {
          const response = await fetch("/api/analyze-character", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ prompt: rawPrompt }),
          });
          if (response.ok) {
            const data = await response.json();
            if (data.character) {
              activeCharacterDesc = data.character;
              setCharacterDesc(data.character);
            }
          }
        } catch (err) {
          console.warn("Auto-detecting character during optimize failed:", err);
        }
      }

      // Append character consistency details if enabled
      let promptToOptimize = rawPrompt;
      if (enableConsistency && activeCharacterDesc.trim()) {
        promptToOptimize = `Character description: [${activeCharacterDesc}]. Style details: [${stylePreset}]. Action/scene description: ${rawPrompt}`;
      } else if (stylePreset.trim()) {
        promptToOptimize = `Style details: [${stylePreset}]. Scene: ${rawPrompt}`;
      }

      // Inject character anchor description if available
      if (characterAnchor?.description) {
        promptToOptimize = `IMPORTANT: This character MUST match the established character design exactly: [${characterAnchor.description}]. Style: [${stylePreset}]. Scene: ${rawPrompt}`;
      }

      const optimized = await optimizePromptApi(apiKey, promptToOptimize, "image");
      onUpdateClip({
        imagePrompt: optimized,
        videoPrompt: `Animate subtle camera movement, cinematic panning, emphasizing details from the scene: ${optimized}`,
      });
    } catch (err: any) {
      setError(err.message || "An error occurred while optimizing prompt.");
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="bg-[#161618] rounded-2xl border border-white/5 p-6 space-y-6" id="prompt-optimize-step">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">1. Draft & Optimize Prompts</h2>
          <p className="text-sm text-slate-400 mt-1">
            Write down your core creative idea. Our optimizer will translate, detail, and expand it for Agnes AI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {characterAnchor && (
            <div className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
              <User className="w-3 h-3" />
              Character Anchor Active
            </div>
          )}
          <div className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Agnes 2.0 Flash
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 text-red-400 rounded-xl text-sm border border-red-900/30">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Input and Helpers */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Your Idea (English or 中文)
            </label>
            <textarea
              className="w-full h-36 px-4 py-3 bg-[#1f1f22] border border-white/10 rounded-xl focus:outline-none focus:border-orange-500/50 text-slate-100 text-sm placeholder:text-slate-600 resize-none transition-all"
              placeholder="e.g., A red-haired astronaut drinking coffee inside a Mars dome base, looking out at the sunset..."
              value={rawPrompt}
              onChange={(e) => setRawPrompt(e.target.value)}
            />
          </div>

          {/* Consistency Configuration Toggle */}
          <div className="bg-[#1a1a1c] border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-orange-500 focus:ring-0 bg-black/40 border-white/10"
                  checked={enableConsistency}
                  onChange={(e) => handleToggleConsistency(e.target.checked)}
                />
                <span className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-orange-500" />
                  Enable Face & Character Consistency
                </span>
              </label>
              <div className="group relative">
                <HelpCircle className="w-4 h-4 text-slate-500 hover:text-slate-300 cursor-help" />
                <div className="absolute right-0 bottom-6 w-64 p-3 bg-[#232326] text-slate-300 text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity shadow-lg z-10 border border-white/10 leading-relaxed">
                  Appends a uniform detailed character description to all prompts to keep the visual identity identical across clips.
                </div>
              </div>
            </div>

            {enableConsistency && (
              <div className="space-y-3 pt-2 border-t border-white/5 animate-fade-in">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-400">
                      Describe Character/Subject Appearance
                    </label>
                    <button
                      onClick={handleAutoDetectCharacter}
                      disabled={isDetecting || !rawPrompt.trim()}
                      type="button"
                      className="px-2 py-0.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[10px] font-bold rounded border border-orange-500/20 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Smart analyze the scene prompt above to extract and anchor its key features/characters"
                    >
                      {isDetecting ? (
                        <>
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          Analyzing Scene...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-2.5 h-2.5 text-orange-300" />
                          Smart Anchor Features
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
                    placeholder="Describe hair, clothes, age, features, key subject colors..."
                    value={characterDesc}
                    onChange={(e) => {
                      setCharacterDesc(e.target.value);
                      setIsCharacterDescManuallyEdited(true);
                    }}
                  />
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    💡 Click <b className="text-orange-400/80">Smart Anchor Features</b> to automatically analyze your raw prompt above, identify its primary subject (character, vehicle, creature, etc.), and lock down its physical traits.
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Visual Style & Camera Details
              </label>
              <input
                type="text"
                className="w-full px-3 py-1.5 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
                placeholder="Style keywords like cinematic realism, etc."
                value={stylePreset}
                onChange={(e) => setStylePreset(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={handleOptimize}
            disabled={isOptimizing || !rawPrompt.trim()}
            className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 disabled:bg-[#1f1f22] disabled:text-slate-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className={`w-4 h-4 ${isOptimizing ? "animate-spin text-white" : "text-orange-300"}`} />
            {isOptimizing ? "Optimizing & Translating..." : "AI Optimize Prompt"}
          </button>
        </div>

        {/* Right Column: Editable Results */}
        <div className="bg-[#1a1a1c] rounded-xl border border-white/5 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3 flex-1">
            <h3 className="text-sm font-semibold text-slate-200">Optimized Prompts for generation</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              These outputs will be passed to Agnes AI. You can manually adjust them to add custom directions or fix details.
            </p>

            <div className="space-y-3 mt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  1. Image Prompt (Base Visuals)
                </label>
                <textarea
                  className="w-full h-24 px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-orange-500/50 resize-none leading-relaxed"
                  value={activeClip.imagePrompt}
                  onChange={(e) => onUpdateClip({ imagePrompt: e.target.value })}
                  placeholder="The AI-optimized image description will appear here..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  2. Video Prompt (Motion Guidance)
                </label>
                <textarea
                  className="w-full h-24 px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-orange-500/50 resize-none leading-relaxed"
                  value={activeClip.videoPrompt}
                  onChange={(e) => onUpdateClip({ videoPrompt: e.target.value })}
                  placeholder="The AI-optimized video motion details will appear here..."
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 flex justify-end">
            <button
              onClick={onNext}
              disabled={!activeClip.imagePrompt}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-800/60 disabled:text-slate-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-orange-950/20"
            >
              {characterAnchor ? "Step 2: Generate Image" : "Step 1.5: Character Anchor"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
