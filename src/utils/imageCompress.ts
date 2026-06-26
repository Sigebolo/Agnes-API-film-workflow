/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Compress an image URL to reduce file size before uploading
 * @param imageUrl - The source image URL
 * @param maxWidth - Maximum width in pixels (default 1024)
 * @param quality - JPEG quality 0-1 (default 0.8)
 * @returns Promise<string> - Base64 data URL of compressed image
 */
export async function compressImage(
  imageUrl: string,
  maxWidth: number = 2048,
  quality: number = 0.95
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to compressed JPEG
      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      reject(new Error("CORS or network error loading image"));
    };

    img.src = imageUrl;
  });
}

/**
 * Get compressed image size info
 * @param dataUrl - Base64 data URL
 * @returns Object with size info
 */
export function getImageSizeInfo(dataUrl: string): { sizeKB: number; sizeMB: string } {
  const base64 = dataUrl.split(",")[1] || "";
  const sizeBytes = Math.ceil((base64.length * 3) / 4);
  const sizeKB = Math.round(sizeBytes / 1024);
  const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
  return { sizeKB, sizeMB };
}
