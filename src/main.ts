import "./styles.css";
import { SPECS } from "./specs";
import { analyzeFace } from "./face";
import { fileToImage, removePhotoBackground } from "./background";
import {
  APP_TEMPLATE,
  PhotoDocIntroElement,
  PhotoDocStageElement,
  PhotoDocToolbarElement,
  definePhotoDocComponents,
  type PhotoDocWarning
} from "./components";
import { drawSourcePreview, renderOutput } from "./render";
import { validatePhoto } from "./validate";
import type { ProgressCallback, ProgressEvent } from "./progress";
import { UI_EVENTS } from "./ui-events";
import { createDefaultTransform, createInitialState } from "./app-state";
import { bindCanvasInteractions } from "./interactions";

type AppElements = {
  appShell: HTMLElement;
  intro: PhotoDocIntroElement;
  toolbar: PhotoDocToolbarElement;
  stage: PhotoDocStageElement;
};

let els: AppElements;

definePhotoDocComponents();

class PhotoDocApp extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready === "true") return;
    this.innerHTML = APP_TEMPLATE;
    this.dataset.ready = "true";
    init(this);
  }
}

function getElements(root: ParentNode): AppElements {
  return {
    appShell: byId<HTMLElement>(root, "appShell"),
    intro: root.querySelector<PhotoDocIntroElement>("photo-doc-intro") ?? missing("photo-doc-intro"),
    toolbar: root.querySelector<PhotoDocToolbarElement>("photo-doc-toolbar") ?? missing("photo-doc-toolbar"),
    stage: root.querySelector<PhotoDocStageElement>("photo-doc-stage") ?? missing("photo-doc-stage")
  };
}

const state = createInitialState();

let hideProgressTimer: number | null = null;
let isProcessing = false;
const processingWarnings: Array<{ level: "warn" | "fail"; text: string }> = [];

if (!customElements.get("photo-doc-app")) {
  customElements.define("photo-doc-app", PhotoDocApp);
}

function init(root: ParentNode) {
  els = getElements(root);
  els.toolbar.setSpecs(SPECS);
  bindEvents();
  syncControls();
  redraw();
}

function bindEvents() {
  els.intro.addEventListener(UI_EVENTS.fileSelected, async (event) => {
    await loadFile(detail<{ file: File }>(event).file);
  });

  els.toolbar.addEventListener(UI_EVENTS.specChange, (event) => {
    state.spec = SPECS.find((s) => s.id === detail<{ specId: string }>(event).specId) ?? SPECS[0];
    if (!state.sourceImage) {
      state.bgColor = state.spec.background;
    }
    redraw();
  });

  els.toolbar.addEventListener(UI_EVENTS.backgroundChange, (event) => {
    state.bgColor = detail<{ color: string }>(event).color;
    redraw();
  });

  els.toolbar.addEventListener(UI_EVENTS.bgRemovalChange, async (event) => {
    state.useBgRemoval = detail<{ enabled: boolean }>(event).enabled;
    if (state.sourceFile) {
      await prepareForeground(0, 100);
      finishProgress("Background updated");
    }
    redraw();
  });

  els.toolbar.addEventListener(UI_EVENTS.autoFitChange, (event) => {
    state.autoFit = detail<{ enabled: boolean }>(event).enabled;
    redraw();
  });

  els.toolbar.addEventListener(UI_EVENTS.guidesChange, (event) => {
    state.showGuides = detail<{ enabled: boolean }>(event).enabled;
    redraw();
  });

  els.toolbar.addEventListener(UI_EVENTS.toggleOriginal, toggleOriginalOnMobile);
  els.stage.addEventListener(UI_EVENTS.toggleOriginal, toggleOriginalOnMobile);
  els.toolbar.addEventListener(UI_EVENTS.reuploadRequest, () => els.intro.openFilePicker());
  els.toolbar.addEventListener(UI_EVENTS.downloadRequest, downloadCanvas);
  els.toolbar.addEventListener(UI_EVENTS.statusClick, () => {
    els.toolbar.toggleWarnings();
  });

  bindCanvasInteractions(els.stage.outputCanvas, state, redraw);
}

