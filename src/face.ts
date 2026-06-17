import {
  FaceDetector,
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark
} from "@mediapipe/tasks-vision";
import { fetchUint8WithProgress, type ProgressCallback } from "./progress";

export type FaceAnalysis = {
  landmarks: NormalizedLandmark[];
  faceBox: { x: number; y: number; width: number; height: number };
  faceCenter: { x: number; y: number };
  eyeCenter: { x: number; y: number };
  eyeAngleDeg: number;
  faceHeightPx: number;
  source: "landmarker" | "detector";
  warnings: string[];
};

type ImageLike = HTMLImageElement | HTMLCanvasElement;

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
const DETECTOR_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

let visionPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;
let faceDetectorPromise: Promise<FaceDetector> | null = null;

async function getVisionFileset(onProgress?: ProgressCallback) {
  if (!visionPromise) {
    onProgress?.({
      label: "Initializing MediaPipe WASM",
      detail: "The browser is loading the runtime from the CDN. Byte progress is not available for this step.",
      percent: 5
    });
    visionPromise = FilesetResolver.forVisionTasks(WASM_URL);
  } else {
    onProgress?.({ label: "MediaPipe WASM is already initialized", percent: 100 });
  }

  const vision = await visionPromise;
  onProgress?.({ label: "MediaPipe WASM ready", percent: 100 });
  return vision;
}

export async function getFaceLandmarker(onProgress?: ProgressCallback): Promise<FaceLandmarker> {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      const vision = await getVisionFileset(onProgress);
      const modelAssetBuffer = await fetchUint8WithProgress(
        LANDMARKER_MODEL_URL,
        "Loading Face Landmarker model",
        onProgress
      );

      onProgress?.({
        label: "Creating Face Landmarker",
        detail: "Preparing the landmark detection model.",
        percent: 95
      });

      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetBuffer,
          // CPU is slower, but much more predictable across Safari/Firefox/Chrome
          // for a local prototype. GPU delegate can silently miss on some setups.
          delegate: "CPU"
        },
        runningMode: "IMAGE",
        numFaces: 1,
        minFaceDetectionConfidence: 0.25,
        minFacePresenceConfidence: 0.25,
        minTrackingConfidence: 0.25,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false
      });

      onProgress?.({ label: "Face Landmarker ready", percent: 100 });
      return landmarker;
    })();
  } else {
    onProgress?.({ label: "Face Landmarker is already loaded", percent: 100 });
  }
  return faceLandmarkerPromise;
}

async function getFaceDetector(onProgress?: ProgressCallback): Promise<FaceDetector> {
  if (!faceDetectorPromise) {
    faceDetectorPromise = (async () => {
      const vision = await getVisionFileset(onProgress);
      const modelAssetBuffer = await fetchUint8WithProgress(
        DETECTOR_MODEL_URL,
        "Loading fallback Face Detector",
        onProgress
      );

      onProgress?.({
        label: "Creating fallback Face Detector",
        detail: "It is used when face mesh cannot find a face.",
        percent: 95
      });

      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetBuffer,
          delegate: "CPU"
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.2,
        minSuppressionThreshold: 0.3
      });

      onProgress?.({ label: "Fallback Face Detector ready", percent: 100 });
      return detector;
    })();
  } else {
    onProgress?.({ label: "Fallback Face Detector is already loaded", percent: 100 });
  }
  return faceDetectorPromise;
}

