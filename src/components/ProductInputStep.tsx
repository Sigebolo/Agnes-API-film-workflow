/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Package, ArrowRight } from "lucide-react";
import { Product, ProductCategory, BrandStyle, TargetPlatform } from "../types";

interface ProductInputStepProps {
  product: Product;
  onUpdate: (p: Product) => void;
  onNext: () => void;
}

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "digital", label: "Digital & Electronics" },
  { value: "fashion", label: "Fashion & Accessories" },
  { value: "food", label: "Food & Beverage" },
  { value: "home", label: "Home & Living" },
  { value: "beauty", label: "Beauty & Skincare" },
  { value: "sports", label: "Sports & Outdoor" },
];

const STYLES: { value: BrandStyle; label: string }[] = [
  { value: "minimalist", label: "Minimalist" },
  { value: "luxury", label: "Luxury" },
  { value: "trendy", label: "Trendy" },
  { value: "warm", label: "Warm & Cozy" },
  { value: "tech", label: "Tech & Futuristic" },
];

const PLATFORMS: { value: TargetPlatform; label: string }[] = [
  { value: "taobao", label: "Taobao / Tmall" },
  { value: "douyin", label: "Douyin (TikTok)" },
  { value: "xiaohongshu", label: "Xiaohongshu (RED)" },
  { value: "instagram", label: "Instagram" },
  { value: "general", label: "General" },
];

export default function ProductInputStep({ product, onUpdate, onNext }: ProductInputStepProps) {
  const canProceed = product.name.trim().length > 0 && product.description.trim().length > 0;

  return (
    <div className="bg-[#161618] border border-white/5 rounded-2xl p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
          <Package className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Product Info</h2>
          <p className="text-xs text-slate-400">Enter product details, AI will optimize all subsequent prompts</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Product Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Product Name *
          </label>
          <input
            type="text"
            value={product.name}
            onChange={(e) => onUpdate({ ...product, name: e.target.value })}
            placeholder="e.g. AirPods Pro 2"
            className="w-full px-3 py-2.5 bg-[#1f1f22] border border-white/10 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50 transition-colors"
          />
        </div>

        {/* Product Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Product Description *
          </label>
          <textarea
            value={product.description}
            onChange={(e) => onUpdate({ ...product, description: e.target.value })}
            rows={3}
            placeholder="e.g. Active noise cancelling bluetooth earbuds, H2 chip, spatial audio, touch control, MagSafe charging case"
            className="w-full px-3 py-2.5 bg-[#1f1f22] border border-white/10 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50 resize-none transition-colors"
          />
        </div>

        {/* Category & Style */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Category
            </label>
            <select
              value={product.category}
              onChange={(e) => onUpdate({ ...product, category: e.target.value as ProductCategory })}
              className="w-full px-3 py-2.5 bg-[#1f1f22] border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-orange-500/50 transition-colors"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Brand Style
            </label>
            <select
              value={product.style}
              onChange={(e) => onUpdate({ ...product, style: e.target.value as BrandStyle })}
              className="w-full px-3 py-2.5 bg-[#1f1f22] border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-orange-500/50 transition-colors"
            >
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Target Platform */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Target Platform
          </label>
          <select
            value={product.targetPlatform}
            onChange={(e) => onUpdate({ ...product, targetPlatform: e.target.value as TargetPlatform })}
            className="w-full px-3 py-2.5 bg-[#1f1f22] border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-orange-500/50 transition-colors"
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Next Button */}
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all mt-2"
        >
          Next: Generate Logo
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
