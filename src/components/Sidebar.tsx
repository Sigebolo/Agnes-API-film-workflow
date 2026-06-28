/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Key, Megaphone, HelpCircle, AlertCircle, Sparkles, Folder, ChevronRight, Settings, Check, Save, Package, Image as ImageIcon, Film, Layers } from "lucide-react";
import { WorkflowState } from "../types";

interface SidebarProps {
  apiKey: string;
  onChangeApiKey: (key: string) => void;
  onSaveApiKey: (key: string) => void;
  state: WorkflowState;
  isAdMode?: boolean;
  adStep?: string;
}

export default function Sidebar({
  apiKey,
  onChangeApiKey,
  onSaveApiKey,
  state,
  isAdMode,
  adStep,
}: SidebarProps) {
  const [savedKey, setSavedKey] = useState(apiKey);
  const [showSaved, setShowSaved] = useState(false);
  const isDirty = apiKey !== savedKey;
  const isDemoKey = apiKey.toLowerCase().includes("demo") || apiKey.includes("••••");

  const handleSave = () => {
    onSaveApiKey(apiKey);
    setSavedKey(apiKey);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const adSteps = [
    { id: "product", label: "Product Info", icon: Package, desc: "Enter product details" },
    { id: "logo", label: "Logo Design", icon: Sparkles, desc: "AI generates logo variants" },
    { id: "product-image", label: "Product Images", icon: ImageIcon, desc: "Marketing image variants" },
    { id: "ad-video", label: "Ad Video", icon: Film, desc: "15s product ad video" },
  ];

  const currentStepIdx = adSteps.findIndex((s) => s.id === adStep);

  return (
    <aside className="w-full lg:w-80 bg-[#161618] text-slate-300 rounded-2xl flex flex-col justify-between border border-white/5 p-5 space-y-6" id="app-sidebar">
      <div className="space-y-6">
        {/* App Title Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">Agnes Ad Studio</h1>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider font-semibold uppercase">AI Ad Video Production</span>
          </div>
        </div>

        {/* API Key Credentials input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-orange-500" />
              Agnes API Key
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
          <div className="flex gap-1.5">
            <input
              type="password"
              className="flex-1 min-w-0 px-3 py-2 bg-[#1f1f22] border border-white/10 focus:border-orange-500/50 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors"
              placeholder="Enter Agnes API Key..."
              value={apiKey}
              onChange={(e) => onChangeApiKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
            <button
              onClick={handleSave}
              disabled={!isDirty && !showSaved}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                showSaved
                  ? "bg-green-600/20 border border-green-500/30 text-green-400"
                  : isDirty
                    ? "bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30"
                    : "bg-[#1f1f22] border border-white/5 text-slate-600"
              }`}
            >
              {showSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {showSaved ? "Saved" : "Save"}
            </button>
          </div>
          {!apiKey ? (
            <p className="text-[10px] text-orange-400/80 flex items-center gap-1 leading-relaxed">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              API Key required. Stored in local storage only.
            </p>
          ) : isDemoKey ? (
            <p className="text-[10px] text-yellow-400/80 flex items-center gap-1 leading-relaxed">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              Demo mode — simulated outputs. Enter a real key.
            </p>
          ) : (
            <p className="text-[10px] text-green-400/80 flex items-center gap-1 leading-relaxed">
              <Check className="w-3 h-3 flex-shrink-0" />
              Real API key connected.
            </p>
          )}
        </div>

        {/* Ad Workflow Progress */}
        {isAdMode && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-orange-500" />
                Workflow Progress
              </h3>
              <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
                Step {currentStepIdx + 1}/{adSteps.length}
              </span>
            </div>

            <div className="space-y-1.5">
              {adSteps.map((step, idx) => {
                const isActive = step.id === adStep;
                const isDone = idx < currentStepIdx;
                const StepIcon = step.icon;
                return (
                  <div
                    key={step.id}
                    className={`px-3 py-2.5 rounded-xl transition-all text-xs flex items-center gap-2.5 ${
                      isActive
                        ? "bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold shadow-md shadow-orange-950/40"
                        : isDone
                        ? "bg-green-600/10 border border-green-500/20 text-green-400"
                        : "bg-[#1f1f22] border border-white/5 text-slate-500"
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <StepIcon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{step.label}</div>
                      <div className={`text-[10px] ${isActive ? "text-white/70" : "text-slate-500"}`}>{step.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tips Card */}
        <div className="bg-[#1f1f22]/50 rounded-xl border border-white/5 p-3.5 space-y-2.5">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
            Quick Tips
          </h4>
          <ul className="text-[10px] text-slate-500 list-disc pl-4 space-y-1">
            <li>Drag generated images to prompt area for iterative refinement</li>
            <li>AI auto-generates optimized prompts from product description</li>
            <li>Video prompts follow professional product photography rules</li>
            <li>15s ad videos with character dialogue support</li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <div className="flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-orange-500/70" />
          <span>Ad Studio Ready</span>
        </div>
        <span>Agnes SDK v2.0</span>
      </div>
    </aside>
  );
}
