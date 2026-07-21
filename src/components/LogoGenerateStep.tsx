/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Sparkles, ArrowLeft, ArrowRight, RefreshCw, Package, SkipForward } from "lucide-react";
import { Product, LogoResult, LogoVariant, TaskStatus } from "../types";
import { generateLogoApi, autoSaveImage } from "../utils/api";
import { createToast } from "./Toast";
import DragDropZone from "./DragDropZone";
import ImageVariantGrid from "./ImageVariantGrid";

interface LogoGenerateStepProps {
  apiKey: string;
  product: Product;
  variants: LogoVariant[];
  isGenerating: boolean;
  onVariantsChange: React.Dispatch<React.SetStateAction<LogoVariant[]>> | ((variants: LogoVariant[]) => void);
  onGeneratingChange: (generating: boolean) => void;
  onLogoSelected: (imageUrl: string) => void;
  onBack: () => void;
  onNext: (logoResult: LogoResult) => void;
  onSkip?: () => void;
  addToast?: (toast: ReturnType<typeof createToast>) => void;
}

function fallbackPrompts(product: Product, count: number): string[] {
  const styles = [
    `minimalist clean modern professional logo for "${product.name}", ${product.description}, simple geometric icon, flat design, vector-style, white background, sharp, 4k`,
    `vibrant bold energetic logo for "${product.name}", ${product.description}, dynamic shapes, bright colors, vector-style, clean background, sharp, 4k`,
    `premium luxury elegant logo for "${product.name}", ${product.description}, sophisticated typography, gold accents, vector-style, clean background, sharp, 4k`,
    `playful creative colorful logo for "${product.name}", ${product.description}, friendly rounded shapes, vector-style, white background, sharp, 4k`,
    `corporate professional logo for "${product.name}", ${product.description}, trustworthy brand mark, blue tones, vector-style, clean background, sharp, 4k`,
  ];
  return styles.slice(0, count);
}

