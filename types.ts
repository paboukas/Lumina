
export interface BatchItem {
  id: string;
  original: string;
  edited: string | null;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

export interface ImageState {
  items: BatchItem[];
  isProcessing: boolean;
}

export enum EditPreset {
  VibrantMagazine = 'VIBRANT_MAGAZINE',
  RetroFilter = 'RETRO_FILTER',
  BW = 'BW',
  GoldenHour = 'GOLDEN_HOUR',
  Custom = 'CUSTOM'
}

export interface HistoryItem {
  id: string;
  original: string;
  edited: string;
  prompt: string;
  timestamp: number;
}
