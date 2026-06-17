import { removeBackground } from "@imgly/background-removal";
import { formatProgressDetail, type ProgressCallback } from "./progress";

export async function removePhotoBackground(file: File, onProgress?: ProgressCallback): Promise<HTMLImageElement> {
  const blob = await removeBackground(file, {
    // Keep output in the same pixel coordinate space as the original image.
    // This is important because face landmarks are measured on the original.
    rescale: true,
    device: "cpu",
    model: "isnet_fp16",
    output: { format: "image/png", quality: 0.95 },
    progress: (key, current, total) => {
      onProgress?.({
        label: describeBackgroundProgress(key),
        detail: formatProgressDetail(current, total),
        current,
        total,
        percent: total > 0 ? Math.round((current / total) * 100) : undefined
      });
    }
  });
  const cleaned = await tightenMaskEdges(blob);
  return blobToImage(cleaned);
}

export async function fileToImage(file: File): Promise<HTMLImageElement> {
  return blobToImage(file);
}

export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load the image."));
    };
    img.src = url;
  });
}

function describeBackgroundProgress(key: string) {
  if (key.startsWith("fetch:")) return "Loading background removal model";
  if (key === "compute:decode") return "Decoding image";
  if (key === "compute:inference") return "Removing background: inference";
  if (key === "compute:mask") return "Building alpha mask";
  if (key === "compute:encode") return "Encoding transparent PNG";
  return key;
}

async function tightenMaskEdges(blob: Blob): Promise<Blob> {
  const image = await blobToImage(blob);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return blob;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = frame.data;
  const width = frame.width;
  const height = frame.height;
  const originalAlpha = new Uint8ClampedArray(width * height);

  for (let i = 0; i < originalAlpha.length; i += 1) {
    originalAlpha[i] = data[i * 4 + 3];
  }

  const low = 24;
  const high = 220;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const alpha = originalAlpha[idx];
      let nextAlpha = alpha;

      if (alpha <= low) {
        nextAlpha = 0;
      } else if (alpha >= high) {
        nextAlpha = 255;
      } else {
        let opaqueNeighbors = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const neighbor = originalAlpha[(y + dy) * width + (x + dx)];
            if (neighbor >= high) opaqueNeighbors += 1;
          }
        }
        nextAlpha = opaqueNeighbors >= 5 ? 255 : 0;
      }

      data[idx * 4 + 3] = nextAlpha;
    }
  }

  ctx.putImageData(frame, 0, 0);
  return await canvasToBlob(canvas);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not save the background removal result."));
        return;
      }
      resolve(blob);
    }, "image/png", 1);
  });
}
