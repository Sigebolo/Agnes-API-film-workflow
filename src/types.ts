/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CharacterAnchor {
  id: string;
  description: string;
  sheetUrl: string;
  viewUrls: {
    front?: string;
    side?: string;
    back?: string;
    threeQuarter?: string;
  };
}

export interface HistoryImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

export interface VideoClip {
  id: string;
  imagePrompt: string;
  videoPrompt: string;
  imageUrl?: string;
  videoUrl?: string;
  /** Last frame of this clip's video — used as reference for the next chain segment */
  lastFrameUrl?: string;
  /** Index in a multi-segment chain (0-based). Present when clip was created via chain extend. */
  chainIndex?: number;
  subtitle?: string;
  duration?: number;
  voiceoverUrl?: string;
  imageTaskId?: string;
  videoTaskId?: string;
  imageTaskStatus?: TaskStatus;
  videoTaskStatus?: TaskStatus;
  useCharacterAnchor?: boolean;
  imageHistory?: HistoryImage[];
}

export type TaskStatus = 'idle' | 'generating' | 'polling' | 'completed' | 'failed';

export type AppStep = 'prompt' | 'image' | 'video' | 'timeline';

// ==========================================
// Ad Product Types
// ==========================================

export type ProductCategory = 'digital' | 'fashion' | 'food' | 'home' | 'beauty' | 'sports';
export type BrandStyle = 'minimalist' | 'luxury' | 'trendy' | 'warm' | 'tech';
export type TargetPlatform = 'taobao' | 'douyin' | 'xiaohongshu' | 'instagram' | 'general';

export interface Product {
  name: string;
  description: string;
  category: ProductCategory;
  style: BrandStyle;
  targetPlatform: TargetPlatform;
}

export interface LogoVariant {
  id: string;
  prompt: string;
  imageUrl?: string;
  status: TaskStatus;
}

export interface LogoResult {
  id: string;
  product: Product;
  variants: LogoVariant[];
  createdAt: number;
}

export type MarketingScene = 'ecommerce' | 'social' | 'poster' | 'lifestyle';

export interface MarketingVariant {
  id: string;
  prompt: string;
  imageUrl?: string;
  status: TaskStatus;
  scene: MarketingScene;
}

export interface ProductImageResult {
  id: string;
  product: Product;
  sourceImageUrl?: string;
  sourceTextDesc?: string;
  variants: MarketingVariant[];
  createdAt: number;
}

export interface AdVideoResult {
  id: string;
  product: Product;
  sourceImageUrl: string;
  adCopy: string;
  videoPrompt: string;
  characterName?: string;
  characterDescription?: string;
  dialogue?: string;
  videoUrl?: string;
  videoTaskId?: string;
  status: TaskStatus;
  duration: number;
  createdAt: number;
}

export type AdWorkflowStep = 'product' | 'logo' | 'product-image' | 'ad-video';

export interface AdWorkflowState {
  isAdMode: boolean;
  adStep: AdWorkflowStep;
  adProduct: Product;
  logoResult: LogoResult | null;
  logoVariants: LogoVariant[];
  isLogoGenerating: boolean;
  skippedLogo?: boolean;
  skippedProductImage?: boolean;
  selectedLogoUrl: string | null;
  imageResult: ProductImageResult | null;
  videoResult: AdVideoResult | null;
  outputFolder: string | null;
}

export interface WorkflowState {
  apiKey: string;
  clips: VideoClip[];
  activeClipId: string | null;
  currentStep: AppStep;
  characterAnchor: CharacterAnchor | null;
  mergedVideoUrl: string | null;
  mergedSubtitlesUrl: string | null;
  mergedVoiceoverUrl: string | null;
  isMerging: boolean;
}
