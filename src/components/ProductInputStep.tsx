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
  { value: "digital", label: "数码与电子" },
  { value: "fashion", label: "时尚与配饰" },
  { value: "food", label: "食品与饮料" },
  { value: "home", label: "家居与生活" },
  { value: "beauty", label: "美妆与护肤" },
  { value: "sports", label: "运动与户外" },
];

const STYLES: { value: BrandStyle; label: string }[] = [
  { value: "minimalist", label: "简约" },
  { value: "luxury", label: "奢华" },
  { value: "trendy", label: "时尚" },
  { value: "warm", label: "温馨" },
  { value: "tech", label: "科技与未来" },
];

const PLATFORMS: { value: TargetPlatform; label: string }[] = [
  { value: "taobao", label: "淘宝 / 天猫" },
  { value: "douyin", label: "抖音" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "instagram", label: "Instagram" },
  { value: "general", label: "通用" },
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
          <h2 className="text-lg font-bold text-slate-100">产品信息</h2>
          <p className="text-xs text-slate-400">输入产品详情，AI 将优化后续所有提示词</p>
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
            placeholder="例如：AirPods Pro 2"
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
            placeholder="例如：主动降噪蓝牙耳机，H2芯片，空间音频，触控操作，MagSafe充电盒"
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
              品牌风格
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
          下一步：生成 Logo
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
