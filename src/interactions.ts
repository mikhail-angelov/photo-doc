import type { AppState } from "./app-state";

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
  startRotationDeg: number;
  mode: "pan" | "rotate";
};

export function bindCanvasInteractions(canvas: HTMLCanvasElement, state: AppState, redraw: () => void) {
  let dragState: DragState | null = null;
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;
  const activeTouches = new Map<number, { x: number; y: number }>();

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!state.foregroundImage) return;
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.08 : -0.08;
      state.transform.zoom = clamp(state.transform.zoom + delta, 0.5, 3);
      redraw();
    },
    { passive: false }
  );

  canvas.addEventListener("pointerdown", (event) => {
    if (!state.foregroundImage) return;

    if (event.pointerType === "touch") {
      activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activeTouches.size === 2) {
        pinchStartDistance = getTouchDistance(activeTouches);
        pinchStartZoom = state.transform.zoom;
      }
    }

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: state.transform.offsetX,
      startOffsetY: state.transform.offsetY,
      startRotationDeg: state.transform.rotationDeg,
      mode: event.shiftKey ? "rotate" : "pan"
    };

    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.foregroundImage) return;

    if (event.pointerType === "touch" && activeTouches.has(event.pointerId)) {
      activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activeTouches.size === 2 && pinchStartDistance > 0) {
        const nextDistance = getTouchDistance(activeTouches);
        if (nextDistance > 0) {
          state.transform.zoom = clamp(pinchStartZoom * (nextDistance / pinchStartDistance), 0.5, 3);
          redraw();
          return;
        }
      }
    }

    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(rect.width, 1);
    const scaleY = canvas.height / Math.max(rect.height, 1);
    const deltaX = (event.clientX - dragState.startX) * scaleX;
    const deltaY = (event.clientY - dragState.startY) * scaleY;

    if (dragState.mode === "rotate") {
      state.transform.rotationDeg = clamp(dragState.startRotationDeg + deltaX * 0.08, -20, 20);
    } else {
      state.transform.offsetX = clamp(dragState.startOffsetX + deltaX, -600, 600);
      state.transform.offsetY = clamp(dragState.startOffsetY + deltaY, -600, 600);
    }

    redraw();
  });

  const releasePointer = (event: PointerEvent) => {
    if (event.pointerType === "touch") {
      activeTouches.delete(event.pointerId);
      if (activeTouches.size < 2) {
        pinchStartDistance = 0;
      }
    }

    if (dragState?.pointerId === event.pointerId) {
      dragState = null;
    }

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
}

function getTouchDistance(activeTouches: Map<number, { x: number; y: number }>) {
  const touches = [...activeTouches.values()];
  if (touches.length < 2) return 0;
  const [a, b] = touches;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
