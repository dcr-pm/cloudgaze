export interface CloudShape {
  shape: string;
  description: string;
}

export type AnalysisResult = CloudShape[];

export enum AppState {
  IDLE,
  CAMERA_ACTIVE,
  ANALYZING,
  RESULTS_SHOWN,
  ERROR,
}