/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Image as ImageIcon, Sparkles, RefreshCw, ArrowRight, ArrowLeft, Upload, CheckCircle2, Hourglass, AlertTriangle, User } from "lucide-react";
import { VideoClip, CharacterAnchor, HistoryImage } from "../types";
import { generateImageApi } from "../utils/api";
import { ToastItem, createToast } from "./Toast";
import ImageHistoryPanel from "./ImageHistoryPanel";

interface ImageGenerateStepProps {
  apiKey: string;
  activeClip: VideoClip;
  characterAnchor: CharacterAnchor | null;
  onUpdateClip: (updates: Partial<VideoClip>) => void;
  onPrev: () => void;
  onNext: () => void;
  onToast?: (toast: ToastItem) => void;
}

export default function ImageGenerateStep({
  apiKey,
  activeClip,
  characterAnchor,
  onUpdateClip,
  onPrev,
  onNext,
  onToast,
}: ImageGenerateStepProps) {
  const [size, setSize] = useState("1024x768");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [useCharacterAnchor, setUseCharacterAnchor] = useState(activeClip.useCharacterAnchor ?? true);
  const activeJobId = activeClip.imageTaskId || null;

  // Image-to-Image (图生图) states
  const [isImg2Img, setIsImg2Img] = useState(false);
  const [img2ImgSource, setImg2ImgSource] = useState<"current" | "custom">("current");
  const [customImg2ImgUrl, setCustomImg2ImgUrl] = useState("");
  const [img2ImgStrength, setImg2ImgStrength] = useState<number>(0.6);

  const handleGenerate = async () => {
    if (!activeClip.imagePrompt) {
      setError("Please optimize or write a prompt in Step 1 first.");
      return;
    }

    if (isImg2Img) {
      if (img2ImgSource === "current" && !activeClip.imageUrl) {
        setError("Current scene has no image yet. Please generate a normal image or select custom URL first.");
        return;
      }
      if (img2ImgSource === "custom" && !customImg2ImgUrl.trim().startsWith("http")) {
        setError("Please enter a valid HTTP/HTTPS custom reference image URL.");
        return;
      }
    }

    setIsGenerating(true);
    setIsImageLoading(true);
    setError(null);
    const generatedId = "IMG-" + Math.random().toString(36).substring(2, 11).toUpperCase();
    onUpdateClip({ imageTaskId: generatedId });

    const now = new Date();
    const ts = now.toLocaleTimeString("en-US", { hour12: false });
    setGenerationLogs([
      `📡 Job created: ${generatedId}`,
      `🕐 Dispatched at ${ts}`,
      `⚙️ Model: agnes-image-2.1-flash | Size: ${size}`,
      "🌐 Sending request to Agnes API..."
    ]);

    const startTime = Date.now();

    try {
      // Determine reference image: character anchor takes priority if enabled
      let refImage: string | undefined;
      let promptToUse = activeClip.imagePrompt;

      if (useCharacterAnchor && characterAnchor?.sheetUrl) {
        refImage = characterAnchor.sheetUrl;
        promptToUse = `${characterAnchor.description}, ${activeClip.imagePrompt}`;
        setGenerationLogs(prev => [...prev, "📎 Character anchor attached as reference image"]);
      } else if (isImg2Img) {
        refImage = img2ImgSource === "current" ? activeClip.imageUrl : customImg2ImgUrl.trim();
        setGenerationLogs(prev => [...prev, `🖼️ Img2Img mode — strength: ${img2ImgStrength}`]);
      }

      setGenerationLogs(prev => [...prev, "⏳ Awaiting Agnes API response..."]);

      const imageUrl = await generateImageApi(
        apiKey,
        promptToUse,
        size,
        refImage,
        (useCharacterAnchor && characterAnchor?.sheetUrl) ? 0.6 : (isImg2Img ? img2ImgStrength : undefined)
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const cacheBustedUrl = imageUrl ? `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}t=${Date.now()}` : "";
      onUpdateClip({ imageUrl: cacheBustedUrl });

      // Add to image history
      const historyEntry: HistoryImage = {
        id: `hist_${Date.now()}`,
        url: cacheBustedUrl,
        prompt: promptToUse,
        timestamp: Date.now(),
      };
      const currentHistory = activeClip.imageHistory || [];
      onUpdateClip({ imageUrl: cacheBustedUrl, imageHistory: [...currentHistory, historyEntry] });

      setGenerationLogs(prev => [
        ...prev,
        `✅ API responded — ${elapsed}s elapsed`,
        "🎉 Image URL received and synced to scene"
      ]);
      if (onToast) {
        onToast(createToast("success", `Image generated in ${elapsed}s`));
      }
    } catch (err: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const errMsg = err.message || "An error occurred while generating the image.";
      setError(errMsg);
      setGenerationLogs(prev => [
        ...prev,
        `❌ API error after ${elapsed}s: ${errMsg}`
      ]);
      setIsImageLoading(false);
      if (onToast) {
        onToast(createToast("error", `Image generation failed: ${errMsg}`));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyManualUrl = () => {
    if (!manualUrl.trim().startsWith("http")) {
      setError("Please enter a valid HTTP/HTTPS image URL.");
      return;
    }
    const cleanUrl = manualUrl.trim();
    const cacheBustedUrl = `${cleanUrl}${cleanUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
    setIsImageLoading(true);
    onUpdateClip({ imageUrl: cacheBustedUrl });
    setManualUrl("");
    setError(null);
  };

  return (
    <div className="bg-[#161618] rounded-2xl border border-white/5 p-6 space-y-6" id="image-generate-step">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onPrev}
            className="p-1.5 hover:bg-white/5 text-slate-500 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">2. Generate Base Image</h2>
            <p className="text-sm text-slate-400 mt-1">
              Create the high-density keyframe using Agnes 2.1 Image generator.
            </p>
          </div>
        </div>
        <div className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Agnes Image 2.1 Flash
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 text-red-400 rounded-xl text-sm border border-red-900/30">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Configuration & Actions (4 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Selected Image Prompt</span>
              <span className="text-[10px] text-orange-500 font-normal lowercase bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">editable</span>
            </h4>
            <textarea
              className="w-full p-3 bg-[#1a1a1c] border border-white/5 rounded-xl text-xs text-slate-200 leading-relaxed h-28 focus:outline-none focus:border-orange-500/40 resize-none"
              placeholder="输入或修改图片提示词..."
              value={activeClip.imagePrompt || ""}
              onChange={(e) => onUpdateClip({ imagePrompt: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Image Aspect Ratio & Size
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Landscape (4:3)", val: "1024x768" },
                { label: "Portrait (3:4)", val: "768x1024" },
                { label: "Square (1:1)", val: "1024x1024" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setSize(opt.val)}
                  className={`px-3 py-2 text-xs rounded-xl border text-center transition-all cursor-pointer font-medium ${
                    size === opt.val
                      ? "border-orange-500/40 bg-orange-500/10 text-orange-400 font-bold"
                      : "border-white/10 bg-[#1f1f22] text-slate-400 hover:border-white/20"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Image-to-Image (图生图) Control Section */}
          <div className="bg-[#1a1a1c] border border-white/5 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500 animate-pulse" />
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">图生图</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isImg2Img}
                  onChange={(e) => setIsImg2Img(e.target.checked)}
                />
                <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-600 peer-checked:after:bg-white peer-checked:after:border-orange-600"></div>
              </label>
            </div>

            {isImg2Img && (
              <div className="space-y-4 pt-2 border-t border-white/5">
                {/* Source Selection */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] text-slate-400">参考图片来源</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!activeClip.imageUrl}
                      onClick={() => setImg2ImgSource("current")}
                      className={`px-3 py-2 text-[11px] rounded-lg border text-center transition-all cursor-pointer font-medium ${
                        img2ImgSource === "current" && activeClip.imageUrl
                          ? "border-orange-500/40 bg-orange-500/10 text-orange-400 font-bold"
                          : "border-white/5 bg-[#1f1f22] text-slate-400 hover:border-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                      }`}
                    >
                      Current Scene Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setImg2ImgSource("custom")}
                      className={`px-3 py-2 text-[11px] rounded-lg border text-center transition-all cursor-pointer font-medium ${
                        img2ImgSource === "custom"
                          ? "border-orange-500/40 bg-orange-500/10 text-orange-400 font-bold"
                          : "border-white/5 bg-[#1f1f22] text-slate-400 hover:border-white/10"
                      }`}
                    >
                      Custom Image URL
                    </button>
                  </div>
                </div>

                {/* Custom URL Input if selected */}
                {img2ImgSource === "custom" && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] text-slate-400">Custom Image URL</label>
                    <input
                      type="text"
                      placeholder="粘贴源图片 URL..."
                      className="w-full px-3 py-2 text-xs bg-[#1f1f22] border border-white/5 rounded-lg text-slate-200 focus:outline-none focus:border-orange-500/40"
                      value={customImg2ImgUrl}
                      onChange={(e) => setCustomImg2ImgUrl(e.target.value)}
                    />
                  </div>
                )}

                {/* Show thumbnail of the selected reference image */}
                <div className="bg-[#131315] p-2 rounded-xl border border-white/5 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {img2ImgSource === "current" && activeClip.imageUrl ? (
                      <img src={activeClip.imageUrl} className="w-full h-full object-cover" alt="ref" referrerPolicy="no-referrer" />
                    ) : img2ImgSource === "custom" && customImg2ImgUrl.trim().startsWith("http") ? (
                      <img src={customImg2ImgUrl} className="w-full h-full object-cover" alt="ref" referrerPolicy="no-referrer" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-300 truncate">
                      {img2ImgSource === "current" ? "Current Scene Image" : "Custom Source"}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {img2ImgSource === "current" && activeClip.imageUrl
                        ? activeClip.imageUrl
                        : img2ImgSource === "custom" && customImg2ImgUrl
                        ? customImg2ImgUrl
                        : "No reference image selected"}
                    </p>
                  </div>
                </div>

                {/* Style Strength slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">提示词影响度（强度）</span>
                    <span className="text-orange-400 font-mono font-bold">{img2ImgStrength.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    className="w-full accent-orange-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    value={img2ImgStrength}
                    onChange={(e) => setImg2ImgStrength(parseFloat(e.target.value))}
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>保持风格 (0.1)</span>
                    <span>平衡 (0.5)</span>
                    <span>更多变化 (0.9)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={
              isGenerating ||
              !activeClip.imagePrompt ||
              (isImg2Img && img2ImgSource === "current" && !activeClip.imageUrl) ||
              (isImg2Img && img2ImgSource === "custom" && !customImg2ImgUrl.trim().startsWith("http"))
            }
            className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 disabled:bg-[#1f1f22] disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                {isImg2Img ? "Agnes Generating Img2Img..." : "Agnes Generating Base Image..."}
              </>
            ) : (
              <>
                {isImg2Img ? (
                  <Sparkles className="w-4 h-4 text-orange-300" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-orange-300" />
                )}
                {isImg2Img ? "Generate Img2Img Keyframe" : "Generate Keyframe"}
              </>
            )}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-4 text-xs text-slate-500 uppercase">或导入图片</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400">
              Paste Custom Image URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://example.com/character.jpg"
                className="flex-1 px-3 py-2 text-xs bg-[#1f1f22] border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-orange-500/50"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
              />
              <button
                onClick={handleApplyManualUrl}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-white/5 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Upload className="w-3 h-3" />
                Import
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Preview (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center min-h-[300px] w-full">
          {isGenerating ? (
            <div className="w-full h-full bg-[#131315] border border-orange-500/20 rounded-2xl p-8 flex flex-col items-center justify-center gap-6 text-center min-h-[350px] shadow-lg shadow-orange-950/5">
              <div className="relative flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-4 border-orange-500/10 border-t-orange-500 animate-spin"></div>
                <Hourglass className="w-8 h-8 text-orange-500 absolute animate-bounce" />
              </div>
              <div className="space-y-3 max-w-md">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
                  JOB DISPATCHED: {activeJobId}
                </div>
                <h3 className="text-base font-semibold text-slate-100">正在合成高细节帧</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Agnes's neural engine is assembling volumetric lighting, surface reflections, and composition details. This typically takes 3-8 seconds.
                </p>
              </div>
              
              {/* Interactive Pipeline Logs */}
              <div className="w-full max-w-sm bg-[#1a1a1c] border border-white/5 rounded-xl p-4 text-left font-mono text-[10px] space-y-1.5 shadow-inner max-h-48 overflow-y-auto">
                <div className="text-xs font-semibold text-slate-400 border-b border-white/5 pb-1 mb-2 flex items-center justify-between">
                  <span>流程日志</span>
                  <span className="text-[10px] text-orange-500 animate-pulse">实时追踪</span>
                </div>
                {generationLogs.map((log, idx) => {
                  const isLast = idx === generationLogs.length - 1;
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
                  🔴 GENERATION FAILED {activeJobId && `(JOB: ${activeJobId})`}
                </div>
                <h3 className="text-base font-semibold text-slate-100">Neural Synthesis Interrupted</h3>
                <p className="text-xs text-red-300 leading-relaxed bg-red-950/20 border border-red-900/30 p-3 rounded-xl max-h-24 overflow-y-auto w-full">
                  {error}
                </p>
                <p className="text-[11px] text-slate-400">
                  Please review the logs below, verify your API settings or prompt structure, and try again.
                </p>
              </div>

              {/* Interactive Pipeline Logs (Failed State) */}
              <div className="w-full max-w-sm bg-[#1a1a1c] border border-white/5 rounded-xl p-4 text-left font-mono text-[10px] space-y-1.5 shadow-inner max-h-48 overflow-y-auto">
                <div className="text-xs font-semibold text-slate-400 border-b border-white/5 pb-1 mb-2 flex items-center justify-between">
                  <span>流程日志（已中止）</span>
                  <span className="text-[10px] text-red-500 font-bold">失败</span>
                </div>
                {generationLogs.map((log, idx) => {
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
                onClick={handleGenerate}
                className="px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Image Generation
              </button>
            </div>
          ) : activeClip.imageUrl ? (
            <div className="w-full space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-white/5 group shadow-lg bg-[#09090A] min-h-[250px] flex items-center justify-center">
                {isImageLoading && (
                  <div className="absolute inset-0 bg-[#1a1a1c] flex flex-col items-center justify-center gap-3 text-center z-10">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin"></div>
                      <ImageIcon className="w-4 h-4 text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <p className="text-xs text-slate-400">正在加载关键帧到浏览器画布...</p>
                  </div>
                )}
                <img
                  src={activeClip.imageUrl}
                  alt="Generated keyframe"
                  referrerPolicy="no-referrer"
                  className={`w-full h-auto max-h-[380px] object-contain mx-auto transition-all duration-300 ${isImageLoading ? "opacity-0 scale-95" : "opacity-90 scale-100"}`}
                  onLoad={() => setIsImageLoading(false)}
                  onError={() => setIsImageLoading(false)}
                />
                {!isImageLoading && (
                  <div className="absolute top-3 right-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Keyframe Synced
                  </div>
                )}
              </div>

              {/* Image History Panel */}
              {(activeClip.imageHistory?.length ?? 0) > 0 && (
                <ImageHistoryPanel
                  images={activeClip.imageHistory || []}
                  onSelect={(img) => {
                    onUpdateClip({ imageUrl: img.url });
                    setIsImageLoading(true);
                  }}
                  onDragStart={(img) => {
                    // Drag started - handled by drop zone
                  }}
                />
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onNext}
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-orange-950/20"
                >
                  Step 3: Turn Image to Video
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div
              className="w-full h-full bg-[#1a1a1c] border-2 border-dashed border-white/5 rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-center min-h-[350px] transition-colors"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("border-orange-500/50", "bg-orange-500/5");
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("border-orange-500/50", "bg-orange-500/5");
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("border-orange-500/50", "bg-orange-500/5");
                try {
                  const data = JSON.parse(e.dataTransfer.getData("application/json"));
                  if (data.url) {
                    const cacheBustedUrl = `${data.url}${data.url.includes("?") ? "&" : "?"}t=${Date.now()}`;
                    onUpdateClip({ imageUrl: cacheBustedUrl });
                    setIsImageLoading(true);
                    setError(null);
                  }
                } catch {}
              }}
            >
              <div className="w-12 h-12 rounded-full bg-[#1f1f22] flex items-center justify-center text-slate-500">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-300 font-sans">尚未生成关键帧</p>
                <p className="text-xs text-slate-500 max-w-sm">
                  Generate your custom image, import an existing URL, or drag an image from history.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
