export {};

interface SpeechResult {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
}

interface SpeechEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechResult;
  };
}

interface SpeechErrorEvent {
  error: string;
}

export interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  abort: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRec;
    SpeechRecognition?: new () => SpeechRec;
  }
}
