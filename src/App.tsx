/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, Image as ImageIcon, Film, Layers, CheckCircle2, AlertCircle, Megaphone, SkipForward, Eye } from "lucide-react";
import { VideoClip, AppStep, WorkflowState, Product, LogoResult, LogoVariant, ProductImageResult, AdVideoResult, AdWorkflowStep } from "./types";
import Sidebar from "./components/Sidebar";
import PromptOptimizeStep from "./components/PromptOptimizeStep";
import ImageGenerateStep from "./components/ImageGenerateStep";
import VideoGenerateStep from "./components/VideoGenerateStep";
import Timeline from "./components/Timeline";
import ProductInputStep from "./components/ProductInputStep";
import LogoGenerateStep from "./components/LogoGenerateStep";
import ProductImageStep from "./components/ProductImageStep";
import AdVideoStep from "./components/AdVideoStep";
import { ToastContainer, ToastItem, createToast } from "./components/Toast";
import { loadWorkflow, saveWorkflow, saveAdWorkflow, loadAdWorkflow } from "./utils/storage";
import { createOutputFolder } from "./utils/api";

const LOCAL_STORAGE_KEY_API = "agnes_api_key_v2";

const defaultClip: VideoClip = {
  id: "clip_initial_1",
  imagePrompt: "A majestic red-haired astronaut standing on the edge of a colossal red Martian canyon, looking at a twin sunset, cinematic realism, dramatic volumetric lighting, ultra-detailed 8k",
  videoPrompt: "Slow cinematic pan-right, camera tracking the astronaut's gaze towards the twin sunset, subtle dust particles floating in air",
  subtitle: "We have finally established our first colony on the red planet.",
  imageUrl: "https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&q=80&w=800"
};

const defaultState: WorkflowState = {
  apiKey: "demo-key-agnes",
  clips: [defaultClip],
  activeClipId: defaultClip.id,
  currentStep: "prompt",
  characterAnchor: null,
  mergedVideoUrl: null,
  mergedSubtitlesUrl: null,
  mergedVoiceoverUrl: null,
  isMerging: false,
};

const defaultProduct: Product = {
  name: "",
  description: "",
  category: "digital",
  style: "minimalist",
  targetPlatform: "general",
};

function getInitialState(): WorkflowState {
  if (typeof window === "undefined") return defaultState;

  const saved = loadWorkflow();
  if (saved && saved.clips && saved.clips.length > 0) {
    return { ...defaultState, ...saved };
  }

  let savedKey = "";
  try { savedKey = localStorage.getItem(LOCAL_STORAGE_KEY_API) || ""; } catch {}
  if (savedKey) {
    return { ...defaultState, apiKey: savedKey };
  }
  return defaultState;
}

function getInitialAdState() {
  if (typeof window === "undefined") {
    return {
      isAdMode: true, adStep: "product" as AdWorkflowStep, adProduct: defaultProduct,
      logoResult: null, logoVariants: [], isLogoGenerating: false,
      skippedLogo: false, skippedProductImage: false,
      selectedLogoUrl: null, imageResult: null, videoResult: null, outputFolder: null
    };
  }
  const saved = loadAdWorkflow();
  return {
    isAdMode: saved?.isAdMode ?? true,
    adStep: saved?.adStep ?? "product",
    adProduct: saved?.adProduct ?? defaultProduct,
    logoResult: saved?.logoResult ?? null,
    logoVariants: saved?.logoVariants ?? [],
    isLogoGenerating: saved?.isLogoGenerating ?? false,
    skippedLogo: saved?.skippedLogo ?? false,
    skippedProductImage: saved?.skippedProductImage ?? false,
    selectedLogoUrl: saved?.selectedLogoUrl ?? null,
    imageResult: saved?.imageResult ?? null,
    videoResult: saved?.videoResult ?? null,
    outputFolder: saved?.outputFolder ?? null,
  };
}

