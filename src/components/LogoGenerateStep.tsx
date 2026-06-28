/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sparkles, ArrowLeft, ArrowRight, RefreshCw, Package } from "lucide-react";
import { Product, LogoResult, LogoVariant, TaskStatus } from "../types";
import { generateLogoApi } from "../utils/api";
import { createToast } from "./Toast";
import DragDropZone from "./DragDropZone";
import ImageVariantGrid from "./ImageVariantGrid";

interface LogoGenerateStepProps {
  apiKey: string;
  product: Product;
  onBack: () => void;
  onNext: (logoResult: LogoResult) => void;
  addToast?: (toast: any) => void;
}

export default function LogoGenerateStep({ apiKey, product, onBack, onNext, addToast }: LogoGenerateStepProps) {
  const [variants, setVariants] = useState<LogoVariant[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const [variantCount, setVariantCount] = useState(3);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await generateLogoApi(apiKey, product, variantCount);

      // Create variants from the prompts
      const newVariants: LogoVariant[] = result.variants.map((prompt, i) => ({
        id: `logo_${Date.now()}_${i}`,
        prompt,
        status: "idle" as TaskStatus,
      }));

      setVariants(newVariants);

      // Generate images for each variant in parallel
      for (let i = 0; i < newVariants.length; i++) {
        const variant = newVariants[i];
        setVariants((prev) =>
          prev.map((v) => (v.id === variant.id ? { ...v, status: "generating" } : v))
        );

        try {
          const response = await fetch("/api/proxy/images", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "agnes-image-2.1-flash",
              prompt: variant.prompt,
              n: 1,
              size: "1024x1024",
            }),
          });

          if (!response.ok) throw new Error(`Image generation failed: ${response.status}`);

          const data = await response.json();
          const imageUrl = data.data?.[0]?.url;

          if (imageUrl) {
            setVariants((prev) =>
              prev.map((v) =>
                v.id === variant.id ? { ...v, imageUrl, status: "completed" } : v
              )
            );
          } else {
            throw new Error("No image URL in response");
          }
        } catch (err) {
          console.error(`Failed to generate logo variant ${i + 1}:`, err);
          setVariants((prev) =>
            prev.map((v) => (v.id === variant.id ? { ...v, status: "failed" } : v))
          );
        }
      }
    } catch (err: any) {
      console.error("Failed to generate logo prompts:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async (variantId: string) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;

    const prompt = editedPrompts[variantId] || variant.prompt;

    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, status: "generating" } : v))
    );

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
        setVariants((prev) =>
          prev.map((v) =>
            v.id === variantId ? { ...v, prompt, imageUrl, status: "completed" } : v
          )
        );
      }
    } catch (err) {
      setVariants((prev) =>
        prev.map((v) => (v.id === variantId ? { ...v, status: "failed" } : v))
      );
    }
  };

  const handleUseSelected = () => {
    if (!selectedId) return;
    const variant = variants.find((v) => v.id === selectedId);
    if (!variant?.imageUrl) return;

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
              <span className="text-xs font-semibold text-slate-300 block mb-3">Variants</span>
              <div className="flex gap-2">
                {[3, 5, 6, 9].map((count) => (
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

                {/* Prompt Refinement Area */}
                {selectedId && (
                  <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
                    <span className="text-xs font-semibold text-slate-300 block mb-3">Prompt Refinement</span>
                    <div className="grid grid-cols-3 gap-3">
                      {variants.filter(v => v.status === "completed").map((variant) => (
                        <div
                          key={variant.id}
                          className={`p-2 rounded-lg border cursor-pointer transition-all ${
                            editedPrompts[variant.id] !== undefined
                              ? "border-orange-500/50 bg-orange-500/5"
                              : "border-white/5 hover:border-white/10"
                          }`}
                          onClick={() => setSelectedId(variant.id)}
                        >
                          <textarea
                            value={editedPrompts[variant.id] ?? variant.prompt}
                            onChange={(e) => setEditedPrompts(prev => ({ ...prev, [variant.id]: e.target.value }))}
                            rows={3}
                            className="w-full px-2 py-1.5 bg-[#1f1f22] border border-white/10 rounded-lg text-[10px] text-slate-300 resize-none focus:outline-none focus:border-orange-500/30"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRegenerate(variant.id);
                            }}
                            className="mt-2 w-full py-1 bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 rounded text-[10px] font-semibold transition-colors"
                          >
                            Regenerate
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-12 text-center">
                <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-sm text-slate-400">Click "Generate Logo" to start designing</p>
                <p className="text-xs text-slate-500 mt-1">AI will create {variantCount} different style variants for your product</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
