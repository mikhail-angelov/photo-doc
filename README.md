# Document Photo

Browser-only prototype for preparing document photos without React and without a backend.

## Run

```bash
npm config set registry https://registry.npmjs.org/
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://127.0.0.1:5173`.

## GitHub Pages

The CI workflow builds the app and deploys `dist` with GitHub Pages Actions on pushes to `main` or `master`.

In the repository settings, configure GitHub Pages with `Source: GitHub Actions`.

Live URL: `https://mikhail-angelov.github.io/photo-doc/`

## Features

- JPG/PNG/HEIC upload, when the browser supports the format.
- In-browser face detection with MediaPipe.
- Fallback: if Face Landmarker does not find a face, MediaPipe Face Detector is used.
- Eye-line alignment when eye keypoints are available.
- In-browser background removal with `@imgly/background-removal`.
- Visible progress bar for the first MediaPipe/background-removal model downloads.
- Background replacement with a selected color.
- Automatic face positioning for the selected preset.
- Compact toolbar instead of a control sidebar.
- Desktop split view: original + result.
- Mobile result-first view with a button to show the original.
- Manual canvas adjustment: wheel/pinch = zoom, drag = pan, Shift + drag = rotation.
- PNG export.

## Changes In This Version

- Added a progress panel that shows WASM/runtime, Face Landmarker, fallback Face Detector, and background-removal model loading.
- Added manual MediaPipe model loading through `fetch` with byte progress, then passed the model to MediaPipe as `modelAssetBuffer`.
- Switched Face Landmarker to the CPU delegate: it is slower, but more stable in Firefox/Safari.
- Lowered confidence thresholds for challenging everyday photos.
- Added a `FaceDetector` fallback so auto-positioning can still work without face mesh.
- Background removal explicitly keeps `rescale: true`, so the result stays in the source photo coordinate space.
- Fixed startup synchronization between control state and UI.
- Migrated the UI to Web Components with separate intro, toolbar, and stage elements.

## Limitations

- This is not a certified validator for passport or ID photos.
- The prototype does not perform generative head rotation and does not alter the face.
- If the head is strongly turned or the face is not frontal, retake the photo.
- PNG export does not currently write DPI metadata; output size is defined in pixels.
- On first run, the browser downloads WASM/model assets from CDNs. Exact byte progress is not available for MediaPipe WASM, so that step is shown as initialization.

## License Note

`@imgly/background-removal` is distributed under AGPL-3.0. For a closed commercial product, replace that component or verify commercial licensing.