export async function analyzeFace(image: ImageLike, onProgress?: ProgressCallback): Promise<FaceAnalysis | null> {
  onProgress?.({ label: "Preparing image for face detection", percent: 2 });
  const prepared = prepareForDetection(image);

  onProgress?.({ label: "Looking for a face with Face Landmarker", detail: "Primary landmark model.", percent: 8 });
  const fromLandmarks = await tryAnalyzeWithLandmarker(prepared.canvas, prepared.scaleX, prepared.scaleY, onProgress);
  if (fromLandmarks) {
    onProgress?.({ label: "Face found with Face Landmarker", percent: 100 });
    return fromLandmarks;
  }

  onProgress?.({ label: "Face Landmarker did not find a face", detail: "Trying the fallback detector.", percent: 50 });
  const fromDetector = await tryAnalyzeWithFaceDetector(prepared.canvas, prepared.scaleX, prepared.scaleY, onProgress);
  if (fromDetector) {
    onProgress?.({ label: "Face found with fallback detector", percent: 100 });
    return fromDetector;
  }

  // Last try on the original image. This helps in rare cases where browser canvas
  // decoding/downscaling behaves differently from passing the image element itself.
  onProgress?.({ label: "Repeating analysis on the original image", percent: 70 });
  const originalFromLandmarks = await tryAnalyzeWithLandmarker(image, 1, 1, onProgress);
  if (originalFromLandmarks) {
    onProgress?.({ label: "Face found on the original image", percent: 100 });
    return originalFromLandmarks;
  }

  const originalFromDetector = await tryAnalyzeWithFaceDetector(image, 1, 1, onProgress);
  onProgress?.({
    label: originalFromDetector ? "Face found with fallback detector" : "Face not found",
    percent: 100
  });
  return originalFromDetector;
}

async function tryAnalyzeWithLandmarker(
  image: ImageLike,
  scaleX: number,
  scaleY: number,
  onProgress?: ProgressCallback
): Promise<FaceAnalysis | null> {
  try {
    const landmarker = await getFaceLandmarker(onProgress);
    onProgress?.({ label: "Running Face Landmarker", percent: 85 });
    const result = landmarker.detect(image);

    if (!result.faceLandmarks?.length) return null;

    const landmarks = result.faceLandmarks[0];
    return analysisFromLandmarks(landmarks, getImageWidth(image), getImageHeight(image), scaleX, scaleY);
  } catch (error) {
    console.warn("Face Landmarker failed, trying Face Detector fallback", error);
    return null;
  }
}

async function tryAnalyzeWithFaceDetector(
  image: ImageLike,
  scaleX: number,
  scaleY: number,
  onProgress?: ProgressCallback
): Promise<FaceAnalysis | null> {
  try {
    const detector = await getFaceDetector(onProgress);
    onProgress?.({ label: "Running fallback Face Detector", percent: 85 });
    const result = detector.detect(image);
    const detection = result.detections?.[0];
    const box = detection?.boundingBox;
    if (!box) return null;

    const width = getImageWidth(image);
    const height = getImageHeight(image);

    // FaceDetector box usually covers the face, not hair and full head.
    // Add margins so the auto-crop targets a document-photo head area.
    const rawX = box.originX / scaleX;
    const rawY = box.originY / scaleY;
    const rawW = box.width / scaleX;
    const rawH = box.height / scaleY;
    const fullWidth = width / scaleX;
    const fullHeight = height / scaleY;

    const estimatedHeadTop = Math.max(0, rawY - rawH * 0.28);
    const estimatedHeadBottom = Math.min(fullHeight, rawY + rawH * 1.08);
    const estimatedHeadHeight = estimatedHeadBottom - estimatedHeadTop;
    const centerX = rawX + rawW / 2;

    const keypoints = detection.keypoints ?? [];
    const leftEye = keypoints.find((p) => p.label?.toLowerCase().includes("left")) ?? keypoints[0];
    const rightEye = keypoints.find((p) => p.label?.toLowerCase().includes("right")) ?? keypoints[1];

    let eyeCenter = {
      x: centerX,
      y: rawY + rawH * 0.42
    };
    let eyeAngleDeg = 0;

    if (leftEye && rightEye) {
      const le = { x: (leftEye.x * width) / scaleX, y: (leftEye.y * height) / scaleY };
      const re = { x: (rightEye.x * width) / scaleX, y: (rightEye.y * height) / scaleY };
      eyeCenter = { x: (le.x + re.x) / 2, y: (le.y + re.y) / 2 };
      eyeAngleDeg = (Math.atan2(re.y - le.y, re.x - le.x) * 180) / Math.PI;
      if (Math.abs(eyeAngleDeg) > 45) eyeAngleDeg = 0;
    }

    const warnings = commonWarnings({
      eyeAngleDeg,
      estimatedHeadHeight,
      minX: rawX,
      maxX: rawX + rawW,
      width: fullWidth,
      height: fullHeight
    });
    warnings.push("The face was found by the fallback detector without precise face mesh landmarks. Check the crop visually.");

    return {
      landmarks: [],
      faceBox: { x: rawX, y: estimatedHeadTop, width: rawW, height: estimatedHeadHeight },
      faceCenter: { x: centerX, y: estimatedHeadTop + estimatedHeadHeight / 2 },
      eyeCenter,
      eyeAngleDeg,
      faceHeightPx: estimatedHeadHeight,
      source: "detector",
      warnings
    };
  } catch (error) {
    console.warn("Face Detector fallback failed", error);
    return null;
  }
}

