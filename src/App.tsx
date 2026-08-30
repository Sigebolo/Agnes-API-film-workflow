/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, Image as ImageIcon, Film, CheckCircle2, AlertCircle, Megaphone, SkipForward, Eye } from "lucide-react";
import { Product, LogoVariant, ProductImageResult, AdVideoResult, AdWorkflowStep } from "./types";
import Sidebar from "./components/Sidebar";
import ProductInputStep from "./components/ProductInputStep";
import LogoGenerateStep from "./components/LogoGenerateStep";
import ProductImageStep from "./components/ProductImageStep";
import AdVideoStep from "./components/AdVideoStep";
import { ToastContainer, ToastItem, createToast } from "./components/Toast";
import { saveAdWorkflow, loadAdWorkflow } from "./utils/storage";
import { createOutputFolder } from "./utils/api";

const LOCAL_STORAGE_KEY_API = "agnes_api_key_v2";

const defaultProduct: Product = {
  name: "",
  description: "",
  category: "digital",
  style: "minimalist",
  targetPlatform: "general",
};

function getInitialApiKey(): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem(LOCAL_STORAGE_KEY_API) || ""; } catch { return ""; }
}

function getInitialAdState() {
  if (typeof window === "undefined") {
    return {
      adStep: "product" as AdWorkflowStep, adProduct: defaultProduct,
      logoResult: null, logoVariants: [], isLogoGenerating: false,
      skippedLogo: false, skippedProductImage: false,
      selectedLogoUrl: null, imageResult: null, videoResult: null, outputFolder: null
    };
  }
  const saved = loadAdWorkflow();
  return {
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
  const [apiKey, setApiKey] = useState<string>(getInitialApiKey);

  // Ad workflow state
  const initialAd = getInitialAdState();
  const [adStep, setAdStep] = useState<AdWorkflowStep>(initialAd.adStep);
  const [adProduct, setAdProduct] = useState<Product>(initialAd.adProduct);
  const [logoVariants, setLogoVariants] = useState<LogoVariant[]>(() => {
    // Don't restore mid-flight "generating" cards as stuck spinners after refresh
    return (initialAd.logoVariants || []).map((v) =>
      v.status === "generating" || v.status === "polling"
        ? { ...v, status: v.imageUrl ? "completed" : "idle" }
        : v
    );
  });
  // Never restore isLogoGenerating=true across reloads — no in-flight request survives refresh
  const [isLogoGenerating, setIsLogoGenerating] = useState(false);
  const [skippedLogo, setSkippedLogo] = useState(initialAd.skippedLogo);
  const [skippedProductImage, setSkippedProductImage] = useState(initialAd.skippedProductImage);
  const [selectedLogoUrl, setSelectedLogoUrl] = useState<string | null>(initialAd.selectedLogoUrl);
  const [imageResult, setImageResult] = useState<ProductImageResult | null>(initialAd.imageResult);
  const [videoResult, setVideoResult] = useState<AdVideoResult | null>(initialAd.videoResult);
  const [outputFolder, setOutputFolder] = useState<string | null>(initialAd.outputFolder);

  // Derived: first completed logo variant acts as the picked Logo (also persisted as logoResult)
  const logoResult = logoVariants.find((v) => v.status === "completed")
    ? {
        id: `logo_${Date.now()}`,
        product: adProduct,
        variants: logoVariants,
        createdAt: Date.now(),
      }
    : null;

  // Save ad workflow to localStorage (debounced 500ms)
  const adSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (adSaveTimerRef.current) clearTimeout(adSaveTimerRef.current);
    adSaveTimerRef.current = setTimeout(() => {
      saveAdWorkflow({
        isAdMode: true,
        adStep,
        adProduct,
        logoResult,
        logoVariants,
        isLogoGenerating,
        skippedLogo,
        skippedProductImage,
        selectedLogoUrl,
        imageResult,
        videoResult,
        outputFolder,
      });
    }, 500);
    return () => {
      if (adSaveTimerRef.current) clearTimeout(adSaveTimerRef.current);
    };
  }, [adStep, adProduct, logoVariants, isLogoGenerating, skippedLogo, skippedProductImage, selectedLogoUrl, imageResult, videoResult, outputFolder]);

  // Save API key to localStorage
  useEffect(() => {
    try { localStorage.setItem(LOCAL_STORAGE_KEY_API, apiKey); } catch {}
  }, [apiKey]);

  // Toast state
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: ToastItem) => {
    setToasts((prev) => [...prev, toast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);  // Ad workflow handlers
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

  const handleLogoComplete = () => {
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
    setLogoVariants([]);
    setSkippedLogo(false);
    setSkippedProductImage(false);
    setImageResult(null);
    setVideoResult(null);
  };

  const adStepItems: { id: AdWorkflowStep; label: string; icon: React.ReactNode; onSkip?: () => void }[] = [
    { id: "product", label: "产品信息", icon: <Megaphone className="w-4 h-4" /> },
    { id: "logo", label: "生成 Logo", icon: <Sparkles className="w-4 h-4" />, onSkip: handleSkipLogo },
    { id: "product-image", label: "宣传图片", icon: <ImageIcon className="w-4 h-4" />, onSkip: handleSkipProductImage },
    { id: "ad-video", label: "广告视频", icon: <Film className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0D0D0E] text-slate-300 p-4 lg:p-6 flex flex-col font-sans selection:bg-orange-500/30" id="app-root-container">
      {/* Header Container */}
      <header className="max-w-7xl w-full mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 px-4 py-3 bg-[#161618] border border-white/5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-orange-900/20">A</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              Agnes AI <span className="text-orange-500">广告生成器</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              产品信息 → Logo → 宣传图片 → 15秒广告
            </p>
          </div>
        </div>

        {/* Reset */}
        <button
          onClick={() => {
            if (confirm("重新开始整个广告流程？")) {
              handleResetAd();
            }
          }}
          className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-slate-800 text-slate-400 hover:bg-slate-700"
        >
          <Megaphone className="w-4 h-4" />
          重新开始
        </button>

        {/* Global Warning for API Key */}
        {!apiKey && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>请在左侧面板输入 Agnes API Key 后开始。</span>
          </div>
        )}
      </header>

      {/* Main Content Layout Grid */}
      <main className="max-w-7xl w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar Panel */}
        <div className="lg:col-span-3 flex flex-col h-full">
          <Sidebar
            apiKey={apiKey}
            onChangeApiKey={setApiKey}
            onSaveApiKey={setApiKey}
            adStep={adStep}
            outputFolder={outputFolder}
          />
        </div>

        {/* Dynamic Workflow Stage */}
        <div className="lg:col-span-9 space-y-6">
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
                          title="跳过此步骤"
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
              点击步骤自由跳转
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
                {!apiKey ? (
                  <div className="bg-[#161618] border border-white/5 rounded-2xl p-12 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-slate-200">API Credentials Required</h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        请在左侧输入 Agnes API Key（免费获取于 platform.agnes-ai.com）后开始生成广告。
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
                        apiKey={apiKey}
                        product={adProduct}
                        variants={logoVariants}
                        isGenerating={isLogoGenerating}
                        onVariantsChange={setLogoVariants}
                        onGeneratingChange={setIsLogoGenerating}
                        onLogoSelected={handleLogoSelected}
                        onBack={handleAdBack}
                        onNext={handleLogoComplete}
                        onSkip={handleSkipLogo}
                        addToast={addToast}
                      />
                    )}

                    {adStep === "product-image" && (
                      <ProductImageStep
                        apiKey={apiKey}
                        product={adProduct}
                        logoImageUrl={selectedLogoUrl || logoResult?.variants.find(v => v.imageUrl)?.imageUrl || ""}
                        onBack={handleAdBack}
                        onNext={handleImageComplete}
                        onSkip={handleSkipProductImage}
                        addToast={addToast}
                      />
                    )}

                    {adStep === "ad-video" && (
                      <AdVideoStep
                        apiKey={apiKey}
                        product={adProduct}
                        sourceImageUrl={imageResult?.sourceImageUrl || ""}
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
        </div>
      </main>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}