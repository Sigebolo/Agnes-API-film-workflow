# Character Anchor System Design

**Date:** 2026-06-25  
**Status:** Implementation in Progress  
**Author:** AI Agent

## Overview

The Character Anchor System solves the character consistency problem in AI-generated video clips. When generating multiple scenes of the same character, AI models produce different-looking people each time. This system generates multi-angle character reference images and uses them as anchors throughout the video generation pipeline.

## Problem Statement

Current workflow: `Prompt → Image → Video → Timeline`

- Each image generation is independent — no memory of previous characters
- Characters change appearance between clips (hair, face, clothing drift)
- Users must manually describe the same character for every clip
- No visual reference for multi-angle consistency

## Solution: Character Anchor Workflow

New workflow: `Prompt → Character Anchor → Image → Video → Timeline`

The Character Anchor step generates a "character turnaround sheet" — a single image containing the same character from multiple angles (front, side, back, 3/4 view). This sheet serves as:

1. **Visual reference** — shown to the user for verification
2. **img2img anchor** — used as reference image for subsequent image generations
3. **Description source** — character description injected into all prompts

## Architecture

### New Type: `CharacterAnchor`

```typescript
interface CharacterAnchor {
  id: string;                    // Unique identifier
  description: string;           // Detailed character appearance description
  sheetUrl: string;              // Main character sheet image URL
  viewUrls: {                    // Individual view URLs (if using multi-call mode)
    front?: string;
    side?: string;
    back?: string;
    threeQuarter?: string;
  };
}
```

### Updated `WorkflowState`

```typescript
interface WorkflowState {
  // ... existing fields
  characterAnchor: CharacterAnchor | null;  // NEW: active character anchor
}
```

### Updated `AppStep`

```typescript
type AppStep = 'prompt' | 'character' | 'image' | 'video' | 'timeline';
//                            ^^^^^^^^^ NEW STEP
```

## Component Design

### CharacterAnchorStep

**Location:** `src/components/CharacterAnchorStep.tsx`

**Props:**
```typescript
interface CharacterAnchorStepProps {
  apiKey: string;
  characterAnchor: CharacterAnchor | null;
  onSetCharacterAnchor: (anchor: CharacterAnchor | null) => void;
  onPrev: () => void;
  onNext: () => void;
  onToast?: (toast: ToastItem) => void;
}
```

**Features:**

1. **Character Description Input**
   - Textarea for manual description
   - "Auto-Extract from Story" button (calls `/api/analyze-character`)
   - Placeholder examples with specific details

2. **Generation Mode Toggle**
   - Single Sheet mode: 1 API call, generates all views in one image
   - Individual Views mode: 4 API calls, generates each angle separately

3. **Preview Panel**
   - Shows generated character sheet
   - View angle selector (if individual views exist)
   - Description preview with anchor status indicator

4. **Error Handling**
   - Inline error display
   - Toast notifications for success/failure

### Updated ImageGenerateStep

**Changes:**

1. Accept `characterAnchor` prop
2. When generating image:
   - If character anchor exists and `useCharacterAnchor` is true
   - Use `characterAnchor.sheetUrl` as `image` parameter in img2img
   - Prepend character description to prompt
3. Add toggle to enable/disable character anchor reference
4. Show character anchor status indicator

### Updated PromptOptimizeStep

**Changes:**

1. Accept `characterAnchor` prop
2. When optimizing prompt:
   - If character anchor exists, prepend character description to user input
   - Ensure optimized prompt maintains character consistency
3. Show character anchor toggle in UI

## API Design

### `generateCharacterSheetApi`

```typescript
async function generateCharacterSheetApi(
  apiKey: string,
  description: string,
  style?: string  // default: "character turnaround sheet, multiple views"
): Promise<string>  // Returns image URL
```

**Prompt Structure:**
```
masterpiece, best quality, ultra-detailed, 8k UHD, 
character turnaround reference sheet, [style],
[description],
front view, side view, back view, three-quarter view,
full body, neutral pose, white background
```

### `generateCharacterViewApi`

```typescript
async function generateCharacterViewApi(
  apiKey: string,
  description: string,
  viewAngle: "front" | "side" | "back" | "threeQuarter",
  referenceImageUrl?: string  // Optional: use sheet as img2img reference
): Promise<string>
```

**View Angle Prompts:**
- `front`: "front view, facing camera, neutral expression, full body"
- `side`: "side profile view, facing right, neutral expression, full body"
- `back`: "back view, rear perspective, neutral expression, full body"
- `threeQuarter`: "three-quarter angle view, 45 degrees, neutral expression, full body"

## Data Flow

