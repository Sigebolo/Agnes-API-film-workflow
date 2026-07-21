/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Key, Megaphone, HelpCircle, AlertCircle, Sparkles, Folder, ChevronRight, Settings, Check, Save, Package, Image as ImageIcon, Film, Layers, Clock, RefreshCw, ExternalLink, Trash2 } from "lucide-react";
import { WorkflowState } from "../types";
import { listTasks, saveTask, deleteTask, queryTaskStatus, TaskRecord } from "../utils/api";
import { t } from "../utils/locale";

interface SidebarProps {
  apiKey: string;
  onChangeApiKey: (key: string) => void;
  onSaveApiKey: (key: string) => void;
  state: WorkflowState;
  isAdMode?: boolean;
  adStep?: string;
  outputFolder?: string | null;
}

export default function Sidebar({
  apiKey,
  onChangeApiKey,
  onSaveApiKey,
  state,
  isAdMode,
  adStep,
  outputFolder,
}: SidebarProps) {
  const [savedKey, setSavedKey] = useState(apiKey);
  const [showSaved, setShowSaved] = useState(false);
  const isDirty = apiKey !== savedKey;
  const isDemoKey = apiKey.toLowerCase().includes("demo") || apiKey.includes("••••");

  // Auto-sync API key to CLI config on every valid change
  const lastSyncedKey = useRef(apiKey);
  useEffect(() => {
    if (apiKey && apiKey !== lastSyncedKey.current && !isDemoKey && apiKey.length > 5) {
      lastSyncedKey.current = apiKey;
      fetch("/api/sync-cli-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      }).catch(() => {});
    }
  }, [apiKey, isDemoKey]);

  // Task history
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  useEffect(() => {
    loadAllTasks();
  }, []);

  const loadAllTasks = async () => {
    try {
      const [webTasks, cliRes] = await Promise.all([
        listTasks().catch(() => []),
        fetch("/api/sync-cli-tasks").then(r => r.json()).catch(() => ({ tasks: [] })),
      ]);

      // Merge CLI tasks into web tasks
      const cliTasks: TaskRecord[] = (cliRes.tasks || []).map((t: any) => ({
        id: t.video_id || "",
        prompt: t.prompt || "",
        status: t.status === "synced" ? "completed" : t.status,
        videoUrl: t.video_url || "",
        createdAt: t.created_at || "",
        source: "cli" as const,
      }));

      const merged = [...webTasks, ...cliTasks];
      setTasks(merged);
    } catch {
      setTasks([]);
    }
  };

  const handleSave = () => {
    onSaveApiKey(apiKey);
    setSavedKey(apiKey);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
    // Sync to CLI config
    fetch("/api/sync-cli-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    }).catch(() => {});
  };

  const adSteps = [
    { id: "product", label: t('sidebar.step.product'), icon: Package, desc: t('sidebar.step.product.desc') },
    { id: "logo", label: t('sidebar.step.logo'), icon: Sparkles, desc: t('sidebar.step.logo.desc') },
    { id: "product-image", label: t('sidebar.step.images'), icon: ImageIcon, desc: t('sidebar.step.images.desc') },
    { id: "ad-video", label: t('sidebar.step.video'), icon: Film, desc: t('sidebar.step.video.desc') },
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
            <h1 className="text-base font-bold tracking-tight text-white">{t('sidebar.title')}</h1>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider font-semibold uppercase">{t('sidebar.subtitle')}</span>
          </div>
        </div>

        {/* API Key Credentials input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-orange-500" />
              {t('sidebar.apiKey.label')}
            </label>
            <a
              href="https://platform.agnes-ai.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-orange-400 hover:underline font-bold"
            >
              {t('sidebar.apiKey.get')}
            </a>
          </div>
          <div className="flex gap-1.5">
            <input
              type="password"
              className="flex-1 min-w-0 px-3 py-2 bg-[#1f1f22] border border-white/10 focus:border-orange-500/50 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors"
              placeholder={t('sidebar.apiKey.placeholder')}
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
              {showSaved ? t('sidebar.apiKey.saved') : t('sidebar.apiKey.save')}
            </button>
          </div>
          {!apiKey ? (
            <p className="text-[10px] text-orange-400/80 flex items-center gap-1 leading-relaxed">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {t('sidebar.apiKey.required')}
            </p>
          ) : isDemoKey ? (
            <p className="text-[10px] text-yellow-400/80 flex items-center gap-1 leading-relaxed">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {t('sidebar.apiKey.demo')}
            </p>
          ) : (
            <p className="text-[10px] text-green-400/80 flex items-center gap-1 leading-relaxed">
              <Check className="w-3 h-3 flex-shrink-0" />
              {t('sidebar.apiKey.connected')}
            </p>
          )}
        </div>

        {/* Ad Workflow Progress */}
        {isAdMode && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-orange-500" />
                {t('sidebar.workflow.title')}
              </h3>
              <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
                {t('sidebar.step.step')} {currentStepIdx + 1}/{adSteps.length}
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
            {t('sidebar.tips.title')}
          </h4>
          <ul className="text-[10px] text-slate-500 list-disc pl-4 space-y-1">
            <li>{t('sidebar.tips.drag')}</li>
            <li>{t('sidebar.tips.auto')}</li>
            <li>{t('sidebar.tips.follow')}</li>
            <li>{t('sidebar.tips.support')}</li>
          </ul>
        </div>

        {/* Task History */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-orange-500" />
              {t('sidebar.tasks.title')}
            </h3>
            <button
              onClick={async () => {
                setRefreshing("all");
                const updated = await listTasks();
                setTasks(updated);
                setRefreshing(null);
              }}
              className="text-[10px] text-slate-500 hover:text-orange-400 transition-colors cursor-pointer"
              title={t('sidebar.refresh')}
            >
              <RefreshCw className={`w-3 h-3 ${refreshing === "all" ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Manual task input */}
          <div className="flex gap-1.5">
            <input
              type="text"
              className="flex-1 min-w-0 px-2 py-1.5 bg-[#1f1f22] border border-white/10 focus:border-orange-500/50 rounded-lg text-[10px] text-white font-mono placeholder:text-slate-600 focus:outline-none"
              placeholder={t('sidebar.tasks.placeholder')}
              id="manual-task-input"
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  const input = e.target as HTMLInputElement;
                  const taskId = input.value.trim();
                  if (!taskId) return;
                  input.value = "";
                  // Check if already in list
                  if (tasks.some(t => t.id === taskId)) return;
                  const newTask: TaskRecord = {
                    id: taskId,
                    type: "video",
                    prompt: t('sidebar.tasks.manual'),
                    status: "queued",
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  };
                  await saveTask(newTask);
                  setTasks(prev => [newTask, ...prev]);
                }
              }}
            />
            <button
              onClick={async () => {
                setRefreshing("query-all");
                const allTasks = await listTasks();
                const pending = allTasks.filter(t => t.status !== "completed" && t.status !== "failed" && t.status !== "expired" && !t.id.startsWith("pending_"));
                for (const t of pending) {
                  try {
                    const result = await queryTaskStatus(t.id, apiKey);
                    t.status = result.status;
                    if (result.videoUrl) t.videoUrl = result.videoUrl;
                    t.updatedAt = Date.now();
                    await saveTask(t);
                  } catch {}
                }
                setTasks([...allTasks]);
                setRefreshing(null);
              }}
              className="px-2 py-1.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-lg text-[10px] font-semibold hover:bg-orange-500/30 transition-colors cursor-pointer flex items-center gap-1"
              title={t('sidebar.tasks.queryAll')}
            >
              <RefreshCw className={`w-3 h-3 ${refreshing === "query-all" ? "animate-spin" : ""}`} />
              {t('sidebar.tasks.queryAll')}
            </button>
          </div>

          {/* Task list */}
          {tasks.length === 0 ? (
            <p className="text-[10px] text-slate-600 text-center py-2">{t('sidebar.tasks.empty')}</p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="px-3 py-2 rounded-xl bg-[#1f1f22] border border-white/5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {task.status === "completed" ? (
                        <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                      ) : task.status === "failed" ? (
                        <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                      ) : task.status === "expired" ? (
                        <AlertCircle className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      ) : task.status === "submitting" ? (
                        <RefreshCw className="w-3 h-3 text-orange-400 flex-shrink-0 animate-spin" />
                      ) : (
                        <Clock className="w-3 h-3 text-yellow-400 flex-shrink-0 animate-pulse" />
                      )}
                      <span className="truncate text-slate-300 font-mono text-[10px]">
                        {task.id.slice(0, 20)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {task.status === "completed" && task.videoUrl && (
                        <a
                          href={task.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-400 hover:text-green-300 transition-colors"
                          title={t('sidebar.tasks.openVideo')}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        onClick={async () => {
                          setRefreshing(task.id);
                          try {
                            const result = await queryTaskStatus(task.id, apiKey);
                            setTasks(prev =>
                              prev.map(t =>
                                t.id === task.id
                                  ? { ...t, status: result.status, videoUrl: result.videoUrl || t.videoUrl, updatedAt: Date.now() }
                                  : t
                              )
                            );
                          } catch {}
                          setRefreshing(null);
                        }}
                        className="text-slate-500 hover:text-orange-400 transition-colors cursor-pointer"
                        title={t('sidebar.tasks.refreshStatus')}
                      >
                        <RefreshCw className={`w-3 h-3 ${refreshing === task.id ? "animate-spin" : ""}`} />
                      </button>
                      <button
                        onClick={async () => {
                          await deleteTask(task.id);
                          setTasks(prev => prev.filter(t => t.id !== task.id));
                        }}
                        className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        title={t('sidebar.tasks.delete')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500 truncate">
                    {task.prompt.slice(0, 50)}{task.prompt.length > 50 ? "..." : ""}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-600">
                    <span>{new Date(task.createdAt).toLocaleString()}</span>
                    <span className={`font-semibold ${
                      task.status === "completed" ? "text-green-500" :
                      task.status === "failed" ? "text-red-500" :
                      task.status === "expired" ? "text-slate-500" :
                      task.status === "submitting" ? "text-orange-400" : "text-yellow-500"
                    }`}>
                      {task.status === "submitting" ? t('sidebar.tasks.submitting') : task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Output folder link */}
      {outputFolder && (
        <a
          href={outputFolder}
          target="_blank"
          rel="noopener noreferrer"
          className="pb-1 text-[10px] text-slate-500 hover:text-orange-400 transition-colors flex items-center gap-1 truncate"
          title={t('sidebar.outputFolder')}
        >
          <Folder className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{outputFolder}</span>
        </a>
      )}

      {/* Footer */}
      <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <div className="flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-orange-500/70" />
          <span>{t('sidebar.footer.ready')}</span>
        </div>
        <span>Agnes SDK v2.0</span>
      </div>
    </aside>
  );
}
