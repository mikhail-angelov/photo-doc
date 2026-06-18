import type { PhotoSpec } from "./specs";
import { UI_EVENTS, type UiEventName } from "./ui-events";

type StatusLevel = "neutral" | "ok" | "warn" | "fail";
type WarningLevel = "warn" | "fail";

export type PhotoDocWarning = {
  level: WarningLevel;
  text: string;
};

export type ToolbarState = {
  specId: string;
  background: string;
  useBgRemoval: boolean;
  autoFit: boolean;
  showGuides: boolean;
  showOriginalOnMobile: boolean;
  processing: boolean;
  canDownload: boolean;
};

export const APP_TEMPLATE = `
  <main id="appShell" class="app-shell">
    <photo-doc-intro></photo-doc-intro>
    <section id="editorShell" class="editor-shell">
      <photo-doc-toolbar></photo-doc-toolbar>
      <photo-doc-stage></photo-doc-stage>
    </section>
    <footer class="app-footer">
      <a
        class="github-link"
        href="https://github.com/mikhail-angelov/photo-doc"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View source code on GitHub"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="currentColor"
            d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z"
          />
        </svg>
        <span>Source code</span>
      </a>
      <span>© 2026 Mikhail Angelov</span>
    </footer>
  </main>
`;

const INTRO_TEMPLATE = `
  <section class="intro-card">

    <div class="intro-hero">
      <div class="intro-copy">
        <p class="eyebrow">Private browser-only editor</p>
        <h1>Document photo  </h1>
        <p class="lead">
          Make passport and ID photos with automatic crop guides, background cleanup, and export-ready presets.
        </p>
      </div>

      <div class="hero-preview" aria-label="Before and after example">
        <figure class="preview-card before-card">
          <span>Before</span>
          <img src="./hero-before.jpg" alt="Original portrait before document photo processing" />
        </figure>
        <figure class="preview-card after-card">
          <span>After</span>
          <img src="./hero-after.png" alt="Processed document photo on a clean white background" />
          <strong>Verified</strong>
        </figure>
      </div>
    </div>

    <label class="upload-card">
      <input id="fileInput" type="file" accept="image/*" />
      <input id="cameraInput" type="file" accept="image/*" capture="user" />
      <span class="upload-title">Upload Photo</span>
      <span class="upload-hint">JPG, PNG, or HEIC. Your image stays on this device.</span>
      <button id="cameraBtn" type="button" class="camera-button mobile-only">Take Selfie</button>
    </label>
  </section>
`;

const TOOLBAR_TEMPLATE = `
  <div class="toolbar-card">
    <div class="toolbar-row">
      <label class="toolbar-field">
        <span>Format</span>
        <select id="specSelect"></select>
      </label>

      <fieldset class="swatch-group">
        <legend>Background</legend>
        <label class="swatch-option">
          <input id="bgWhite" type="radio" name="bgPreset" value="#ffffff" checked />
          <span class="swatch" style="--swatch:#ffffff"></span>
        </label>
        <label class="swatch-option">
          <input type="radio" name="bgPreset" value="#f0f6ff" />
          <span class="swatch" style="--swatch:#f0f6ff"></span>
        </label>
        <label class="swatch-option">
          <input type="radio" name="bgPreset" value="#dbe8ff" />
          <span class="swatch" style="--swatch:#dbe8ff"></span>
        </label>
      </fieldset>

      <label class="toolbar-toggle">
        <input id="useBgRemoval" type="checkbox" checked />
        <span>Remove background</span>
      </label>

      <label class="toolbar-toggle optional-toggle">
        <input id="autoFit" type="checkbox" checked />
        <span>Auto-fit</span>
      </label>

      <label class="toolbar-toggle optional-toggle">
        <input id="showGuides" type="checkbox" checked />
        <span>Guides</span>
      </label>

      <button id="toggleOriginalBtn" type="button" class="ghost-button mobile-only">Show original</button>
      <button id="reuploadBtn" type="button" class="ghost-button">Replace photo</button>
      <button id="downloadBtn" type="button">Download PNG</button>
    </div>

    <div class="status-row">
      <button id="statusButton" type="button" class="status-button">Upload a photo.</button>
      <span class="gesture-hint">Wheel = zoom · drag = pan · Shift + drag = rotate</span>
    </div>
    <div id="warningPills" class="warning-pills" hidden aria-live="polite"></div>
  </div>
`;