export default function App() {
  const [state, setState] = useState<WorkflowState>(getInitialState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ad workflow state
  const initialAd = getInitialAdState();
  const [isAdMode, setIsAdMode] = useState(initialAd.isAdMode);
  const [adStep, setAdStep] = useState<AdWorkflowStep>(initialAd.adStep);
  const [adProduct, setAdProduct] = useState<Product>(initialAd.adProduct);
  const [logoResult, setLogoResult] = useState<LogoResult | null>(initialAd.logoResult);
  const [logoVariants, setLogoVariants] = useState<LogoVariant[]>(initialAd.logoVariants);
  const [isLogoGenerating, setIsLogoGenerating] = useState(initialAd.isLogoGenerating);
  const [skippedLogo, setSkippedLogo] = useState(initialAd.skippedLogo);
  const [skippedProductImage, setSkippedProductImage] = useState(initialAd.skippedProductImage);
  const [selectedLogoUrl, setSelectedLogoUrl] = useState<string | null>(initialAd.selectedLogoUrl);
  const [imageResult, setImageResult] = useState<ProductImageResult | null>(initialAd.imageResult);
  const [videoResult, setVideoResult] = useState<AdVideoResult | null>(initialAd.videoResult);
  const [outputFolder, setOutputFolder] = useState<string | null>(initialAd.outputFolder);

  // Save workflow to localStorage (debounced 500ms)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveWorkflow(state);
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  // Save ad workflow to localStorage (debounced 500ms)
  const adSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (adSaveTimerRef.current) clearTimeout(adSaveTimerRef.current);
    adSaveTimerRef.current = setTimeout(() => {
      saveAdWorkflow({ isAdMode, adStep, adProduct, logoResult, logoVariants, isLogoGenerating, skippedLogo, skippedProductImage, selectedLogoUrl, imageResult, videoResult, outputFolder });
    }, 500);
    return () => {
      if (adSaveTimerRef.current) clearTimeout(adSaveTimerRef.current);
    };
  }, [isAdMode, adStep, adProduct, logoResult, logoVariants, isLogoGenerating, skippedLogo, skippedProductImage, selectedLogoUrl, imageResult, videoResult, outputFolder]);

  // Save legacy API key for backward compatibility
  useEffect(() => {
    try { localStorage.setItem(LOCAL_STORAGE_KEY_API, state.apiKey); } catch {}
  }, [state.apiKey]);

  // Toast state
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: ToastItem) => {
    setToasts((prev) => [...prev, toast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateState = (updates: Partial<WorkflowState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const handleUpdateClip = (clipId: string, updates: Partial<VideoClip>) => {
    setState((prev) => {
      const updatedClips = prev.clips.map((clip) => {
        if (clip.id === clipId) {
          return { ...clip, ...updates };
        }
        return clip;
      });
      return { ...prev, clips: updatedClips };
    });
  };

  const handleAddBlankClip = () => {
    const newId = `clip_${Date.now()}`;
    const newClip: VideoClip = {
      id: newId,
      imagePrompt: "",
      videoPrompt: "",
      subtitle: "",
    };

    setState((prev) => ({
      ...prev,
      clips: [...prev.clips, newClip],
      activeClipId: newId,
      currentStep: "prompt",
    }));
  };

  const activeClip = state.clips.find((c) => c.id === state.activeClipId) || state.clips[0];

  // Ad workflow handlers
  const handleAdNext = (step: AdWorkflowStep) => {
    if (adStep === "product" && step === "logo" && adProduct.name) {
      createOutputFolder(adProduct.name).then(setOutputFolder);
    }
    setAdStep(step);
  };

  // Handle step bar clicks with dependency validation
  const handleAdStepClick = (step: AdWorkflowStep) => {
    const steps: AdWorkflowStep[] = ["product", "logo", "product-image", "ad-video"];
    const targetIdx = steps.indexOf(step);
    const currentIdx = steps.indexOf(adStep);

    // Going backward always allowed
    if (targetIdx <= currentIdx) {
      setAdStep(step);
      return;
    }

    // Going forward: validate dependencies
    if (step === "logo") {
      if (!adProduct.name.trim()) {
        addToast(createToast("warning", "Enter product name first"));
        return;
      }
    } else if (step === "product-image") {
      if (!adProduct.name.trim()) {
        addToast(createToast("warning", "Enter product info first"));
        return;
      }
      if (!skippedLogo && !logoResult && logoVariants.length === 0) {
        addToast(createToast("info", "Consider generating a logo first, or skip this step"));
      }
    } else if (step === "ad-video") {
      if (!adProduct.name.trim()) {
        addToast(createToast("warning", "Enter product info first"));
        return;
      }
    }

    setAdStep(step);
  };

  const handleAdBack = () => {
    const steps: AdWorkflowStep[] = ["product", "logo", "product-image", "ad-video"];
    const currentIdx = steps.indexOf(adStep);
    if (currentIdx > 0) {
      setAdStep(steps[currentIdx - 1]);
    }
  };

  const handleSkipLogo = () => {
    setSkippedLogo(true);
    setLogoResult(null);
    setLogoVariants([]);
    setSelectedLogoUrl(null);
    addToast(createToast("info", "Logo step skipped — will use generic placeholder"));
    setAdStep("product-image");
  };

  const handleSkipProductImage = () => {
    setSkippedProductImage(true);
    setImageResult(null);
    addToast(createToast("info", "Product image step skipped — proceed with logo reference"));
    setAdStep("ad-video");
  };

  const handleLogoComplete = (result: LogoResult) => {
    setLogoResult(result);
    setSkippedLogo(false);
    handleAdNext("product-image");
  };

  const handleLogoSelected = (imageUrl: string) => {
    setSelectedLogoUrl(imageUrl);
  };

  const handleImageComplete = (result: ProductImageResult) => {
    setImageResult(result);
    setSkippedProductImage(false);
    handleAdNext("ad-video");
  };

  const handleVideoComplete = (result: AdVideoResult) => {
    setVideoResult(result);
    addToast(createToast("success", "Ad video completed!"));
  };

  const handleResetAd = () => {
    setAdStep("product");
    setAdProduct(defaultProduct);
    setLogoResult(null);
    setLogoVariants([]);
    setSkippedLogo(false);
    setSkippedProductImage(false);
    setImageResult(null);
    setVideoResult(null);
  };

  const stepItems: { id: AppStep; label: string; icon: React.ReactNode }[] = [
    {
      id: "prompt",
      label: "Prompt & Anchor",
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: "image",
      label: "Generate Image",
      icon: <ImageIcon className="w-4 h-4" />,
    },
    {
      id: "video",
      label: "Create Video",
      icon: <Film className="w-4 h-4" />,
    },
    {
      id: "timeline",
      label: "Timeline Merge",
      icon: <Layers className="w-4 h-4" />,
    },
  ];

  const adStepItems: { id: AdWorkflowStep; label: string; icon: React.ReactNode; skipLabel?: string; onSkip?: () => void }[] = [
    { id: "product", label: "Product Info", icon: <Megaphone className="w-4 h-4" /> },
    { id: "logo", label: "Logo Design", icon: <Sparkles className="w-4 h-4" />, skipLabel: "Skip Logo", onSkip: handleSkipLogo },
    { id: "product-image", label: "Product Images", icon: <ImageIcon className="w-4 h-4" />, skipLabel: "Skip Images", onSkip: handleSkipProductImage },
    { id: "ad-video", label: "Ad Video", icon: <Film className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0D0D0E] text-slate-300 p-4 lg:p-6 flex flex-col font-sans selection:bg-orange-500/30" id="app-root-container">
      {/* Header Container */}
      <header className="max-w-7xl w-full mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 px-4 py-3 bg-[#161618] border border-white/5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-orange-900/20">A</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              Agnes AI <span className="text-orange-500">Ad Studio</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              AI Ad Video Production · Product Logo · Marketing Images · 15s Ad Videos
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsAdMode(!isAdMode);
              if (!isAdMode) handleResetAd();
            }}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isAdMode
                ? "bg-gradient-to-r from-orange-600 to-red-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            <Megaphone className="w-4 h-4" />
            {isAdMode ? "Ad Mode" : "Creative Mode"}
          </button>
        </div>

        {/* Global Warning for API Key */}
        {!state.apiKey && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Please enter your Agnes API Key in the left panel to proceed.</span>
          </div>
        )}
      </header>

      {/* Main Content Layout Grid */}
      <main className="max-w-7xl w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar Panel */}
        <div className="lg:col-span-3 flex flex-col h-full">
          <Sidebar
            apiKey={state.apiKey}
            onChangeApiKey={(key) => updateState({ apiKey: key })}
            onSaveApiKey={(key) => {
              updateState({ apiKey: key });
              try { localStorage.setItem("agnes_api_key_v2", key); } catch {}
            }}
            state={state}
            isAdMode={isAdMode}
            adStep={isAdMode ? adStep : undefined}
            outputFolder={outputFolder}
          />
        </div>

        {/* Dynamic Workflow Stage */}
        <div className="lg:col-span-9 space-y-6">
          {isAdMode ? (
            /* Ad Mode */
            <>
              {/* Ad Step Indicator */}
              <div className="bg-[#161618] rounded-2xl border border-white/5 p-3.5 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {adStepItems.map((step, idx) => {
                    const isActive = adStep === step.id;
                    const currentIdx = adStepItems.findIndex((s) => s.id === adStep);
                    const isDone = idx < currentIdx;
                    const isSkipped = (step.id === "logo" && skippedLogo) || (step.id === "product-image" && skippedProductImage);
                    return (
                      <React.Fragment key={step.id}>
                        {idx > 0 && <div className="w-4 h-[1px] bg-white/5" />}
                        <div className="relative group">
                          <button
                            onClick={() => handleAdStepClick(step.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                              isActive
                                ? "bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold shadow-md shadow-orange-950/40"
                                : isDone || isSkipped
                                ? "text-green-400 hover:bg-white/5"
                                : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                            }`}
                          >
                            {isDone ? <CheckCircle2 className="w-4 h-4" /> : isSkipped ? <SkipForward className="w-4 h-4" /> : step.icon}
                            <span>{step.label}</span>
                          </button>
                          {/* Skip button tooltip on hover */}
                          {!isActive && step.onSkip && (
                            <button
                              onClick={(e) => { e.stopPropagation(); step.onSkip?.(); }}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500/80 hover:bg-orange-500 text-white rounded-full text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              title={step.skipLabel}
                            >
                              <SkipForward className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <Eye className="w-3 h-3" />
                  Click any step to navigate freely
                </div>
              </div>

              {/* Ad Step Content */}
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={adStep}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                  >
                    {!state.apiKey ? (
                      <div className="bg-[#161618] border border-white/5 rounded-2xl p-12 text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                          <AlertCircle className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold text-slate-200">API Key Required</h3>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Please enter your Agnes API Key in the left configuration panel.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {adStep === "product" && (
                          <ProductInputStep
                            product={adProduct}
                            onUpdate={setAdProduct}
                            onNext={() => handleAdNext("logo")}
                          />
                        )}

                        {adStep === "logo" && (
                          <LogoGenerateStep
                            apiKey={state.apiKey}
                            product={adProduct}
                            variants={logoVariants}
                            isGenerating={isLogoGenerating}
                            onVariantsChange={setLogoVariants}
                            onGeneratingChange={setIsLogoGenerating}
                            onLogoSelected={handleLogoSelected}
                            onBack={handleAdBack}
                            onNext={handleLogoComplete}
                            onSkip={handleSkipLogo}
                          />
                        )}

                        {adStep === "product-image" && (
                          <ProductImageStep
                            apiKey={state.apiKey}
                            product={adProduct}
                            logoImageUrl={selectedLogoUrl || logoResult?.variants.find(v => v.status === "completed")?.imageUrl || ""}
                            onBack={handleAdBack}
                            onNext={handleImageComplete}
                            onSkip={handleSkipProductImage}
                          />
                        )}

                        {adStep === "ad-video" && (
                          <AdVideoStep
                            apiKey={state.apiKey}
                            product={adProduct}
                            sourceImageUrl={imageResult?.sourceImageUrl || logoResult?.variants?.find(v => v.imageUrl)?.imageUrl || ""}
                            adCopy={adProduct.description}
                            onBack={handleAdBack}
                            onComplete={handleVideoComplete}
                          />
                        )}
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          ) : (
            /* Creative Mode (Single Clip) */
            <>
              {/* Step Indicator Bar */}
              <div className="bg-[#161618] rounded-2xl border border-white/5 p-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {stepItems.map((step, idx) => {
                    const isActive = state.currentStep === step.id;
                    return (
                      <React.Fragment key={step.id}>
                        {idx > 0 && <div className="w-4 h-[1px] bg-white/5" />}
                        <button
                          onClick={() => updateState({ currentStep: step.id })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isActive
                              ? "bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold shadow-md shadow-orange-950/40"
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                          }`}
                        >
                          {step.icon}
                          <span>{step.label}</span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <Eye className="w-3 h-3" />
                  Click any step to jump
                </div>
              </div>

              {/* Render Step content inside AnimatePresence */}
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={state.currentStep + "_" + state.activeClipId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                  >
                    {!state.apiKey ? (
                      <div className="bg-[#161618] border border-white/5 rounded-2xl p-12 text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                          <AlertCircle className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold text-slate-200">API Credentials Required</h3>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            This workflow integrates directly with Agnes's state-of-the-art cinematic engine. Please key in your Agnes API Key in the left configuration sidebar.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {state.currentStep === "prompt" && (
                          <PromptOptimizeStep
                            apiKey={state.apiKey}
                            activeClip={activeClip}
                            characterAnchor={state.characterAnchor}
                            onUpdateClip={(updates) => handleUpdateClip(activeClip.id, updates)}
                            onSetCharacterAnchor={(anchor) => updateState({ characterAnchor: anchor })}
                            onNext={() => updateState({ currentStep: "image" })}
                            onSkipToVideo={() => updateState({ currentStep: "video" })}
                            onToast={addToast}
                          />
                        )}

                        {state.currentStep === "image" && (
                          <ImageGenerateStep
                            apiKey={state.apiKey}
                            activeClip={activeClip}
                            characterAnchor={state.characterAnchor}
                            onUpdateClip={(updates) => handleUpdateClip(activeClip.id, updates)}
                            onPrev={() => updateState({ currentStep: "prompt" })}
                            onNext={() => updateState({ currentStep: "video" })}
                            onToast={addToast}
                          />
                        )}

                        {state.currentStep === "video" && (
                          <VideoGenerateStep
                            apiKey={state.apiKey}
                            activeClip={activeClip}
                            onUpdateClip={(updates) => handleUpdateClip(activeClip.id, updates)}
                            onPrev={() => updateState({ currentStep: "image" })}
                            onSaveToTimeline={() => {}}
                            onGoToTimeline={() => updateState({ currentStep: "timeline" })}
                            onToast={addToast}
                          />
                        )}

                        {state.currentStep === "timeline" && (
                          <Timeline
                            apiKey={state.apiKey}
                            clips={state.clips}
                            onSetClips={(newClips) => updateState({ clips: newClips })}
                            onSelectClip={(id) => updateState({ activeClipId: id })}
                            onAddBlankClip={handleAddBlankClip}
                            state={state}
                            onUpdateState={updateState}
                          />
                        )}
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}