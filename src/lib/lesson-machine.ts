export type Phase =
  | "idle"
  | "playing"
  | "listening"
  | "answered"
  | "model"
  | "review"
  | "done"
  | "mic-blocked"
  | "speech-unavailable"
  | "no-speech"
  | "recognition-error";

export type PracticeSlot = {
  id: string;
  hasModel: boolean;
};

export type LessonState = {
  phase: Phase;
  order: PracticeSlot[];
  index: number;
  transcript: string;
  micOpen: boolean;
  skipModel: boolean;
};

export type LessonEvent =
  | { type: "start"; order: PracticeSlot[] }
  | { type: "playback-ended" }
  | { type: "answer"; transcript: string }
  | { type: "skip-model" }
  | { type: "show-model" }
  | { type: "replay-model" }
  | { type: "replay-question" }
  | { type: "next-question" }
  | { type: "mic-blocked" }
  | { type: "speech-unavailable" }
  | { type: "no-speech" }
  | { type: "recognition-error" };

export const initialState: LessonState = {
  phase: "idle",
  order: [],
  index: 0,
  transcript: "",
  micOpen: false,
  skipModel: false,
};

export const PHASE_LABEL: Record<Phase, string> = {
  idle: "Ready",
  playing: "Playing the question",
  listening: "Your turn",
  answered: "Your answer",
  model: "Playing the model answer",
  review: "Model answer",
  done: "Ready",
  "mic-blocked": "Microphone blocked",
  "speech-unavailable": "Speech recognition unavailable",
  "no-speech": "No speech heard",
  "recognition-error": "Recognition error",
};

export function currentSlot(state: LessonState): PracticeSlot | null {
  return state.order[state.index] ?? null;
}

export function readyForNext(state: LessonState): boolean {
  const slot = currentSlot(state);
  if (!slot) return false;
  if (state.phase === "review") return true;
  if (state.phase === "answered" && (!slot.hasModel || state.skipModel)) return true;
  return false;
}

export function hasNextQuestion(state: LessonState): boolean {
  return readyForNext(state) && state.index + 1 < state.order.length;
}

export function isPracticeFinished(state: LessonState): boolean {
  return state.phase === "done" || (readyForNext(state) && state.index + 1 >= state.order.length);
}

export function shouldOpenMic(state: LessonState): boolean {
  return state.phase === "listening" && state.micOpen;
}

function playingAt(state: LessonState, index: number): LessonState {
  return {
    ...state,
    phase: "playing",
    index,
    transcript: "",
    micOpen: false,
    skipModel: false,
  };
}

export function reduce(state: LessonState, event: LessonEvent): LessonState {
  switch (event.type) {
    case "start": {
      if (event.order.length === 0) return state;
      return playingAt({ ...initialState, order: event.order }, 0);
    }
    case "playback-ended": {
      if (state.phase === "playing") {
        return { ...state, phase: "listening", micOpen: true };
      }
      if (state.phase === "model") {
        return { ...state, phase: "review", micOpen: false };
      }
      return state;
    }
    case "answer": {
      if (state.phase !== "listening") return state;
      return {
        ...state,
        phase: "answered",
        transcript: event.transcript,
        micOpen: false,
        skipModel: false,
      };
    }
    case "skip-model": {
      if (state.phase !== "answered") return state;
      return { ...state, skipModel: true, micOpen: false };
    }
    case "show-model": {
      if (state.skipModel || state.phase !== "answered") return state;
      return { ...state, phase: "model", micOpen: false };
    }
    case "replay-model": {
      if (state.skipModel) return state;
      if (state.phase !== "review" && state.phase !== "model") return state;
      return { ...state, phase: "model", micOpen: false };
    }
    case "replay-question": {
      if (state.order.length === 0) return state;
      return playingAt(state, state.index);
    }
    case "next-question": {
      if (!readyForNext(state)) return state;
      const next = state.index + 1;
      if (next >= state.order.length) {
        return { ...state, phase: "done", micOpen: false, skipModel: false };
      }
      return playingAt(state, next);
    }
    case "mic-blocked":
    case "speech-unavailable":
    case "recognition-error": {
      if (state.phase !== "listening") return state;
      return { ...state, phase: event.type, micOpen: false };
    }
    case "no-speech": {
      if (state.phase !== "listening") return state;
      return { ...state, phase: "no-speech", micOpen: false };
    }
    default:
      return state;
  }
}

export function shuffleQuestions<T>(items: readonly T[]): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = next[i];
    next[i] = next[j] as T;
    next[j] = swap as T;
  }
  return next;
}