const STAGE_TEMPLATE = `
  <div class="stage-card">
    <div class="stage-grid">
      <section class="stage-pane original-pane">
        <div class="pane-head">
          <h2>Original</h2>
          <span id="sourceMeta" class="pill">no photo</span>
        </div>
        <canvas id="sourceCanvas" width="800" height="1000"></canvas>
      </section>

      <section class="stage-pane result-pane">
        <div class="pane-head">
          <h2>Result</h2>
          <span id="outputMeta" class="pill">—</span>
        </div>

        <div id="progressBar" class="stage-progress" hidden aria-hidden="true">
          <div id="progressFill"></div>
        </div>
        <canvas id="outputCanvas" width="413" height="531"></canvas>

        <div class="result-actions">
          <button id="resultOriginalBtn" type="button" class="ghost-button mobile-only">Original</button>
        </div>
      </section>
    </div>
  </div>
`;

export class PhotoDocIntroElement extends HTMLElement {
  private fileInput!: HTMLInputElement;
  private cameraInput!: HTMLInputElement;
  private cameraBtn!: HTMLButtonElement;

  connectedCallback() {
    if (this.dataset.ready === "true") return;
    this.innerHTML = INTRO_TEMPLATE;
    this.dataset.ready = "true";
    this.fileInput = byId<HTMLInputElement>(this, "fileInput");
    this.cameraInput = byId<HTMLInputElement>(this, "cameraInput");
    this.cameraBtn = byId<HTMLButtonElement>(this, "cameraBtn");
    this.fileInput.addEventListener("change", () => this.emitSelectedFile(this.fileInput));
    this.cameraInput.addEventListener("change", () => this.emitSelectedFile(this.cameraInput));
    this.cameraBtn.addEventListener("click", (event) => {
      event.preventDefault();
      this.cameraInput.click();
    });
  }

  openFilePicker() {
    this.fileInput.click();
  }

  setProcessing(processing: boolean) {
    this.fileInput.disabled = processing;
    this.cameraInput.disabled = processing;
    this.cameraBtn.disabled = processing;
  }

  private emitSelectedFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    this.dispatchEvent(new CustomEvent(UI_EVENTS.fileSelected, { bubbles: true, detail: { file } }));
  }
}

export class PhotoDocToolbarElement extends HTMLElement {
  private specSelect!: HTMLSelectElement;
  private bgPresetInputs!: HTMLInputElement[];
  private useBgRemoval!: HTMLInputElement;
  private autoFit!: HTMLInputElement;
  private showGuides!: HTMLInputElement;
  private toggleOriginalBtn!: HTMLButtonElement;
  private reuploadBtn!: HTMLButtonElement;
  private downloadBtn!: HTMLButtonElement;
  private statusButton!: HTMLButtonElement;
  private warningPills!: HTMLElement;
  private warningsVisible = false;

  connectedCallback() {
    if (this.dataset.ready === "true") return;
    this.innerHTML = TOOLBAR_TEMPLATE;
    this.dataset.ready = "true";
    this.collectElements();
    this.bindEvents();
  }

  setSpecs(specs: PhotoSpec[]) {
    this.specSelect.innerHTML = "";
    for (const spec of specs) {
      const opt = document.createElement("option");
      opt.value = spec.id;
      opt.textContent = spec.label;
      this.specSelect.appendChild(opt);
    }
  }

  setState(state: ToolbarState) {
    this.specSelect.value = state.specId;
    for (const input of this.bgPresetInputs) {
      input.checked = input.value.toLowerCase() === state.background.toLowerCase();
      input.disabled = state.processing;
    }

    this.useBgRemoval.checked = state.useBgRemoval;
    this.autoFit.checked = state.autoFit;
    this.showGuides.checked = state.showGuides;
    this.toggleOriginalBtn.textContent = state.showOriginalOnMobile ? "Show result" : "Show original";

    this.specSelect.disabled = state.processing;
    this.useBgRemoval.disabled = state.processing;
    this.autoFit.disabled = state.processing;
    this.showGuides.disabled = state.processing;
    this.toggleOriginalBtn.disabled = state.processing;
    this.reuploadBtn.disabled = state.processing;
    this.downloadBtn.disabled = state.processing || !state.canDownload;
  }

  setStatus(text: string, level: StatusLevel) {
    this.statusButton.textContent = text;
    this.statusButton.dataset.level = level;
  }

  setWarnings(warnings: PhotoDocWarning[]) {
    const previousText = this.warningPills.textContent ?? "";
    this.warningPills.innerHTML = "";
    for (const warning of warnings) {
      const pill = document.createElement("div");
      pill.className = `warning-pill ${warning.level}`;
      pill.textContent = warning.text;
      this.warningPills.appendChild(pill);
    }
    if (!warnings.length || this.warningPills.textContent !== previousText) {
      this.warningsVisible = false;
    }
    this.syncWarningsVisibility();
  }

  toggleWarnings() {
    if (!this.hasWarnings()) return;
    this.warningsVisible = !this.warningsVisible;
    this.syncWarningsVisibility();
  }

