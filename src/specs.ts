export type PhotoSpec = {
  id: string;
  label: string;
  widthPx: number;
  heightPx: number;
  dpi: number;
  background: string;
  targetHeadRatio: number;
  targetEyeLineRatio: number;
  minFaceRatio: number;
  maxFaceRatio: number;
  notes: string;
};

export const SPECS: PhotoSpec[] = [
  {
    id: "ru_passport_35x45",
    label: "Russian passport / 35 × 45 mm @ 300 DPI",
    widthPx: Math.round((35 / 25.4) * 300),
    heightPx: Math.round((45 / 25.4) * 300),
    dpi: 300,
    background: "#ffffff",
    targetHeadRatio: 0.76,
    targetEyeLineRatio: 0.43,
    minFaceRatio: 0.62,
    maxFaceRatio: 0.84,
    notes: "Russian passport preset for 35×45 mm photos. Check current official requirements before submission."
  },
  {
    id: "eu_35x45",
    label: "EU / 35 × 45 mm @ 300 DPI",
    widthPx: Math.round((35 / 25.4) * 300),
    heightPx: Math.round((45 / 25.4) * 300),
    dpi: 300,
    background: "#ffffff",
    targetHeadRatio: 0.74,
    targetEyeLineRatio: 0.42,
    minFaceRatio: 0.60,
    maxFaceRatio: 0.84,
    notes: "Universal 35×45 mm preset. Check the requirements for the specific country before real use."
  },
  {
    id: "us_2x2",
    label: "US passport / 2 × 2 inch @ 300 DPI",
    widthPx: 600,
    heightPx: 600,
    dpi: 300,
    background: "#ffffff",
    targetHeadRatio: 0.62,
    targetEyeLineRatio: 0.41,
    minFaceRatio: 0.49,
    maxFaceRatio: 0.69,
    notes: "US 2×2 inch preset. Do not use AI face retouching for an official submission."
  },
  {
    id: "square_1000",
    label: "Custom square / 1000 × 1000 px",
    widthPx: 1000,
    heightPx: 1000,
    dpi: 300,
    background: "#ffffff",
    targetHeadRatio: 0.62,
    targetEyeLineRatio: 0.41,
    minFaceRatio: 0.48,
    maxFaceRatio: 0.75,
    notes: "Neutral square format for forms, badges, and internal systems."
  }
];

export function withDpi(spec: PhotoSpec, dpi: number): PhotoSpec {
  if (spec.id === "us_2x2") {
    return { ...spec, widthPx: Math.round(2 * dpi), heightPx: Math.round(2 * dpi), dpi };
  }
  if (spec.id === "eu_35x45" || spec.id === "ru_passport_35x45") {
    return {
      ...spec,
      widthPx: Math.round((35 / 25.4) * dpi),
      heightPx: Math.round((45 / 25.4) * dpi),
      dpi
    };
  }
  return { ...spec, dpi };
}
