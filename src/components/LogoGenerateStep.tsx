/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, ArrowLeft, ArrowRight, RefreshCw, Package, SkipForward, AlertTriangle } from "lucide-react";
import { Product, LogoResult, LogoVariant, TaskStatus } from "../types";
import { generateLogoApi } from "../utils/api";
import { autoSaveImage } from "../utils/api";
import { createToast } from "./Toast";
import DragDropZone from "./DragDropZone";
import ImageVariantGrid from "./ImageVariantGrid";

interface LogoGenerateStepProps {
  apiKey: string;
  product: Product;
  variants: LogoVariant[];
  isGenerating: boolean;
  onVariantsChange: (variants: LogoVariant[]) => void;
  onGeneratingChange: (generating: boolean) => void;
  onLogoSelected: (imageUrl: string) => void;
  onBack: () => void;
  onNext: (logoResult: LogoResult) => void;
  onSkip?: () => void;
  addToast?: (toast: any) => void;
}

export default function LogoGenerateStep({
  apiKey,
  product,
  variants,
  isGenerating,
  onVariantsChange,
  onGeneratingChange,
  onLogoSelected,
  onBack,
  onNext,
  onSkip,
  addToast,
}: LogoGenerateStepProps) {
  const [referenceImage, setReferenceImage] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const [variantCount, setVariantCount] = useState(3);
  const [failedVariants, setFailedVariants] = useState<Set<string>>(new Set());
  const [genLogs, setGenLogs] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Retry-able image generation with exponential backoff
  const generateImageWithRetry = async (
    apiKey: string,
    prompt: string,
    maxRetries = 3
  ): Promise<string> => {
    let delay = 3000; // Start with 3s
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Check if cancelled
      if (abortRef.current?.signal.aborted) throw new Error("Cancelled");

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2min timeout

        const response = await fetch("/api/proxy/images", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "agnes-image-2.1-flash",
            prompt,
            n: 1,
            size: "1024x1024",
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const msg = errData.error || `HTTP ${response.status}`;
          // Retry on 503 / busy, throw on everything else
          const isRetryable = response.status === 503 || msg.includes("busy") || msg.includes("rate");
          if (isRetryable && attempt < maxRetries) {
            addToast?.(createToast("info", `API busy, retrying in ${delay / 1000}s... (${attempt}/${maxRetries})`));
            await new Promise((r) => setTimeout(r, delay));
            delay *= 1.5; // Exponential backoff
            continue;
          }
          throw new Error(msg);
        }

        const data = await response.json();
        const imageUrl = data.data?.[0]?.url;
        if (!imageUrl) throw new Error("No image URL in response");
        return imageUrl;
      } catch (err: any) {
        if (err.name === "AbortError") throw new Error("Cancelled");
        if (attempt === maxRetries) throw err;
        addToast?.(createToast("info", `Variant failed (attempt ${attempt}), retrying...`));
        await new Promise((r) => setTimeout(r, delay));
        delay *= 1.5;
      }
    }
    throw new Error("Max retries exceeded");
  };

  const handleGenerate = async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setFailedVariants(new Set());
    setGenLogs(["🕐 Starting logo generation pipeline..."]);
    onGeneratingChange(true);
    let localFailedCount = 0;
    try {
      setGenLogs(prev => [...prev, `📡 Requesting ${variantCount} logo prompts from Agnes AI...`]);
      const result = await generateLogoApi(apiKey, product, variantCount);
      setGenLogs(prev => [...prev, `✅ Received ${result.variants.length} prompts, starting image generation...`]);

      // Create variants from the prompts
      const newVariants: LogoVariant[] = result.variants.map((prompt, i) => ({
        id: `logo_${Date.now()}_${i}`,
        prompt,
        status: "idle" as TaskStatus,
      }));

      onVariantsChange(newVariants);

      // Generate images for each variant sequentially with delay
      const interRequestDelay = 4000;
      for (let i = 0; i < newVariants.length; i++) {
        const variant = newVariants[i];
        setGenLogs(prev => [...prev, `🎨 Generating variant ${i + 1}/${newVariants.length}...`]);
        onVariantsChange(newVariants.map((v) => (v.id === variant.id ? { ...v, status: "generating" as TaskStatus } : v)));

        try {
          const imageUrl = await generateImageWithRetry(apiKey, variant.prompt);
          onVariantsChange(newVariants.map((v) =>
            v.id === variant.id ? { ...v, imageUrl, status: "completed" as TaskStatus } : v
          ));
          setGenLogs(prev => [...prev, `✅ Variant ${i + 1} done`]);
          autoSaveImage(imageUrl, `logo_${i + 1}`);
        } catch (err: any) {
          console.error(`Failed to generate logo variant ${i + 1}:`, err);
          setGenLogs(prev => [...prev, `❌ Variant ${i + 1} failed: ${err.message}`]);
          onVariantsChange(newVariants.map((v) =>
            v.id === variant.id ? { ...v, status: "failed" as TaskStatus } : v
          ));
          setFailedVariants((prev) => new Set([...prev, variant.id]));
          localFailedCount++;
          addToast?.(createToast("error", `Logo variant ${i + 1} failed: ${err.message}`));
        }

        // Delay between requests
        if (i < newVariants.length - 1) {
          setGenLogs(prev => [...prev, `⏳ Waiting ${interRequestDelay / 1000}s before next variant...`]);
          await new Promise((r) => setTimeout(r, interRequestDelay));
        }
      }

      setGenLogs(prev => [...prev,
        localFailedCount === 0
          ? `🎉 All ${newVariants.length} logos generated successfully!`
          : `⚠️ ${localFailedCount}/${newVariants.length} variants failed`
      ]);
      if (localFailedCount > 0 && localFailedCount < newVariants.length) {
        addToast?.(createToast("warning", `${localFailedCount}/${newVariants.length} variants failed. Retry individually or reduce batch size.`));
      } else if (localFailedCount === newVariants.length) {
        addToast?.(createToast("error", "All logo variants failed. Check API key and try again."));
      } else {
        addToast?.(createToast("success", `Generated ${newVariants.length} logos successfully!`));
      }
    } catch (err: any) {
      console.error("Failed to generate logo prompts:", err);
      setGenLogs(prev => [...prev, `❌ Failed: ${err.message}`]);
      addToast?.(createToast("error", `Logo generation failed: ${err.message}`));
    } finally {
      abortRef.current = null;
      onGeneratingChange(false);
    }
  };

  const handleRegenerate = async (variantId: string) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;

    const prompt = editedPrompts[variantId] || variant.prompt;

    onVariantsChange(variants.map((v) => (v.id === variantId ? { ...v, status: "generating" as TaskStatus } : v)));

    try {
      const response = await fetch("/api/proxy/images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "agnes-image-2.1-flash",
          prompt,
          n: 1,
          size: "1024x1024",
        }),
      });

      if (!response.ok) throw new Error(`Image generation failed: ${response.status}`);

      const data = await response.json();
      const imageUrl = data.data?.[0]?.url;

      if (imageUrl) {
        onVariantsChange(variants.map((v) =>
          v.id === variantId ? { ...v, prompt, imageUrl, status: "completed" as TaskStatus } : v
        ));
        // Auto-save to output folder
        const idx = variants.findIndex(v => v.id === variantId);
        autoSaveImage(imageUrl, `logo_${idx + 1}_regen`);
      }
    } catch (err) {
      onVariantsChange(variants.map((v) =>
        v.id === variantId ? { ...v, status: "failed" as TaskStatus } : v
      ));
    }
  };

  const handleUseSelected = () => {
    if (!selectedId) return;
    const variant = variants.find((v) => v.id === selectedId);
    if (!variant?.imageUrl) return;

    onLogoSelected(variant.imageUrl);
    onNext({
      id: `logo_${Date.now()}`,
      product,
      variants,
      createdAt: Date.now(),
    });
  };

  const completedCount = variants.filter((v) => v.status === "completed").length;

  return (
    <div className="min-h-screen bg-[#0f0f11] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-400" />
                Logo Generator
              </h1>
              <p className="text-xs text-slate-400 mt-1">AI designs {variantCount} style variants for {product.name}</p>
            </div>
          </div>
          {completedCount > 0 && (
            <button
              onClick={handleUseSelected}
              disabled={!selectedId}
              className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              Use Selected Logo
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {onSkip && (
            <button
              onClick={onSkip}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-white/10 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Skip Logo
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Product Info + Reference */}
          <div className="space-y-4">
            {/* Product Card */}
            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <Package className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-semibold text-slate-300">Product Info</span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500">Name:</span>
                  <span className="text-slate-200">{product.name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Description:</span>
                  <span className="text-slate-200 line-clamp-2">{product.description}</span>
                </div>
                <div>
                  <span className="text-slate-500">Category:</span>
                  <span className="text-slate-200">{product.category}</span>
                </div>
                <div>
                  <span className="text-slate-500">Style:</span>
                  <span className="text-slate-200">{product.style}</span>
                </div>
              </div>
            </div>

            {/* Reference Image */}
            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-300 block mb-3">Reference Logo (optional)</span>
              <DragDropZone
                onImageDrop={setReferenceImage}
                currentImage={referenceImage}
                onClear={() => setReferenceImage(undefined)}
              />
            </div>

            {/* Variant Count */}
            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-300 block mb-1">Variants</span>
              <div className="flex gap-2">
                {[3, 5].map((count) => (
                  <button
                    key={count}
                    onClick={() => setVariantCount(count)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      variantCount === count
                        ? "bg-orange-600/20 text-orange-300 border border-orange-500/30"
                        : "bg-[#1f1f22] text-slate-400 border border-white/5 hover:bg-white/5"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Logo
                </>
              )}
            </button>
          </div>

          {/* Right: Variants Grid */}
          <div className="lg:col-span-2 space-y-4">
            {/* Live Generation Progress Panel */}
            {isGenerating && (
              <div className="bg-[#1a1a1c] border border-orange-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generating logos...
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {variants.length > 0
                      ? `${variants.filter(v => v.status === "completed").length}/${variants.length} done`
                      : `Prompting AI...`}
                  </span>
                </div>

                {/* Progress bar */}
                {variants.length > 0 && (
                  <div className="w-full h-1.5 bg-[#1f1f22] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
                      style={{ width: `${(variants.filter(v => v.status === "completed").length / variants.length) * 100}%` }}
                    />
                  </div>
                )}

                {/* Live logs */}
                <div className="bg-[#131315] border border-white/5 rounded-lg p-3 font-mono text-[10px] space-y-1 max-h-40 overflow-y-auto">
                  {genLogs.map((log, i) => {
                    const isLast = i === genLogs.length - 1;
                    const isError = log.includes("❌");
                    const isSuccess = log.includes("✅") || log.includes("🎉");
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 ${isError ? "text-red-400" : isLast ? "text-orange-400 animate-pulse" : isSuccess ? "text-green-400" : "text-slate-400"}`}
                      >
                        <span className="text-[9px] text-slate-600 select-none">[{i + 1}]</span>
                        <span>{log}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {variants.length > 0 ? (
              <>
                <ImageVariantGrid
                  variants={variants}
                  onSelect={setSelectedId}
                  selectedId={selectedId}
                  onRegenerate={handleRegenerate}
                  onDragImage={(url) => {
                    // When image dragged from grid, set it as reference for prompt editing
                    setReferenceImage(url);
                    addToast?.(createToast("info", "Image set as reference. Edit prompt and regenerate."));
                  }}
                />

                {/* Prompt Refinement Area - show only selected variant */}
                {selectedId && (() => {
                  const selectedVariant = variants.find(v => v.id === selectedId);
                  if (!selectedVariant || selectedVariant.status !== "completed") return null;
                  return (
                    <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
                      <span className="text-xs font-semibold text-slate-300 block mb-3">Edit Prompt & Regenerate</span>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <textarea
                            value={editedPrompts[selectedVariant.id] ?? selectedVariant.prompt}
                            onChange={(e) => setEditedPrompts(prev => ({ ...prev, [selectedVariant.id]: e.target.value }))}
                            rows={4}
                            className="w-full px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-300 resize-none focus:outline-none focus:border-orange-500/30"
                          />
                          <button
                            onClick={() => handleRegenerate(selectedVariant.id)}
                            className="mt-2 px-4 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Regenerate
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-12 text-center">
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-spin" />
                    <p className="text-sm text-slate-300">AI is generating logo prompts...</p>
                    <p className="text-xs text-slate-500 mt-1">This takes a few seconds</p>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-sm text-slate-400">Click "Generate Logo" to start designing</p>
                    <p className="text-xs text-slate-500 mt-1">AI will create {variantCount} different style variants for your product</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