  private collectElements() {
    this.specSelect = byId<HTMLSelectElement>(this, "specSelect");
    this.bgPresetInputs = Array.from(this.querySelectorAll<HTMLInputElement>('input[name="bgPreset"]'));
    this.useBgRemoval = byId<HTMLInputElement>(this, "useBgRemoval");
    this.autoFit = byId<HTMLInputElement>(this, "autoFit");
    this.showGuides = byId<HTMLInputElement>(this, "showGuides");
    this.toggleOriginalBtn = byId<HTMLButtonElement>(this, "toggleOriginalBtn");
    this.reuploadBtn = byId<HTMLButtonElement>(this, "reuploadBtn");
    this.downloadBtn = byId<HTMLButtonElement>(this, "downloadBtn");
    this.statusButton = byId<HTMLButtonElement>(this, "statusButton");
    this.warningPills = byId<HTMLElement>(this, "warningPills");
  }

  private bindEvents() {
    this.specSelect.addEventListener("change", () => {
      this.emit(UI_EVENTS.specChange, { specId: this.specSelect.value });
    });

    for (const input of this.bgPresetInputs) {
      input.addEventListener("change", () => {
        if (input.checked) this.emit(UI_EVENTS.backgroundChange, { color: input.value });
      });
    }

    this.useBgRemoval.addEventListener("change", () => {
      this.emit(UI_EVENTS.bgRemovalChange, { enabled: this.useBgRemoval.checked });
    });
    this.autoFit.addEventListener("change", () => this.emit(UI_EVENTS.autoFitChange, { enabled: this.autoFit.checked }));
    this.showGuides.addEventListener("change", () => this.emit(UI_EVENTS.guidesChange, { enabled: this.showGuides.checked }));
    this.toggleOriginalBtn.addEventListener("click", () => this.emit(UI_EVENTS.toggleOriginal));
    this.reuploadBtn.addEventListener("click", () => this.emit(UI_EVENTS.reuploadRequest));
    this.downloadBtn.addEventListener("click", () => this.emit(UI_EVENTS.downloadRequest));
    this.statusButton.addEventListener("click", () => this.emit(UI_EVENTS.statusClick));
  }

  private emit(name: UiEventName, detail?: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  }

  private hasWarnings() {
    return this.warningPills.children.length > 0;
  }

  private syncWarningsVisibility() {
    this.warningPills.hidden = !this.warningsVisible || !this.hasWarnings();
  }
}

export class PhotoDocStageElement extends HTMLElement {
  private sourceMeta!: HTMLElement;
  private outputMeta!: HTMLElement;
  private progressBar!: HTMLElement;
  private progressFill!: HTMLElement;
  private resultOriginalBtn!: HTMLButtonElement;

  sourceCanvas!: HTMLCanvasElement;
  outputCanvas!: HTMLCanvasElement;

  connectedCallback() {
    if (this.dataset.ready === "true") return;
    this.innerHTML = STAGE_TEMPLATE;
    this.dataset.ready = "true";
    this.collectElements();
    this.resultOriginalBtn.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent(UI_EVENTS.toggleOriginal, { bubbles: true }));
    });
  }

  setSourceMeta(text: string) {
    this.sourceMeta.textContent = text;
  }

  setOutputMeta(text: string) {
    this.outputMeta.textContent = text;
  }

  setProgressVisible(visible: boolean) {
    this.progressBar.hidden = !visible;
  }

  setProgressPercent(percent: number | null) {
    this.progressFill.style.width = percent === null ? "38%" : `${Math.max(0, Math.min(100, Math.round(percent)))}%`;
  }

  setShowOriginalMobile(showOriginal: boolean) {
    this.classList.toggle("show-original-mobile", showOriginal);
    this.resultOriginalBtn.textContent = showOriginal ? "Result" : "Original";
  }

  setProcessing(processing: boolean) {
    this.resultOriginalBtn.disabled = processing;
  }

  private collectElements() {
    this.sourceCanvas = byId<HTMLCanvasElement>(this, "sourceCanvas");
    this.outputCanvas = byId<HTMLCanvasElement>(this, "outputCanvas");
    this.sourceMeta = byId<HTMLElement>(this, "sourceMeta");
    this.outputMeta = byId<HTMLElement>(this, "outputMeta");
    this.progressBar = byId<HTMLElement>(this, "progressBar");
    this.progressFill = byId<HTMLElement>(this, "progressFill");
    this.resultOriginalBtn = byId<HTMLButtonElement>(this, "resultOriginalBtn");
  }
}

export function definePhotoDocComponents() {
  defineElement("photo-doc-intro", PhotoDocIntroElement);
  defineElement("photo-doc-toolbar", PhotoDocToolbarElement);
  defineElement("photo-doc-stage", PhotoDocStageElement);
}

function defineElement(name: string, element: CustomElementConstructor) {
  if (!customElements.get(name)) customElements.define(name, element);
}

function byId<T extends HTMLElement>(root: ParentNode, id: string): T {
  const el = root.querySelector(`#${id}`);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}
