/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Image as ImageIcon, ArrowLeft, ArrowRight, RefreshCw, Upload, Type, SkipForward } from "lucide-react";
import { Product, ProductImageResult, MarketingVariant, MarketingScene, TaskStatus } from "../types";
import { generateProductImageApi, autoSaveImage } from "../utils/api";
import { compressImage } from "../utils/imageCompress";
import DragDropZone from "./DragDropZone";
import ImageVariantGrid from "./ImageVariantGrid";
import { createToast } from "./Toast";

interface ProductImageStepProps {
  apiKey: string;
  product: Product;
  logoImageUrl?: string;
  onBack: () => void;
  onNext: (imageResult: ProductImageResult) => void;
  onSkip?: () => void;
  addToast?: (toast: ReturnType<typeof createToast>) => void;
}

const SCENE_LABELS: Record<MarketingScene, string> = {
  ecommerce: "E-commerce",
  social: "Social Media",
  poster: "Brand Poster",
  lifestyle: "Lifestyle",
};

function fallbackMarketingPrompts(product: Product, textDesc: string): string[] {
  const name = product.name || "Product";
  const desc = textDesc || product.description || "premium product";
  const style = product.style || "modern";
  return [
    `professional e-commerce product photo of ${name}, ${desc}, centered on clean white background, studio softbox lighting, sharp focus, catalog style, ${style}, 4k`,
    `lifestyle social media photo featuring ${name}, ${desc}, natural scene, trendy aesthetic, soft daylight, shallow DOF, Xiaohongshu style, ${style}, photorealistic, 4k`,
    `cinematic brand poster for ${name}, ${desc}, dramatic lighting, premium composition, advertising look, ${style} color grade, ultra detailed, 4k`,
  ];
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

export default function ProductImageStep({
  apiKey,
  product,
  logoImageUrl,
  onBack,
  onNext,
  onSkip,
  addToast,
}: ProductImageStepProps) {
  const [inputMode, setInputMode] = useState<"upload" | "text" | "prompt">("upload");
  const [sourceImage, setSourceImage] = useState<string | undefined>(logoImageUrl || undefined);
  const [textDesc, setTextDesc] = useState(product.description || "");
  const [manualPrompt, setManualPrompt] = useState("");
  const [variants, setVariants] = useState<MarketingVariant[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [genLogs, setGenLogs] = useState<string[]>([]);
  const cancelledRef = useRef(false);
  const runIdRef = useRef(0);

  const canGenerate =
    inputMode === "prompt"
      ? manualPrompt.trim().length > 0
      : inputMode === "upload"
        ? !!sourceImage
        : textDesc.trim().length > 0;

  const pushLog = (line: string) => {
    setGenLogs((prev) => [...prev, line]);
    console.log("[ProductImage]", line);
  };

  /** Ensure reference is a public http URL (Agnes img2img rejects raw base64 / localhost). */
  const resolvePublicImageUrl = async (img?: string): Promise<string | undefined> => {
    if (!img) return undefined;
    if (img.startsWith("http://") || img.startsWith("https://")) return img;

    // base64 or data URL — compress + upload
    pushLog("🌐 Uploading reference image to get public URL...");
    try {
      const dataUrl = img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`;
      const compressed = await compressImage(dataUrl, 1024, 0.85);
      const uploadResp = await fetch("/api/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64: compressed, name: "product_ref" }),
      });
      if (!uploadResp.ok) {
        const err = await uploadResp.json().catch(() => ({}));
        throw new Error(err.error || `Upload HTTP ${uploadResp.status}`);
      }
      const uploadData = await uploadResp.json();
      if (!uploadData.url) throw new Error("Upload returned no URL");
      pushLog("✅ Reference image public URL ready");
      return uploadData.url as string;
    } catch (e: any) {
      pushLog(`⚠️ Reference upload failed: ${e.message}. Will try text-only generation.`);
      return undefined;
    }
  };

  const generateOneImage = async (
    prompt: string,
    publicRefUrl?: string
  ): Promise<string> => {
    // img2img uses 2.0-flash; t2i uses 2.1-flash
    const model = publicRefUrl ? "agnes-image-2.0-flash" : "agnes-image-2.1-flash";
    const body: Record<string, any> = {
      model,
      prompt,
      n: 1,
      size: "1024x1024",
    };
    if (publicRefUrl) {
      body.image = publicRefUrl;
      body.strength = 0.55;
    }

    let delay = 2500;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (cancelledRef.current) throw new Error("Cancelled");
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);
        let response: Response;
        try {
          response = await fetch("/api/proxy/images", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const msg = errData.error || `HTTP ${response.status}`;
          const retryable =
            response.status === 503 ||
            response.status === 429 ||
            response.status === 502 ||
            response.status === 504 ||
            /busy|rate|limit|timeout/i.test(String(msg));
          if (retryable && attempt < maxRetries) {
            pushLog(`⏳ API busy (${response.status}), retry in ${delay / 1000}s…`);
            await new Promise((r) => setTimeout(r, delay));
            delay *= 1.5;
            continue;
          }
          throw new Error(msg);
        }

        const data = await response.json();
        const imageUrl =
          data.data?.[0]?.url || data.url || data.image_url || data.images?.[0]?.url;
        if (!imageUrl) throw new Error("No image URL in response");
        return imageUrl as string;
      } catch (err: any) {
        if (cancelledRef.current) throw new Error("Cancelled");
        if (err?.name === "AbortError") {
          if (attempt < maxRetries) {
            pushLog(`⚠️ Timeout, retry ${attempt}/${maxRetries}`);
            await new Promise((r) => setTimeout(r, delay));
            delay *= 1.5;
            continue;
          }
          throw new Error("Image request timed out");
        }
        if (attempt === maxRetries) throw err;
        pushLog(`⚠️ Attempt ${attempt} failed: ${err?.message || err}`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 1.5;
      }
    }
    throw new Error("Max retries exceeded");
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    if (!apiKey?.trim()) {
      addToast?.(createToast("error", "Enter Agnes API key in the sidebar first"));
      return;
    }

    cancelledRef.current = false;
    const runId = ++runIdRef.current;
    setIsGenerating(true);
    setGenLogs(["🕐 Starting product image generation..."]);
    let localFailedCount = 0;

    // ---- Manual prompt mode ----
    if (inputMode === "prompt") {
      pushLog("📡 Generating image from manual prompt...");
      try {
        const publicRef = await resolvePublicImageUrl(sourceImage);
        if (runId !== runIdRef.current) return;
        const imageUrl = await generateOneImage(manualPrompt, publicRef);
        if (runId !== runIdRef.current) return;
        const newVariant: MarketingVariant = {
          id: `img_${Date.now()}_0`,
          prompt: manualPrompt,
          imageUrl,
          status: "completed",
          scene: "ecommerce",
        };
        setVariants([newVariant]);
        pushLog("✅ Image generated successfully");
        autoSaveImage(imageUrl, "manual_prompt");
        addToast?.(createToast("success", "Image generated successfully"));
      } catch (err: any) {
        if (err?.message !== "Cancelled") {
          const msg = /failed to fetch/i.test(err?.message || "")
            ? "Cannot reach local server. Restart Agnes (启动Agnes.bat)."
            : err?.message || String(err);
          pushLog(`❌ Failed: ${msg}`);
          addToast?.(createToast("error", `Image failed: ${msg}`));
        }
      } finally {
        if (runId === runIdRef.current) setIsGenerating(false);
      }
      return;
    }

    // ---- AI auto mode: prompts → 3 images ----
    try {
      pushLog("📡 Requesting marketing image prompts from Agnes AI...");
      let prompts: string[] = [];

      try {
        const result = await generateProductImageApi(
          apiKey,
          product,
          // Do NOT send base64 to chat API — only hint via text path
          inputMode === "upload" && sourceImage?.startsWith("http") ? sourceImage : undefined,
          inputMode === "text" ? textDesc : product.description
        );
        if (runId !== runIdRef.current) return;

        prompts = (result.variants || []).map(asPromptString).filter((s) => s.length > 8);
        if ((result as any).fallback || (result as any).warning) {
          pushLog(`⚠️ Prompt API fallback: ${(result as any).warning || "templates"}`);
        }
        if (prompts.length === 0) {
          pushLog("⚠️ Empty prompts, using local templates");
          prompts = fallbackMarketingPrompts(product, textDesc);
        } else {
          pushLog(`✅ Got ${prompts.length} prompts`);
        }
      } catch (promptErr: any) {
        const msg = promptErr?.message || String(promptErr);
        pushLog(`⚠️ Prompt API failed: ${msg}`);
        pushLog("➡️ Continuing with template prompts so images can still generate");
        prompts = fallbackMarketingPrompts(product, textDesc);
        addToast?.(createToast("warning", `Prompt API failed, using templates: ${msg}`));
      }

      if (runId !== runIdRef.current || cancelledRef.current) return;

      while (prompts.length < 3) {
        prompts.push(...fallbackMarketingPrompts(product, textDesc));
      }
      prompts = prompts.slice(0, 3);

      const scenes: MarketingScene[] = ["ecommerce", "social", "poster"];
      const baseId = Date.now();
      const newVariants: MarketingVariant[] = prompts.map((prompt, i) => ({
        id: `img_${baseId}_${i}`,
        prompt,
        status: "idle" as TaskStatus,
        scene: scenes[i] || "ecommerce",
      }));
      setVariants(newVariants);

      // Resolve public ref once for img2img
      let publicRef: string | undefined;
      if (sourceImage) {
        publicRef = await resolvePublicImageUrl(sourceImage);
      }

      pushLog(`🎨 Generating ${newVariants.length} images (sequential)...`);

      for (let i = 0; i < newVariants.length; i++) {
        if (runId !== runIdRef.current || cancelledRef.current) {
          pushLog("⏹ Cancelled");
          break;
        }
        const variant = newVariants[i];
        setVariants((prev) =>
          prev.map((v) => (v.id === variant.id ? { ...v, status: "generating" } : v))
        );
        pushLog(`🎨 Image ${i + 1}/${newVariants.length} (${variant.scene})...`);
        pushLog(`   ${variant.prompt.slice(0, 100)}${variant.prompt.length > 100 ? "…" : ""}`);

        try {
          const imageUrl = await generateOneImage(variant.prompt, publicRef);
          if (runId !== runIdRef.current) break;
          setVariants((prev) =>
            prev.map((v) =>
              v.id === variant.id ? { ...v, imageUrl, status: "completed" } : v
            )
          );
          pushLog(`✅ Image ${i + 1} done`);
          autoSaveImage(imageUrl, `${variant.scene}_${i + 1}`);
        } catch (err: any) {
          if (err?.message === "Cancelled") break;
          localFailedCount++;
          pushLog(`❌ Image ${i + 1} failed: ${err?.message || err}`);
          addToast?.(createToast("error", `Image ${i + 1}: ${err?.message || err}`));
          setVariants((prev) =>
            prev.map((v) => (v.id === variant.id ? { ...v, status: "failed" } : v))
          );
        }

        if (i < newVariants.length - 1 && !cancelledRef.current) {
          pushLog("⏳ 2s before next…");
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      if (runId !== runIdRef.current) return;

      const total = newVariants.length;
      if (localFailedCount === 0) {
        pushLog(`🎉 All ${total} images generated!`);
        addToast?.(createToast("success", `Generated ${total} marketing images!`));
      } else if (localFailedCount === total) {
        pushLog(`⚠️ All ${total} images failed — check API key / image errors above`);
        addToast?.(createToast("error", "All images failed. Check API key and try again."));
      } else {
        pushLog(`⚠️ ${localFailedCount}/${total} failed`);
        addToast?.(createToast("warning", `${localFailedCount}/${total} images failed`));
      }
    } catch (err: any) {
      if (err?.message === "Cancelled") return;
      let msg = err?.message || String(err);
      if (/failed to fetch/i.test(msg)) {
        msg =
          "Cannot reach local server. Restart Agnes: 启动Agnes.bat or node dist/server.cjs";
      }
      pushLog(`❌ Failed: ${msg}`);
      addToast?.(createToast("error", `Generation failed: ${msg}`));
    } finally {
      if (runId === runIdRef.current) setIsGenerating(false);
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    runIdRef.current += 1;
    setIsGenerating(false);
    pushLog("⏹ Cancelled by user");
  };

  const handleRegenerate = async (variantId: string) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;
    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, status: "generating" } : v))
    );
    pushLog(`🔄 Regenerating ${variant.scene}...`);
    try {
      const publicRef = sourceImage ? await resolvePublicImageUrl(sourceImage) : undefined;
      const imageUrl = await generateOneImage(variant.prompt, publicRef);
      setVariants((prev) =>
        prev.map((v) =>
          v.id === variantId ? { ...v, imageUrl, status: "completed" } : v
        )
      );
      autoSaveImage(imageUrl, `${variant.scene}_regen`);
      pushLog("✅ Regenerated");
    } catch (err: any) {
      setVariants((prev) =>
        prev.map((v) => (v.id === variantId ? { ...v, status: "failed" } : v))
      );
      pushLog(`❌ Regen failed: ${err?.message || err}`);
    }
  };

  const handleNext = () => {
    const completedVariant = variants.find((v) => v.status === "completed" && v.imageUrl);
    onNext({
      id: `product_img_${Date.now()}`,
      product,
      sourceImageUrl: completedVariant?.imageUrl || sourceImage,
      sourceTextDesc: inputMode === "text" ? textDesc : undefined,
      variants,
      createdAt: Date.now(),
    });
  };

  const completedCount = variants.filter((v) => v.status === "completed").length;
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
                <ImageIcon className="w-5 h-5 text-purple-400" />
                Product Image Generator
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Upload product image or describe it, AI generates marketing variants
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:brightness-110 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              Next: Generate Video
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-white/10 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Skip Images
              </button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-300 block mb-3">输入方式</span>
              <div className="flex gap-2">
                {(
                  [
                    ["upload", "上传", Upload],
                    ["text", "AI 生成", Type],
                    ["prompt", "手动提示词", ImageIcon],
                  ] as const
                ).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    onClick={() => setInputMode(mode)}
                    disabled={isGenerating}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      inputMode === mode
                        ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                        : "bg-[#1f1f22] text-slate-400 border border-white/5 hover:bg-white/5"
                    } disabled:opacity-50`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {inputMode === "upload" && (
              <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
                <span className="text-xs font-semibold text-slate-300 block mb-3">Product Image</span>
                <DragDropZone
                  onImageDrop={setSourceImage}
                  currentImage={sourceImage}
                  onClear={() => setSourceImage(undefined)}
                />
              </div>
            )}

            {inputMode === "text" && (
              <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
                <span className="text-xs font-semibold text-slate-300 block mb-3">
                  产品/服务描述
                </span>
                <textarea
                  value={textDesc}
                  onChange={(e) => setTextDesc(e.target.value)}
                  rows={4}
                  placeholder="描述您的产品..."
                  className="w-full px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 resize-none"
                />
              </div>
            )}

            {inputMode === "prompt" && (
              <>
                <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
                  <span className="text-xs font-semibold text-slate-300 block mb-3">
                    参考图片（可选）
                  </span>
                  <DragDropZone
                    onImageDrop={setSourceImage}
                    currentImage={sourceImage}
                    onClear={() => setSourceImage(undefined)}
                  />
                </div>
                <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
                  <span className="text-xs font-semibold text-slate-300 block mb-3">您的提示词</span>
                  <textarea
                    value={manualPrompt}
                    onChange={(e) => setManualPrompt(e.target.value)}
                    rows={4}
                    placeholder="e.g. Product on marble table, soft light..."
                    className="w-full px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 resize-none"
                  />
                </div>
              </>
            )}

            <button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:brightness-110 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  {inputMode === "prompt" ? "生成图片" : "生成营销图片"}
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

            {completedCount > 0 && (
              <p className="text-[10px] text-green-400 text-center">
                {completedCount} image(s) ready — click Next when done
              </p>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {showProgress && (
              <div
                className={`bg-[#1a1a1c] border rounded-xl p-4 space-y-3 ${
                  isGenerating ? "border-purple-500/30" : "border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold flex items-center gap-1.5 ${
                      isGenerating ? "text-purple-400" : "text-slate-300"
                    }`}
                  >
                    {isGenerating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5" />
                    )}
                    {isGenerating ? "Generating images..." : "Generation log (kept after finish)"}
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
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
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
                                ? "text-purple-400 animate-pulse"
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
              <ImageVariantGrid
                variants={variants.map((v) => ({
                  ...v,
                  label: SCENE_LABELS[v.scene] || v.scene,
                }))}
                onSelect={setSelectedId}
                selectedId={selectedId}
                onRegenerate={handleRegenerate}
              />
            ) : (
              <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-12 text-center">
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-12 h-12 text-purple-500 mx-auto mb-4 animate-spin" />
                    <p className="text-sm text-slate-300">正在处理提示词和图片...</p>
                    <p className="text-xs text-slate-500 mt-1">Watch the log panel for details</p>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-sm text-slate-400">
                      Upload image, describe product, or enter manual prompt
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      AI generates E-commerce, Social Media, and Brand Poster variants
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