async function loadFile(file: File) {
  clearProcessingWarnings();
  showProgress("Loading image", "Decoding the local file...", 0);
  setBusy("Loading image...");
  setProcessing(true);

  try {
    state.sourceFile = file;
    state.sourceImage = await fileToImage(file);
    state.face = null;
    state.foregroundImage = null;
    state.showOriginalOnMobile = false;
    resetManualTransform();
    redraw();

    updateProgress({ label: "Image loaded", detail: "Starting face analysis...", percent: 8 });

    await analyzeCurrentPhoto(8, state.useBgRemoval ? 44 : 88);
    await prepareForeground(state.useBgRemoval ? 52 : 96, state.useBgRemoval ? 44 : 2);

    finishProgress("Done");
  } finally {
    setProcessing(false);
    redraw();
  }
}

async function analyzeCurrentPhoto(progressBase = 0, progressSpan = 100) {
  if (!state.sourceImage) return;
  showProgress("Analyzing face", "The first run may download MediaPipe WASM and models.", progressBase);
  setBusy("Loading MediaPipe and looking for a face... The first run may take a while.");

  try {
    state.face = await analyzeFace(state.sourceImage, scaleProgress(progressBase, progressSpan));
  } catch (error) {
    console.error(error);
    state.face = null;
    pushProcessingWarning("fail", "Could not detect a face. Check the source photo.");
    setBusy("Face detection failed. Check the source photo.");
    updateProgress({
      label: "Face detection error",
      detail: error instanceof Error ? error.message : "Details are available in the browser console.",
      percent: progressBase + progressSpan
    });
  }
}

async function prepareForeground(progressBase = 0, progressSpan = 100) {
  if (!state.sourceFile || !state.sourceImage) return;
  if (!state.useBgRemoval) {
    state.foregroundImage = state.sourceImage;
    updateProgress({
      label: "Background removal is off",
      detail: "Using the original image.",
      percent: progressBase + progressSpan
    });
    return;
  }

  showProgress("Removing background", "The first run downloads the browser-only model.", progressBase);
  setBusy("Removing the background in the browser... The first run downloads the model.");

  try {
    state.foregroundImage = await removePhotoBackground(state.sourceFile, scaleProgress(progressBase, progressSpan));
  } catch (error) {
    console.error(error);
    state.foregroundImage = state.sourceImage;
    pushProcessingWarning("warn", "Background removal failed, so the original image was used.");
    setBusy("Could not remove the background, using the original image.");
    updateProgress({
      label: "Background removal error",
      detail: error instanceof Error ? error.message : "Details are available in the browser console.",
      percent: progressBase + progressSpan
    });
  }
}

function redraw() {
  syncControls();
  els.appShell.classList.toggle("has-image", Boolean(state.sourceImage));
  const sourceCanvas = els.stage.sourceCanvas;
  const outputCanvas = els.stage.outputCanvas;

  if (state.sourceImage) {
    drawSourcePreview(sourceCanvas, state.sourceImage, state.face);
    sourceCanvas.style.aspectRatio = `${sourceCanvas.width} / ${sourceCanvas.height}`;
    els.stage.setSourceMeta(`${state.sourceImage.naturalWidth}×${state.sourceImage.naturalHeight}px`);
  } else {
    emptyCanvas(sourceCanvas, "Upload a photo");
    sourceCanvas.style.aspectRatio = `${sourceCanvas.width} / ${sourceCanvas.height}`;
    els.stage.setSourceMeta("no photo");
  }

  if (state.foregroundImage) {
    renderOutput(outputCanvas, {
      sourceImage: state.sourceImage ?? state.foregroundImage,
      foregroundImage: state.foregroundImage,
      face: state.face,
      spec: state.spec,
      background: state.bgColor,
      transform: state.transform,
      autoFit: state.autoFit,
      showGuides: state.showGuides
    });
    outputCanvas.style.aspectRatio = `${outputCanvas.width} / ${outputCanvas.height}`;
    els.stage.setOutputMeta(`${state.spec.widthPx}×${state.spec.heightPx}px`);
  } else {
    outputCanvas.width = state.spec.widthPx;
    outputCanvas.height = state.spec.heightPx;
    emptyCanvas(outputCanvas, "The result will appear here");
    outputCanvas.style.aspectRatio = `${outputCanvas.width} / ${outputCanvas.height}`;
    els.stage.setOutputMeta(`${state.spec.widthPx}×${state.spec.heightPx}px`);
  }

  renderWarnings();
}

