import type { PhotoSpec } from "./specs";
import type { FaceAnalysis } from "./face";

export type UserTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
};

export type RenderInput = {
  sourceImage: HTMLImageElement;
  foregroundImage: HTMLImageElement;
  face: FaceAnalysis | null;
  spec: PhotoSpec;
  background: string;
  transform: UserTransform;
  autoFit: boolean;
  showGuides: boolean;
};

export function drawSourcePreview(canvas: HTMLCanvasElement, image: HTMLImageElement, face: FaceAnalysis | null) {
  const ctx = mustCtx(canvas);
  const maxW = 1000;
  const scale = Math.min(1, maxW / image.naturalWidth);
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  if (face) {
    ctx.save();
    ctx.scale(scale, scale);
    ctx.lineWidth = 4 / scale;
    ctx.strokeStyle = "rgba(24, 94, 171, 0.9)";
    ctx.strokeRect(face.faceBox.x, face.faceBox.y, face.faceBox.width, face.faceBox.height);

    ctx.fillStyle = "rgba(230, 75, 50, 0.9)";
    circle(ctx, face.eyeCenter.x, face.eyeCenter.y, 7 / scale);
    ctx.restore();
  }
}

export function renderOutput(canvas: HTMLCanvasElement, input: RenderInput) {
  const { foregroundImage, face, spec, background, transform, autoFit, showGuides } = input;
  canvas.width = spec.widthPx;
  canvas.height = spec.heightPx;

  const ctx = mustCtx(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const base = computeBaseTransform(foregroundImage, face, spec, autoFit);

  const targetX = base.targetX + transform.offsetX;
  const targetY = base.targetY + transform.offsetY;
  const scale = base.scale * transform.zoom;
  const rotation = ((base.rotationDeg + transform.rotationDeg) * Math.PI) / 180;

  ctx.save();
  ctx.translate(targetX, targetY);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.drawImage(foregroundImage, -base.anchorX, -base.anchorY);
  ctx.restore();

  if (showGuides) {
    drawGuides(ctx, spec, face);
  }
}

function computeBaseTransform(
  image: HTMLImageElement,
  face: FaceAnalysis | null,
  spec: PhotoSpec,
  autoFit: boolean
) {
  if (!face || !autoFit) {
    return {
      anchorX: image.naturalWidth / 2,
      anchorY: image.naturalHeight / 2,
      targetX: spec.widthPx / 2,
      targetY: spec.heightPx / 2,
      scale: Math.min(spec.widthPx / image.naturalWidth, spec.heightPx / image.naturalHeight),
      rotationDeg: 0
    };
  }

  const targetHeadPx = spec.heightPx * spec.targetHeadRatio;
  const headScale = targetHeadPx / face.faceHeightPx;
  const topDistance = Math.max(1, face.eyeCenter.y - face.faceBox.y);
  const bottomDistance = Math.max(1, face.faceBox.y + face.faceHeightPx - face.eyeCenter.y);
  const fitTopScale = (spec.heightPx * spec.targetEyeLineRatio) / topDistance;
  const fitBottomScale = (spec.heightPx * (1 - spec.targetEyeLineRatio)) / bottomDistance;
  const scale = Math.min(headScale, fitTopScale, fitBottomScale);

  return {
    anchorX: face.eyeCenter.x,
    anchorY: face.eyeCenter.y,
    targetX: spec.widthPx / 2,
    targetY: spec.heightPx * spec.targetEyeLineRatio,
    scale,
    rotationDeg: -face.eyeAngleDeg
  };
}

function drawGuides(ctx: CanvasRenderingContext2D, spec: PhotoSpec, face: FaceAnalysis | null) {
  ctx.save();
  ctx.strokeStyle = "rgba(21, 61, 105, 0.36)";
  ctx.lineWidth = Math.max(2, spec.widthPx / 320);
  ctx.setLineDash([12, 8]);

  ctx.beginPath();
  ctx.moveTo(spec.widthPx / 2, 0);
  ctx.lineTo(spec.widthPx / 2, spec.heightPx);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, spec.heightPx * spec.targetEyeLineRatio);
  ctx.lineTo(spec.widthPx, spec.heightPx * spec.targetEyeLineRatio);
  ctx.stroke();

  const headH = spec.heightPx * spec.targetHeadRatio;
  const headW = headH * 0.72;
  const cx = spec.widthPx / 2;
  const cy = spec.heightPx * spec.targetEyeLineRatio + headH * 0.16;
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(21, 61, 105, 0.52)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, headW / 2, headH / 2, 0, 0, Math.PI * 2);
  ctx.stroke();

  if (!face) {
    ctx.fillStyle = "rgba(21, 61, 105, 0.8)";
    ctx.font = `${Math.max(14, spec.widthPx / 36)}px system-ui`;
    ctx.fillText("Face not found", 20, 32);
  }
  ctx.restore();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function mustCtx(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is not supported by this browser.");
  return ctx;
}
