/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Key, Video, HelpCircle, AlertCircle, Sparkles, Folder, ChevronRight, Settings } from "lucide-react";
import { VideoClip, WorkflowState } from "../types";

interface SidebarProps {
  apiKey: string;
  onChangeApiKey: (key: string) => void;
  clips: VideoClip[];
  activeClipId: string | null;
  onSelectClip: (clipId: string) => void;
  onAddBlankClip: () => void;
  state: WorkflowState;
}

export default function Sidebar({
  apiKey,
  onChangeApiKey,
  clips,
  activeClipId,
  onSelectClip,
  onAddBlankClip,
  state,
}: SidebarProps) {
  return (
    <aside className="w-full lg:w-80 bg-[#161618] text-slate-300 rounded-2xl flex flex-col justify-between border border-white/5 p-5 space-y-6" id="app-sidebar">
      <div className="space-y-6">
        {/* App Title Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">Agnes Canvas</h1>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider font-semibold uppercase">AI Cinematic Studio</span>
          </div>
        </div>

        {/* API Key Credentials input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-orange-500" />
              Agnes API Credentials
            </label>
            <a
              href="https://platform.agnes-ai.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-orange-400 hover:underline font-bold"
            >
              Get Key
            </a>
          </div>
          <input
            type="password"
            className="w-full px-3 py-2 bg-[#1f1f22] border border-white/10 focus:border-orange-500/50 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors"
            placeholder="Enter Agnes API Key..."
            value={apiKey}
            onChange={(e) => onChangeApiKey(e.target.value)}
          />
          {!apiKey && (
            <p className="text-[10px] text-orange-400/80 flex items-center gap-1 leading-relaxed">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              API Key is required to call models. Your key remains safe in local storage.
            </p>
          )}
        </div>

        {/* Project Clips Panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-orange-500" />
              Scene Manager
            </h3>
            <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
              {clips.length} Scenes
            </span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {clips.map((clip, index) => {
              const isActive = activeClipId === clip.id;
              return (
                <button
                  key={clip.id}
                  onClick={() => onSelectClip(clip.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-all text-xs flex items-center justify-between cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold shadow-md shadow-orange-950/40"
                      : "bg-[#1f1f22] border border-white/5 hover:bg-[#2a2a2d] text-slate-400"
                  }`}
                >
                  <span className="truncate pr-2">
                    Scene #{index + 1}: {clip.subtitle || clip.imagePrompt ? (clip.subtitle || clip.imagePrompt).slice(0, 20) + "..." : "Empty Scene"}
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-white" : "text-slate-600"}`} />
                </button>
              );
            })}
          </div>

          <button
            onClick={onAddBlankClip}
            className="w-full py-2 bg-slate-800/60 hover:bg-[#2a2a2d] border border-white/5 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
          >
            + Create New Scene
          </button>
        </div>

        {/* Character Consistency Guidelines Card */}
        <div className="bg-[#1f1f22]/50 rounded-xl border border-white/5 p-3.5 space-y-2.5">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
            Face & Style Consistency
          </h4>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            In AI cinematic editing, maintaining continuous character representation across scenes is vital:
          </p>
          <ul className="text-[10px] text-slate-500 list-disc pl-4 space-y-1">
            <li>Keep a uniform detailed character description (age, hair, clothes, glasses) across all prompts.</li>
            <li>Anchor composition elements (e.g. cinematic, 35mm lens, volumetric light).</li>
            <li>Feed the output image of the previous scene as the reference image to the next scene.</li>
          </ul>
        </div>
      </div>

      {/* Footer System Panel */}
      <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <div className="flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-orange-500/70" />
          <span>Studio Ready</span>
        </div>
        <span>Agnes SDK v2.0</span>
      </div>
    </aside>
  );
}
