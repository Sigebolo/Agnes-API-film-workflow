/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { RefreshCw, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";
import { TaskStatus } from "../types";

interface Variant {
  id: string;
  imageUrl?: string;
  prompt: string;
  status: TaskStatus;
  label?: string;
}

interface ImageVariantGridProps {
  variants: Variant[];
  onSelect?: (id: string) => void;
  selectedId?: string;
  onRegenerate?: (id: string) => void;
  onDragImage?: (imageUrl: string) => void;
}

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "generating":
    case "polling":
      return <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" />;
    case "failed":
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-slate-500" />;
  }
}

function VariantCard({
  variant,
  isSelected,
  onSelect,
  onRegenerate,
  onDragImage,
}: {
  variant: Variant;
  isSelected: boolean;
  onSelect?: () => void;
  onRegenerate?: () => void;
  onDragImage?: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`
        bg-[#1a1a1c] border rounded-xl overflow-hidden transition-all cursor-pointer
        ${isSelected ? "border-orange-500 ring-2 ring-orange-500/30" : "border-white/10 hover:border-white/20"}
      `}
      onClick={onSelect}
    >
      {/* Image Preview */}
      <div className="aspect-square bg-[#1f1f22] relative">
        {variant.imageUrl ? (
          <img
            src={variant.imageUrl}
            alt={variant.label || "Variant"}
            className="w-full h-full object-contain"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", variant.imageUrl!);
              e.dataTransfer.effectAllowed = "copy";
              onDragImage?.(variant.imageUrl!);
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {variant.status === "generating" ? (
              <RefreshCw className="w-8 h-8 text-orange-400 animate-spin" />
            ) : (
              <ImageIcon className="w-8 h-8 text-slate-600" />
            )}
          </div>
        )}

        {/* Label badge */}
        {variant.label && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[10px] text-white font-medium">
            {variant.label}
          </div>
        )}

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2">
            <CheckCircle className="w-5 h-5 text-orange-400" />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <StatusIcon status={variant.status} />
          <div className="flex items-center gap-1">
            {onRegenerate && variant.status !== "generating" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate();
                }}
                className="p-1 hover:bg-white/5 rounded transition-colors"
                title="重新生成"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400 hover:text-orange-400" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="p-1 hover:bg-white/5 rounded transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Prompt (expandable) */}
        {expanded && variant.prompt && (
          <p className="text-[10px] text-slate-500 leading-relaxed mt-1 line-clamp-4">
            {variant.prompt}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ImageVariantGrid({
  variants,
  onSelect,
  selectedId,
  onRegenerate,
  onDragImage,
}: ImageVariantGridProps) {
  const cols = variants.length <= 3 ? "grid-cols-3" : variants.length <= 6 ? "grid-cols-3" : "grid-cols-3";
  return (
    <div className={`grid ${cols} gap-3`}>
      {variants.map((variant) => (
        <VariantCard
          key={variant.id}
          variant={variant}
          isSelected={selectedId === variant.id}
          onSelect={() => onSelect?.(variant.id)}
          onRegenerate={() => onRegenerate?.(variant.id)}
          onDragImage={onDragImage}
        />
      ))}
    </div>
  );
}
