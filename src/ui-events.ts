export const UI_EVENTS = {
  autoFitChange: "auto-fit-change",
  backgroundChange: "background-change",
  bgRemovalChange: "bg-removal-change",
  downloadRequest: "download-request",
  fileSelected: "file-selected",
  guidesChange: "guides-change",
  reuploadRequest: "reupload-request",
  specChange: "spec-change",
  statusClick: "status-click",
  toggleOriginal: "toggle-original"
} as const;

export type UiEventName = (typeof UI_EVENTS)[keyof typeof UI_EVENTS];
