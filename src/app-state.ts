import type { FaceAnalysis } from "./face";
import { SPECS, type PhotoSpec } from "./specs";
import type { UserTransform } from "./render";

export type AppState = {
  sourceFile: File | null;
  sourceImage: HTMLImageElement | null;
  foregroundImage: HTMLImageElement | null;
  face: FaceAnalysis | null;
  spec: PhotoSpec;
  bgColor: string;
  useBgRemoval: boolean;
  autoFit: boolean;
  showGuides: boolean;
  showOriginalOnMobile: boolean;
  transform: UserTransform;
};

export function createInitialState(): AppState {
  return {
    sourceFile: null,
    sourceImage: null,
    foregroundImage: null,
    face: null,
    spec: SPECS[0],
    bgColor: SPECS[0].background,
    useBgRemoval: true,
    autoFit: true,
    showGuides: true,
    showOriginalOnMobile: false,
    transform: createDefaultTransform()
  };
}

export function createDefaultTransform(): UserTransform {
  return { zoom: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 };
}