function analysisFromLandmarks(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  scaleX: number,
  scaleY: number
): FaceAnalysis {
  const originalWidth = width / scaleX;
  const originalHeight = height / scaleY;
  const xs = landmarks.map((p) => (p.x * width) / scaleX);
  const ys = landmarks.map((p) => (p.y * height) / scaleY);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // MediaPipe face mesh estimates facial surface, not hair. We add a top margin
  // so document crop is closer to "head" than only "face".
  const meshHeight = maxY - minY;
  const estimatedHeadTop = Math.max(0, minY - meshHeight * 0.34);
  const estimatedHeadBottom = Math.min(originalHeight, maxY + meshHeight * 0.12);
  const estimatedHeadHeight = estimatedHeadBottom - estimatedHeadTop;

  // Stable eye landmarks: 33 and 263 are outer eye corners in MediaPipe Face Mesh.
  const leftEye = toPx(landmarks[33], width, height, scaleX, scaleY);
  const rightEye = toPx(landmarks[263], width, height, scaleX, scaleY);
  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2
  };
  const eyeAngleDeg = (Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180) / Math.PI;

  const faceCenter = {
    x: (minX + maxX) / 2,
    y: estimatedHeadTop + estimatedHeadHeight / 2
  };

  const warnings = commonWarnings({
    eyeAngleDeg,
    estimatedHeadHeight,
    minX,
    maxX,
    width: originalWidth,
    height: originalHeight
  });

  return {
    landmarks,
    faceBox: { x: minX, y: estimatedHeadTop, width: maxX - minX, height: estimatedHeadHeight },
    faceCenter,
    eyeCenter,
    eyeAngleDeg,
    faceHeightPx: estimatedHeadHeight,
    source: "landmarker",
    warnings
  };
}

function prepareForDetection(image: ImageLike) {
  const width = getImageWidth(image);
  const height = getImageHeight(image);
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is not supported by this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return {
    canvas,
    scaleX: canvas.width / width,
    scaleY: canvas.height / height
  };
}

function getImageWidth(image: ImageLike) {
  return image instanceof HTMLImageElement ? image.naturalWidth : image.width;
}

function getImageHeight(image: ImageLike) {
  return image instanceof HTMLImageElement ? image.naturalHeight : image.height;
}

function toPx(p: NormalizedLandmark, width: number, height: number, scaleX: number, scaleY: number) {
  return { x: (p.x * width) / scaleX, y: (p.y * height) / scaleY };
}

function commonWarnings(args: {
  eyeAngleDeg: number;
  estimatedHeadHeight: number;
  minX: number;
  maxX: number;
  width: number;
  height: number;
}) {
  const warnings: string[] = [];
  if (Math.abs(args.eyeAngleDeg) > 8) {
    warnings.push("The head or frame is strongly tilted. Retake the photo or rotate it carefully.");
  }
  if (args.estimatedHeadHeight < args.height * 0.18) {
    warnings.push("The face is too small in the source photo, so quality after cropping may be low.");
  }
  if (args.minX < args.width * 0.02 || args.maxX > args.width * 0.98) {
    warnings.push("The face is close to the edge of the source image, so the head or shoulders may be cropped.");
  }
  return warnings;
}