function asPromptString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const p = o.prompt || o.text || o.description || o.content;
    if (typeof p === "string") return p.trim();
  }
  return "";
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
  const [genLogs, setGenLogs] = useState<string[]>([]);
  // Local run control — do NOT abort on unmount (StrictMode/remount was killing jobs)
  const cancelledRef = useRef(false);
  const runIdRef = useRef(0);

  const pushLog = (line: string) => {
    setGenLogs((prev) => [...prev, line]);
    console.log("[LogoGen]", line);
  };

  const setVariantsSafe = (next: LogoVariant[] | ((prev: LogoVariant[]) => LogoVariant[])) => {
    // Support both setState and plain callbacks
    try {
      (onVariantsChange as React.Dispatch<React.SetStateAction<LogoVariant[]>>)(next as any);
    } catch {
      if (typeof next === "function") {
        // cannot read prev without setState — fall through with empty
        onVariantsChange((next as (p: LogoVariant[]) => LogoVariant[])(variants));
      } else {
        onVariantsChange(next);
      }
    }
  };

  const patchVariant = (id: string, patch: Partial<LogoVariant>) => {
    setVariantsSafe((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  const generateImageWithRetry = async (
    key: string,
    prompt: string,
    maxRetries = 3
  ): Promise<string> => {
    let delay = 2500;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (cancelledRef.current) throw new Error("Cancelled");

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min — image API can be slow

        let response: Response;
        try {
          response = await fetch("/api/proxy/images", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: "agnes-image-2.1-flash",
              prompt,
              n: 1,
              size: "1024x1024",
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const msg = errData.error || `HTTP ${response.status}`;
          const isRetryable =
            response.status === 503 ||
            response.status === 429 ||
            response.status === 502 ||
            response.status === 504 ||
            String(msg).toLowerCase().includes("busy") ||
            String(msg).toLowerCase().includes("rate") ||
            String(msg).toLowerCase().includes("timeout") ||
            String(msg).toLowerCase().includes("limit");
          if (isRetryable && attempt < maxRetries) {
            const retryDelay = response.status === 429 ? 45000 : delay;
            pushLog(`⏳ API busy/retryable (${response.status}), wait ${retryDelay / 1000}s… (${attempt}/${maxRetries})`);
            addToast?.(createToast("info", `API busy, retrying in ${retryDelay / 1000}s...`));
            await new Promise((r) => setTimeout(r, retryDelay));
            delay *= 1.5;
            continue;
          }
          throw new Error(msg);
        }

        const data = await response.json();
        // Support multiple response shapes
        const imageUrl =
          data.data?.[0]?.url ||
          data.url ||
          data.image_url ||
          data.images?.[0]?.url;
        if (!imageUrl) {
          console.error("[LogoGen] unexpected image response:", data);
          throw new Error("No image URL in response");
        }
        return imageUrl as string;
      } catch (err: any) {
        if (cancelledRef.current) throw new Error("Cancelled");
        if (err?.name === "AbortError") {
          if (attempt < maxRetries) {
            pushLog(`⚠️ Request timeout, retry ${attempt}/${maxRetries}`);
            await new Promise((r) => setTimeout(r, delay));
            delay *= 1.5;
            continue;
          }
          throw new Error("Image request timed out");
        }
        if (attempt === maxRetries) throw err;
        pushLog(`⚠️ Attempt ${attempt} failed: ${err?.message || err}, retrying…`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 1.5;
      }
    }
    throw new Error("Max retries exceeded");
  };

  const handleGenerate = async () => {
    cancelledRef.current = false;
    const runId = ++runIdRef.current;

    setGenLogs(["🕐 Starting logo generation pipeline..."]);
    onGeneratingChange(true);

    let localFailedCount = 0;
    let prompts: string[] = [];

    try {
      if (!apiKey?.trim()) {
        throw new Error("API key is empty. Enter your Agnes API key in the sidebar.");
      }

      pushLog(`📡 Requesting ${variantCount} logo prompts...`);
      try {
        const result = await generateLogoApi(apiKey, product, variantCount);
        if (runId !== runIdRef.current) return;

        const raw = result?.variants || [];
        prompts = raw.map(asPromptString).filter((s) => s.length > 8);

        if ((result as any)?.fallback || (result as any)?.warning) {
          pushLog(`⚠️ Prompt API used fallback: ${(result as any).warning || "template prompts"}`);
        }

        if (prompts.length === 0) {
          pushLog("⚠️ Empty prompts from API, using local templates");
          prompts = fallbackPrompts(product, variantCount);
        } else {
          pushLog(`✅ Got ${prompts.length} prompts`);
        }
      } catch (promptErr: any) {
        // Do not abort the whole pipeline — fall back to templates and still generate images
        pushLog(`⚠️ Prompt API failed: ${promptErr?.message || promptErr}`);
        pushLog("➡️ Continuing with local template prompts so images can still generate");
        prompts = fallbackPrompts(product, variantCount);
        addToast?.(
          createToast("warning", `Prompt API failed, using templates: ${promptErr?.message || promptErr}`)
        );
      }

      if (runId !== runIdRef.current || cancelledRef.current) return;

      // Cap to requested count
      prompts = prompts.slice(0, variantCount);
      while (prompts.length < variantCount) {
        prompts.push(...fallbackPrompts(product, variantCount - prompts.length));
      }

      const baseId = Date.now();
      const newVariants: LogoVariant[] = prompts.map((prompt, i) => ({
        id: `logo_${baseId}_${i}`,
        prompt,
        status: "idle" as TaskStatus,
      }));

      setVariantsSafe(newVariants);
      pushLog(`🎨 Generating ${newVariants.length} logo images (sequential, 2s gap)...`);

      // Sequential generation — more reliable under rate limits than concurrent burst
      const GAP_MS = 2000;
      for (let i = 0; i < newVariants.length; i++) {
        if (runId !== runIdRef.current || cancelledRef.current) {
          pushLog("⏹ Cancelled");
          break;
        }

        const variant = newVariants[i];
        patchVariant(variant.id, { status: "generating" });
        pushLog(`🎨 Variant ${i + 1}/${newVariants.length}...`);
        pushLog(`   prompt: ${variant.prompt.slice(0, 100)}${variant.prompt.length > 100 ? "…" : ""}`);

        try {
          const imageUrl = await generateImageWithRetry(apiKey, variant.prompt);
          if (runId !== runIdRef.current || cancelledRef.current) break;

          patchVariant(variant.id, { imageUrl, status: "completed" });
          pushLog(`✅ Variant ${i + 1} done`);
          autoSaveImage(imageUrl, `logo_${i + 1}`);
        } catch (err: any) {
          if (err?.message === "Cancelled") break;
          console.error(`Logo variant ${i + 1} failed:`, err);
          patchVariant(variant.id, { status: "failed" });
          pushLog(`❌ Variant ${i + 1} failed: ${err?.message || err}`);
          localFailedCount++;
          addToast?.(createToast("error", `Logo ${i + 1}: ${err?.message || err}`));
        }

        if (i < newVariants.length - 1 && !cancelledRef.current) {
          pushLog(`⏳ ${GAP_MS / 1000}s before next…`);
          await new Promise((r) => setTimeout(r, GAP_MS));
        }
      }

      if (runId !== runIdRef.current) return;

      const total = newVariants.length;
      if (localFailedCount === 0 && !cancelledRef.current) {
        pushLog(`🎉 All ${total} logos generated!`);
        addToast?.(createToast("success", `Generated ${total} logos successfully!`));
      } else if (localFailedCount === total) {
        pushLog(`⚠️ All ${total} variants failed — check API key / image API errors above`);
        addToast?.(createToast("error", "All logo variants failed. Check API key and server logs."));
      } else if (localFailedCount > 0) {
        pushLog(`⚠️ ${localFailedCount}/${total} failed`);
        addToast?.(createToast("warning", `${localFailedCount}/${total} logos failed`));
      }
    } catch (err: any) {
      if (err?.message === "Cancelled") return;
      console.error("Logo generation failed:", err);
      pushLog(`❌ Failed: ${err?.message || err}`);
      addToast?.(createToast("error", `Logo generation failed: ${err?.message || err}`));
    } finally {
      if (runId === runIdRef.current) {
        onGeneratingChange(false);
      }
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    runIdRef.current += 1;
    onGeneratingChange(false);
    pushLog("⏹ Cancelled by user");
  };

  const handleRegenerate = async (variantId: string) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;

    const prompt = editedPrompts[variantId] || variant.prompt;
    patchVariant(variantId, { status: "generating" });
    pushLog(`🔄 Regenerating ${variantId}...`);

    try {
      const imageUrl = await generateImageWithRetry(apiKey, prompt);
      patchVariant(variantId, { prompt, imageUrl, status: "completed" });
      const idx = variants.findIndex((v) => v.id === variantId);
      autoSaveImage(imageUrl, `logo_${idx + 1}_regen`);
      pushLog(`✅ Regenerated ${variantId}`);
    } catch (err: any) {
      patchVariant(variantId, { status: "failed" });
      pushLog(`❌ Regen failed: ${err?.message || err}`);
      addToast?.(createToast("error", `Regenerate failed: ${err?.message || err}`));
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
  // Keep progress panel after generation so errors/status don't "disappear"
  const showProgress = isGenerating || genLogs.length > 0;

  return (
    <div className="min-h-screen bg-[#0f0f11] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-400" />
                Logo 生成器
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                AI designs {variantCount} style variants for {product.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <button
                onClick={handleUseSelected}
                disabled={!selectedId}
                className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                使用选中的 Logo
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onSkip && (
              <button
                onClick={onSkip}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-white/10 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                <SkipForward className="w-3.5 h-3.5" />
                跳过 Logo
              </button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <Package className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-semibold text-slate-300">产品信息</span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500">名称： </span>
                  <span className="text-slate-200">{product.name || "(empty)"}</span>
                </div>
                <div>
                  <span className="text-slate-500">描述： </span>
                  <span className="text-slate-200 line-clamp-2">{product.description || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500">风格： </span>
                  <span className="text-slate-200">{product.style}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-300 block mb-3">
                参考 Logo（可选）
              </span>
              <DragDropZone
                onImageDrop={setReferenceImage}
                currentImage={referenceImage}
                onClear={() => setReferenceImage(undefined)}
              />
            </div>

            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-300 block mb-1">Variants</span>
              <div className="flex gap-2">
                {[3, 5].map((count) => (
                  <button
                    key={count}
                    onClick={() => setVariantCount(count)}
                    disabled={isGenerating}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      variantCount === count
                        ? "bg-orange-600/20 text-orange-300 border border-orange-500/30"
                        : "bg-[#1f1f22] text-slate-400 border border-white/5 hover:bg-white/5"
                    } disabled:opacity-50`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !product.name?.trim()}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  生成 Logo
                </>
              )}
            </button>

            {isGenerating && (
              <button
                onClick={handleCancel}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {showProgress && (
              <div
                className={`bg-[#1a1a1c] border rounded-xl p-4 space-y-3 ${
                  isGenerating ? "border-orange-500/30" : "border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold flex items-center gap-1.5 ${
                      isGenerating ? "text-orange-400" : "text-slate-300"
                    }`}
                  >
                    {isGenerating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {isGenerating ? "正在生成 Logo..." : "生成日志（完成后保留）"}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {variants.length > 0
                      ? `${variants.filter((v) => v.status === "completed").length}/${variants.length} done`
                      : isGenerating
                        ? "working..."
                        : ""}
                  </span>
                </div>

                {variants.length > 0 && (
                  <div className="w-full h-1.5 bg-[#1f1f22] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
                      style={{
                        width: `${
                          (variants.filter(
                            (v) => v.status === "completed" || v.status === "failed"
                          ).length /
                            Math.max(variants.length, 1)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                )}

                <div className="bg-[#131315] border border-white/5 rounded-lg p-3 font-mono text-[10px] space-y-1 max-h-52 overflow-y-auto">
                  {genLogs.map((log, i) => {
                    const isLast = i === genLogs.length - 1;
                    const isError = log.includes("❌");
                    const isSuccess = log.includes("✅") || log.includes("🎉");
                    const isWarn = log.includes("⚠️");
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 ${
                          isError
                            ? "text-red-400"
                            : isWarn
                              ? "text-amber-400"
                              : isLast && isGenerating
                                ? "text-orange-400 animate-pulse"
                                : isSuccess
                                  ? "text-green-400"
                                  : "text-slate-400"
                        }`}
                      >
                        <span className="text-[9px] text-slate-600 select-none">[{i + 1}]</span>
                        <span className="break-all">{log}</span>
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
                    setReferenceImage(url);
                    addToast?.(createToast("info", "图片已设为参考图。"));
                  }}
                />

                {selectedId &&
                  (() => {
                    const selectedVariant = variants.find((v) => v.id === selectedId);
                    if (!selectedVariant || selectedVariant.status !== "completed") return null;
                    return (
                      <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
                        <span className="text-xs font-semibold text-slate-300 block mb-3">
                          编辑提示词并重新生成
                        </span>
                        <textarea
                          value={editedPrompts[selectedVariant.id] ?? selectedVariant.prompt}
                          onChange={(e) =>
                            setEditedPrompts((prev) => ({
                              ...prev,
                              [selectedVariant.id]: e.target.value,
                            }))
                          }
                          rows={4}
                          className="w-full px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-lg text-xs text-slate-300 resize-none focus:outline-none focus:border-orange-500/30"
                        />
                        <button
                          onClick={() => handleRegenerate(selectedVariant.id)}
                          className="mt-2 px-4 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 rounded-lg text-xs font-semibold transition-colors"
                        >
                          重新生成
                        </button>
                      </div>
                    );
                  })()}
              </>
            ) : (
              <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-12 text-center">
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-spin" />
                    <p className="text-sm text-slate-300">正在处理 Logo 提示词和图片...</p>
                    <p className="text-xs text-slate-500 mt-1">查看日志面板了解详情</p>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-sm text-slate-400">点击「生成 Logo」开始</p>
                    <p className="text-xs text-slate-500 mt-1">
                      将创建 {variantCount} 个风格变体。日志会在失败时保留。
                    </p>
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