```
User Input (description)
    ↓
CharacterAnchorStep
    ↓
generateCharacterSheetApi / generateCharacterViewApi
    ↓
CharacterAnchor { id, description, sheetUrl, viewUrls }
    ↓
WorkflowState.characterAnchor
    ↓
┌─────────────────────────────────────┐
│  ImageGenerateStep                  │
│  - Uses sheetUrl as img2img ref     │
│  - Injects description into prompt  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  PromptOptimizeStep                 │
│  - Prepends character description   │
│  - Maintains consistency keywords   │
└─────────────────────────────────────┘
```

## UI/UX Design

### Step Indicator

```
[Optimize Prompt] → [Character Anchor] → [Generate Image] → [Create Video] → [Timeline]
```

### Character Anchor Step Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ← 1.5 Character Anchor                          [User Icon] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────┐  ┌────────────────────────────┐  │
│  │ Character Description│  │ Reference Preview          │  │
│  │ ┌──────────────────┐ │  │ ┌──────────────────────┐  │  │
│  │ │ textarea...      │ │  │ │                      │  │  │
│  │ └──────────────────┘ │  │ │   Character Sheet    │  │  │
│  │ [Auto-Extract]       │  │ │   Image Preview      │  │  │
│  │                      │  │ │                      │  │  │
│  │ Generation Mode:     │  │ └──────────────────────┘  │  │
│  │ [Sheet] [Individual] │  │                            │  │
│  │                      │  │ [Front] [Side] [Back] [3/4]│  │
│  │ [Generate Anchor]    │  │                            │  │
│  └──────────────────────┘  │ └────────────────────────────┘  │
│                                                             │
│                              [Step 2: Generate Image →]     │
└─────────────────────────────────────────────────────────────┘
```

## State Management

### Local State (CharacterAnchorStep)

```typescript
const [description, setDescription] = useState("");
const [isGenerating, setIsGenerating] = useState(false);
const [generationMode, setGenerationMode] = useState<"sheet" | "individual">("sheet");
const [error, setError] = useState<string | null>(null);
const [previewAngle, setPreviewAngle] = useState("front");
```

### Global State (App.tsx)

```typescript
// Added to WorkflowState
characterAnchor: CharacterAnchor | null;

// New handler
const handleSetCharacterAnchor = (anchor: CharacterAnchor | null) => {
  setState(prev => ({ ...prev, characterAnchor: anchor }));
};
```

## Error Handling

1. **API Failures:** Toast notifications + inline error display
2. **Empty Description:** Validation before API call
3. **Image Load Failures:** Graceful fallback, retry option
4. **Rate Limiting:** Automatic retry with exponential backoff (existing pattern)

## Testing Strategy

1. **Unit Tests:**
   - `generateCharacterSheetApi` returns valid URL
   - `generateCharacterViewApi` with each view angle
   - Character description validation

2. **Integration Tests:**
   - Full workflow: Prompt → Character → Image → Video
   - Character anchor propagation to ImageGenerateStep
   - Toggle character anchor on/off

3. **E2E Tests:**
   - Generate character sheet
   - Generate image using anchor
   - Verify consistency visually

## Performance Considerations

- **Single Sheet Mode:** 1 API call (~3-8 seconds)
- **Individual Views Mode:** 4 API calls (~12-32 seconds)
- **Caching:** Character sheet URL cached until user regenerates
- **Lazy Loading:** Character anchor only loaded when step is active

## Future Enhancements

1. **Character Library:** Save/load character anchors for reuse across projects
2. **LoRA Training:** Use character sheet to train custom LoRA for perfect consistency
3. **Multi-Character:** Support multiple character anchors for ensemble scenes
4. **Video Consistency:** Use character anchor in video generation (if API supports)
5. **Style Transfer:** Apply different art styles to the same character

## Files Modified

| File | Change |
|------|--------|
| `src/types.ts` | Added `CharacterAnchor` interface, updated `WorkflowState` and `AppStep` |
| `src/utils/api.ts` | Added `generateCharacterSheetApi` and `generateCharacterViewApi` |
| `src/components/CharacterAnchorStep.tsx` | New component (created) |
| `src/App.tsx` | Add character step to workflow, pass props |
| `src/components/ImageGenerateStep.tsx` | Accept characterAnchor prop, use as img2img reference |
| `src/components/PromptOptimizeStep.tsx` | Accept characterAnchor prop, inject description |

## Implementation Status

- [x] Type definitions
- [x] API functions
- [x] CharacterAnchorStep component
- [ ] App.tsx integration
- [ ] ImageGenerateStep updates
- [ ] PromptOptimizeStep updates