function renderWarnings() {
  const checks = validatePhoto(state.face, state.sourceImage, state.spec)
    .filter((check) => check.level !== "ok")
    .slice(0, 3);

  const combined = [...processingWarnings, ...checks].slice(0, 3);
  const hasFail = combined.some((check) => check.level === "fail");
  const hasWarn = combined.some((check) => check.level === "warn");

  if (!state.sourceImage) {
    setStatus("Upload a photo.", "neutral");
  } else if (hasFail) {
    setStatus(`Critical issues found: ${combined.length}.`, "fail");
  } else if (hasWarn) {
    setStatus(`Result is ready, with ${combined.length} warning(s).`, "warn");
  } else {
    setStatus("Basic checks passed.", "ok");
  }

  els.toolbar.setWarnings(combined as PhotoDocWarning[]);
}

function downloadCanvas() {
  if (!state.foregroundImage) return;
  const exportCanvas = document.createElement("canvas");
  renderOutput(exportCanvas, {
    sourceImage: state.sourceImage ?? state.foregroundImage,
    foregroundImage: state.foregroundImage,
    face: state.face,
    spec: state.spec,
    background: state.bgColor,
    transform: state.transform,
    autoFit: state.autoFit,
    showGuides: false
  });

  const name = `doc-photo-${state.spec.id}-${Date.now()}.png`;
  const a = document.createElement("a");
  a.download = name;
  a.href = exportCanvas.toDataURL("image/png");
  a.click();
}

function syncControls() {
  els.intro.setProcessing(isProcessing);
  els.toolbar.setState({
    specId: state.spec.id,
    background: state.bgColor,
    useBgRemoval: state.useBgRemoval,
    autoFit: state.autoFit,
    showGuides: state.showGuides,
    showOriginalOnMobile: state.showOriginalOnMobile,
    processing: isProcessing,
    canDownload: Boolean(state.foregroundImage)
  });
  els.stage.setShowOriginalMobile(state.showOriginalOnMobile);
  els.stage.setProcessing(isProcessing);
}

function toggleOriginalOnMobile() {
  state.showOriginalOnMobile = !state.showOriginalOnMobile;
  syncControls();
}

function resetManualTransform() {
  state.transform = createDefaultTransform();
}

function emptyCanvas(canvas: HTMLCanvasElement, label: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f7fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#6f8398";
  ctx.font = `${Math.max(16, canvas.width / 36)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);
}

function setBusy(text: string) {
  setStatus(text, "neutral");
}

function setProcessing(processing: boolean) {
  isProcessing = processing;
  syncControls();
}

function showProgress(label: string, detail = "", percent?: number) {
  if (hideProgressTimer !== null) {
    window.clearTimeout(hideProgressTimer);
    hideProgressTimer = null;
  }
  els.stage.setProgressVisible(true);
  updateProgress({ label, detail, percent });
}

function updateProgress(event: ProgressEvent) {
  if (hideProgressTimer !== null) {
    window.clearTimeout(hideProgressTimer);
    hideProgressTimer = null;
  }

  els.stage.setProgressVisible(true);
  if (typeof event.percent === "number" && Number.isFinite(event.percent)) {
    els.stage.setProgressPercent(event.percent);
  } else {
    els.stage.setProgressPercent(null);
  }

  setBusy(`${event.label}${event.detail ? ` — ${event.detail}` : ""}`);
}

function finishProgress(label: string) {
  updateProgress({ label, detail: "You can review the result.", percent: 100 });
  hideProgressTimer = window.setTimeout(() => {
    els.stage.setProgressVisible(false);
  }, 1400);
}

function scaleProgress(base: number, span: number): ProgressCallback {
  return (event) => {
    updateProgress({
      ...event,
      percent: typeof event.percent === "number" ? base + (event.percent / 100) * span : undefined
    });
  };
}

function clearProcessingWarnings() {
  processingWarnings.length = 0;
}

function pushProcessingWarning(level: "warn" | "fail", text: string) {
  if (!processingWarnings.some((warning) => warning.text === text)) {
    processingWarnings.unshift({ level, text });
  }
}

function setStatus(text: string, level: "neutral" | "ok" | "warn" | "fail") {
  els.toolbar.setStatus(text, level);
}

function byId<T extends HTMLElement>(root: ParentNode, id: string): T {
  const el = root.querySelector(`#${id}`);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

function missing(selector: string): never {
  throw new Error(`Element ${selector} not found`);
}

function detail<T>(event: Event): T {
  return (event as CustomEvent<T>).detail;
}
