/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { History, GitCompare, X, Clock, GripVertical } from "lucide-react";
import { HistoryImage } from "../types";

interface ImageHistoryPanelProps {
  images: HistoryImage[];
  onSelect: (image: HistoryImage) => void;
  onCompare?: (images: HistoryImage[]) => void;
  onDragStart?: (image: HistoryImage) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export default function ImageHistoryPanel({
  images,
  onSelect,
  onCompare,
  onDragStart,
  onReorder,
}: ImageHistoryPanelProps) {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const toggleCompare = () => {
    if (compareMode) {
      setCompareMode(false);
      setSelectedForCompare([]);
    } else {
      setCompareMode(true);
    }
  };

  const toggleImageSelection = (id: string) => {
    setSelectedForCompare((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleCompare = () => {
    const selected = images.filter((img) => selectedForCompare.includes(img.id));
    if (selected.length >= 2 && onCompare) {
      onCompare(selected);
    }
  };

  if (images.length === 0) {
    return (
      <div className="bg-[#161618] border border-white/5 rounded-xl p-4 text-center">
        <History className="w-6 h-6 text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-500">暂无图片</p>
      </div>
    );
  }

  return (
    <div className="bg-[#161618] border border-white/5 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-xs font-semibold text-slate-400">
            历史记录（{images.length}）
          </span>
        </div>
        {images.length >= 2 && onCompare && (
          <button
            onClick={toggleCompare}
            className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              compareMode
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
            }`}
          >
            {compareMode ? (
              <>
                <X className="w-3 h-3" /> Exit Compare
              </>
            ) : (
              <>
                <GitCompare className="w-3 h-3" /> Compare
              </>
            )}
          </button>
        )}
      </div>

      {/* Compare Actions Bar */}
      {compareMode && (
        <div className="px-3 py-2 bg-blue-500/5 border-b border-blue-500/10 flex items-center justify-between">
          <span className="text-[10px] text-blue-400">
            Select 2+ images to compare ({selectedForCompare.length} selected)
          </span>
          <button
            onClick={handleCompare}
            disabled={selectedForCompare.length < 2}
            className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-slate-700/30 disabled:text-slate-600 text-blue-400 rounded text-[10px] font-semibold transition-colors cursor-pointer"
          >
            Compare Selected
          </button>
        </div>
      )}

      {/* Image Grid */}
      <div className="p-2 grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
              compareMode
                ? selectedForCompare.includes(image.id)
                  ? "border-blue-500 ring-2 ring-blue-500/30"
                  : "border-transparent hover:border-slate-600"
                : dragOverIndex === index
                  ? "border-orange-500 bg-orange-500/10"
                  : "border-transparent hover:border-orange-500/50"
            }`}
            onClick={() =>
              compareMode
                ? toggleImageSelection(image.id)
                : onSelect(image)
            }
            draggable={!!onReorder}
            onDragStart={(e) => {
              if (onReorder) {
                e.dataTransfer.setData("text/plain", index.toString());
                e.dataTransfer.effectAllowed = "move";
                setDraggedIndex(index);
              } else if (onDragStart) {
                e.dataTransfer.setData("application/json", JSON.stringify(image));
                e.dataTransfer.effectAllowed = "copy";
                onDragStart(image);
              }
            }}
            onDragOver={(e) => {
              if (onReorder) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverIndex(index);
              }
            }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(e) => {
              if (onReorder) {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
                if (!isNaN(fromIndex) && fromIndex !== index) {
                  onReorder(fromIndex, index);
                }
                setDragOverIndex(null);
                setDraggedIndex(null);
              }
            }}
            onDragEnd={() => {
              setDragOverIndex(null);
              setDraggedIndex(null);
            }}
          >
            <img
              src={image.url}
              alt={image.prompt}
              className="w-full aspect-square object-cover"
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-1.5">
                <p className="text-[8px] text-white/80 truncate">
                  {image.prompt.slice(0, 30)}
                </p>
              </div>
              {(onDragStart || onReorder) && (
                <div className="absolute top-1 right-1">
                  <GripVertical className="w-3 h-3 text-white/60" />
                </div>
              )}
            </div>
            {/* Compare checkbox */}
            {compareMode && (
              <div className="absolute top-1 right-1">
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center text-[8px] ${
                    selectedForCompare.includes(image.id)
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "bg-black/40 border-white/30"
                  }`}
                >
                  {selectedForCompare.includes(image.id) && "✓"}
                </div>
              </div>
            )}
            {/* Timestamp */}
            <div className="absolute top-1 left-1">
              <div className="flex items-center gap-0.5 bg-black/40 rounded px-1 py-0.5">
                <Clock className="w-2.5 h-2.5 text-white/60" />
                <span className="text-[8px] text-white/60">
                  {new Date(image.timestamp).toLocaleTimeString("en-US", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Drag Hint */}
      {(onDragStart || onReorder) && images.length > 0 && (
        <div className="px-3 py-1.5 border-t border-white/5 text-center">
          <p className="text-[9px] text-slate-600 italic">
            {onReorder ? "Drag to reorder • " : ""}{onDragStart ? "Drag to use in next step" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
