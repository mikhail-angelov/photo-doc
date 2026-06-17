import type { FaceAnalysis } from "./face";
import type { PhotoSpec } from "./specs";

export type Check = {
  level: "ok" | "warn" | "fail";
  text: string;
};

export function validatePhoto(face: FaceAnalysis | null, source: HTMLImageElement | null, spec: PhotoSpec): Check[] {
  const checks: Check[] = [];

  if (!source) {
    return [{ level: "warn", text: "Upload a source photo." }];
  }

  checks.push({
    level: source.naturalWidth >= spec.widthPx && source.naturalHeight >= spec.heightPx ? "ok" : "warn",
    text: `Source: ${source.naturalWidth}×${source.naturalHeight}px. Target: ${spec.widthPx}×${spec.heightPx}px.`
  });

  if (!face) {
    checks.push({ level: "fail", text: "Face not found. Upload a photo with one front-facing face." });
    return checks;
  }

  const faceRatio = face.faceHeightPx / source.naturalHeight;
  checks.push({
    level: faceRatio >= 0.18 ? "ok" : "warn",
    text: `Estimated face size in the source: ${(faceRatio * 100).toFixed(1)}% of frame height.`
  });

  checks.push({
    level: Math.abs(face.eyeAngleDeg) <= 8 ? "ok" : "warn",
    text: `Eye-line tilt: ${face.eyeAngleDeg.toFixed(1)}°. Auto-rotation corrects the frame, but a large tilt is better retaken.`
  });

  if (face.warnings.length) {
    for (const warning of face.warnings) checks.push({ level: "warn", text: warning });
  } else {
    checks.push({ level: "ok", text: "No basic face issues detected." });
  }

  checks.push({ level: "warn", text: spec.notes });
  checks.push({ level: "warn", text: "This is not a certified biometric check. Verify the authority's requirements before official submission." });

  return checks;
}
