/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";

interface DragDropZoneProps {
  onImageDrop: (imageUrl: string) => void;
  className?: string;
  children?: React.ReactNode;
  currentImage?: string;
  onClear?: () => void;
}

export default function DragDropZone({
  onImageDrop,
  className = "",
  children,
  currentImage,
  onClear,
}: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // Check for files
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          onImageDrop(dataUrl);
        };
        reader.readAsDataURL(file);
        return;
      }
    }

    // Check for dragged image URL (from other components)
    const url = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text/uri-list");
    if (url && (url.startsWith("http") || url.startsWith("data:image"))) {
      onImageDrop(url);
    }
  }, [onImageDrop]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        onImageDrop(dataUrl);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (currentImage) {
    return (
      <div className={`relative group ${className}`}>
        <img
          src={currentImage}
          alt="Dropped"
          className="w-full h-32 object-contain rounded-lg bg-[#1f1f22] border border-white/10"
        />
        {onClear && (
          <button
            onClick={onClear}
            className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        )}
        <div
          className="absolute inset-0 rounded-lg cursor-move"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", currentImage);
            e.dataTransfer.effectAllowed = "copy";
          }}
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
        ${isDragging
          ? "border-orange-500 bg-orange-500/5"
          : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
        }
        ${className}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="flex flex-col items-center gap-2">
        {isDragging ? (
          <Upload className="w-8 h-8 text-orange-400 animate-bounce" />
        ) : (
          <ImageIcon className="w-8 h-8 text-slate-500" />
        )}
        <div className="text-xs text-slate-400">
          {isDragging ? (
            <span className="text-orange-400 font-semibold">Release to upload</span>
          ) : (
            <>
              <span className="text-slate-300">Drag & drop image here</span>
              <span className="text-slate-500"> or click to browse</span>
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
