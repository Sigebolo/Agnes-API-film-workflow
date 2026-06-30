/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Image as ImageIcon, ArrowLeft, ArrowRight, RefreshCw, Upload, Type } from "lucide-react";
import { Product, ProductImageResult, MarketingVariant, MarketingScene, TaskStatus } from "../types";
import { generateProductImageApi, autoSaveImage } from "../utils/api";
import DragDropZone from "./DragDropZone";
import ImageVariantGrid from "./ImageVariantGrid";

interface ProductImageStepProps {
  apiKey: string;
  product: Product;
  logoImageUrl?: string;
  onBack: () => void;
  onNext: (imageResult: ProductImageResult) => void;
}

const SCENE_LABELS: Record<MarketingScene, string> = {
  ecommerce: "E-commerce",
  social: "Social Media",
  poster: "Brand Poster",
  lifestyle: "Lifestyle",
};

export default function ProductImageStep({ apiKey, product, logoImageUrl, onBack, onNext }: ProductImageStepProps) {
  const [inputMode, setInputMode] = useState<"upload" | "text">("upload");
  const [sourceImage, setSourceImage] = useState<string | undefined>(logoImageUrl);
  const [textDesc, setTextDesc] = useState(product.description || "");
  const [variants, setVariants] = useState<MarketingVariant[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const canGenerate = inputMode === "upload" ? !!sourceImage : textDesc.trim().length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    console.log("[ProductImageStep] Starting generation...", { inputMode, textDesc, sourceImage });
    setIsGenerating(true);
    try {
      const result = await generateProductImageApi(
        apiKey,
        product,
        inputMode === "upload" ? sourceImage : undefined,
        inputMode === "text" ? textDesc : undefined
      );

      console.log("[ProductImageStep] Got prompts:", result);
      const scenes: MarketingScene[] = ["ecommerce", "social", "poster"];
      const newVariants: MarketingVariant[] = result.variants.map((prompt, i) => ({
        id: `img_${Date.now()}_${i}`,
        prompt,
        status: "idle" as TaskStatus,
        scene: scenes[i] || "ecommerce",
      }));

      setVariants(newVariants);

      // Generate images for each variant
      for (let i = 0; i < newVariants.length; i++) {
        const variant = newVariants[i];
        setVariants((prev) =>
          prev.map((v) => (v.id === variant.id ? { ...v, status: "generating" } : v))
        );

        try {
          const body: Record<string, any> = {
            model: "agnes-image-2.1-flash",
            prompt: variant.prompt,
            n: 1,
            size: "1024x1024",
          };

          // If we have a source image, include it for image-to-image
          if (sourceImage) {
            body.image = sourceImage;
          }

          const response = await fetch("/api/proxy/images", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
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
            // Auto-save to output folder
            const sceneLabel = variant.scene || "marketing";
            autoSaveImage(imageUrl, `${sceneLabel}_${i + 1}`);
          }
        } catch (err) {
          setVariants((prev) =>
            prev.map((v) => (v.id === variant.id ? { ...v, status: "failed" } : v))
          );
        }
      }
    } catch (err: any) {
      console.error("Failed to generate product images:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async (variantId: string) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;

    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, status: "generating" } : v))
    );

    try {
      const body: Record<string, any> = {
        model: "agnes-image-2.1-flash",
        prompt: variant.prompt,
        n: 1,
        size: "1024x1024",
      };

      if (sourceImage) {
        body.image = sourceImage;
      }

      const response = await fetch("/api/proxy/images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed");

      const data = await response.json();
      const imageUrl = data.data?.[0]?.url;

      if (imageUrl) {
        setVariants((prev) =>
          prev.map((v) =>
            v.id === variantId ? { ...v, imageUrl, status: "completed" } : v
          )
        );
      }
    } catch (err) {
      setVariants((prev) =>
        prev.map((v) => (v.id === variantId ? { ...v, status: "failed" } : v))
      );
    }
  };

  const handleNext = () => {
    // Use first completed variant or source image
    const completedVariant = variants.find(v => v.status === "completed" && v.imageUrl);
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
                <ImageIcon className="w-5 h-5 text-purple-400" />
                Product Image Generator
              </h1>
              <p className="text-xs text-slate-400 mt-1">Upload product image or describe it, AI generates marketing variants</p>
            </div>
          </div>
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:brightness-110 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            Next: Generate Video
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Input */}
          <div className="space-y-4">
            {/* Input Mode Toggle */}
            <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-300 block mb-3">Input Method</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setInputMode("upload")}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    inputMode === "upload"
                      ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                      : "bg-[#1f1f22] text-slate-400 border border-white/5 hover:bg-white/5"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Image
                </button>
                <button
                  onClick={() => setInputMode("text")}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    inputMode === "text"
                      ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                      : "bg-[#1f1f22] text-slate-400 border border-white/5 hover:bg-white/5"
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  Text Description
                </button>
              </div>
            </div>

            {/* Upload Mode */}
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

            {/* Text Mode */}
            {inputMode === "text" && (
              <div className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4">
                <span className="text-xs font-semibold text-slate-300 block mb-3">Product / Service Description</span>
                <textarea
                  value={textDesc}
                  onChange={(e) => setTextDesc(e.target.value)}
                  rows={4}
                  placeholder="Describe your product or service, AI will generate marketing images..."
                  className="w-full px-3 py-2 bg-[#1f1f22] border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 resize-none"
                />
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:brightness-110 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  Generate Marketing Images
                </>
              )}
            </button>
          </div>

          {/* Right: Variants */}
          <div className="lg:col-span-2 space-y-4">
            {variants.length > 0 ? (
              <>
                <ImageVariantGrid
                  variants={variants.map((v) => ({
                    ...v,
                    label: SCENE_LABELS[v.scene],
                  }))}
                  onSelect={setSelectedId}
                  selectedId={selectedId}
                  onRegenerate={handleRegenerate}
                  onDragImage={(url) => {
                    setSourceImage(url);
                    setInputMode("upload");
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
                            selectedId === variant.id
                              ? "border-purple-500/50 bg-purple-500/5"
                              : "border-white/5 hover:border-white/10"
                          }`}
                          onClick={() => setSelectedId(variant.id)}
                        >
                          <textarea
                            value={variant.prompt}
                            readOnly
                            rows={3}
                            className="w-full px-2 py-1.5 bg-[#1f1f22] border border-white/10 rounded-lg text-[10px] text-slate-300 resize-none focus:outline-none"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRegenerate(variant.id);
                            }}
                            className="mt-2 w-full py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded text-[10px] font-semibold transition-colors"
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
                <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-sm text-slate-400">Upload product image or enter description, click "Generate Marketing Images"</p>
                <p className="text-xs text-slate-500 mt-1">AI will generate E-commerce, Social Media, and Brand Poster variants</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
