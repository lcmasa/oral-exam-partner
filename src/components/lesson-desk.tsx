"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { kanaAnswersMatch } from "@/lib/answer-match";
import { itemById, practiceItems, practiceSlots } from "@/lib/exam-items";
import { publicUrl } from "@/lib/public-url";
import {
  PHASE_LABEL,
  hasNextQuestion,
  initialState,
  isPracticeFinished,
  readyForNext,
  reduce,
  showPlayQuestionAgain,
  shuffleQuestions,
  type LessonEvent,
  type LessonState,
  type PracticeSlot,
} from "@/lib/lesson-machine";
import {
  isStudentKanaReady,
  loadStudentKanaTokenizer,
  studentKanaNow,
  subscribeStudentKana,
  toStudentKana,
} from "@/lib/to-student-kana";
import type { SpeechRec } from "@/types/speech";

const ERROR_COPY: Partial<Record<LessonState["phase"], string>> = {
  "mic-blocked": "The microphone is blocked. Allow the microphone, then hear the question again.",
  "speech-unavailable": "Speech recognition is not available in this browser.",
  "no-speech": "No speech heard. Hear the question again, then answer.",
  "recognition-error": "Something went wrong with speech recognition. Hear the question again.",
};

function isErrorPhase(phase: LessonState["phase"]): boolean {
  return phase in ERROR_COPY;
}

export function LessonDesk() {
  const [state, setState] = useState<LessonState>(initialState);
  const [playFailed, setPlayFailed] = useState(false);
  const [hearing, setHearing] = useState("");
  const [convertFailed, setConvertFailed] = useState(false);
  const stateRef = useRef(state);
  const playToken = useRef(0);
  const currentSrcRef = useRef("");
  const poolRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioHostRef = useRef<HTMLDivElement>(null);
  const onEndedRef = useRef<(token: number, src: string) => void>(() => {});
  const recognitionRef = useRef<SpeechRec | null>(null);
  const judgedRef = useRef<string | null>(null);

  const kanaReady = useSyncExternalStore(subscribeStudentKana, isStudentKanaReady, () => false);
  const answerKana = useSyncExternalStore(
    subscribeStudentKana,
    () => (state.transcript ? studentKanaNow(state.transcript) : null),
    () => null,
  );

  function send(event: LessonEvent, flush = false) {
    const next = reduce(stateRef.current, event);
    stateRef.current = next;
    if (flush) flushSync(() => setState(next));
    else setState(next);
  }

  function closeMic() {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    try {
      rec?.abort();
    } catch {
      // already stopped
    }
  }

  function ensureAudio(src: string): HTMLAudioElement {
    const existing = poolRef.current.get(src);
    if (existing) return existing;
    const el = document.createElement("audio");
    el.preload = "auto";
    el.src = publicUrl(src);
    el.dataset.clip = src;
    (audioHostRef.current ?? document.body).appendChild(el);
    poolRef.current.set(src, el);
    return el;
  }

  function playClip(src: string) {
    const token = ++playToken.current;
    currentSrcRef.current = src;
    setPlayFailed(false);
    const el = ensureAudio(src);
    for (const other of poolRef.current.values()) {
      if (other !== el) other.pause();
    }
    el.onended = () => onEndedRef.current(token, src);
    try {
      if (el.currentTime > 0.05) el.currentTime = 0;
    } catch {
      // metadata is still loading
    }
    void el.play().catch(() => {
      if (playToken.current === token) setPlayFailed(true);
    });
  }

  function stopAudio() {
    playToken.current += 1;
    currentSrcRef.current = "";
    for (const el of poolRef.current.values()) el.pause();
  }

  async function settle(transcript: string) {
    const snapshot = stateRef.current;
    if (snapshot.phase !== "answered") return;
    const key = `${snapshot.index}\0${transcript}`;
    if (judgedRef.current === key) return;
    judgedRef.current = key;
    const item = itemById(snapshot.order[snapshot.index]?.id ?? "");
    if (!item?.modelAnswer || !item.modelSrc) return;
    let matched = false;
    try {
      const student = studentKanaNow(transcript) ?? (await toStudentKana(transcript));
      const model = studentKanaNow(item.modelAnswer) ?? (await toStudentKana(item.modelAnswer));
      if (stateRef.current.phase !== "answered") return;
      if (`${stateRef.current.index}\0${stateRef.current.transcript}` !== key) return;
      matched = kanaAnswersMatch(student, model);
    } catch {
      setConvertFailed(true);
      matched = false;
    }
    if (stateRef.current.phase !== "answered") return;
    if (matched) {
      send({ type: "skip-model" }, true);
      return;
    }
    closeMic();
    send({ type: "show-model" }, true);
    playClip(item.modelSrc);
  }

  function openMic() {
    if (stateRef.current.phase !== "listening") return;
    const Ctor = window.webkitSpeechRecognition ?? window.SpeechRecognition;
    if (!Ctor) {
      send({ type: "speech-unavailable" });
      return;
    }
    closeMic();
    const rec = new Ctor();
    rec.lang = "ja-JP";
    rec.interimResults = true;
    rec.continuous = false;
    recognitionRef.current = rec;
    rec.onstart = () => {
      if (stateRef.current.phase !== "listening") {
        try {
          rec.abort();
        } catch {
          // already closed
        }
      }
    };
    rec.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const piece = result?.[0]?.transcript ?? "";
        if (result?.isFinal) finalText += piece;
        else interim += piece;
      }
      if (interim) setHearing(interim);
      if (!finalText) return;
      setHearing("");
      setConvertFailed(false);
      send({ type: "answer", transcript: finalText }, true);
      void settle(finalText);
    };
    rec.onerror = (event) => {
      if (event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        send({ type: "mic-blocked" });
        return;
      }
      if (event.error === "no-speech") {
        send({ type: "no-speech" });
        return;
      }
      send({ type: "recognition-error" });
    };
    rec.onend = () => {
      if (recognitionRef.current !== rec) return;
      if (stateRef.current.phase === "listening") send({ type: "no-speech" });
    };
    try {
      rec.start();
    } catch {
      send({ type: "speech-unavailable" });
    }
  }

  function begin(order: PracticeSlot[]) {
    judgedRef.current = null;
    setHearing("");
    setConvertFailed(false);
    setPlayFailed(false);
    closeMic();
    stopAudio();
    send({ type: "start", order }, true);
    const first = itemById(order[0]?.id ?? "");
    if (first) playClip(first.questionSrc);
  }

  function goNext() {
    if (!readyForNext(stateRef.current)) return;
    setHearing("");
    judgedRef.current = null;
    send({ type: "next-question" }, true);
    const next = stateRef.current;
    if (next.phase !== "playing") return;
    const item = itemById(next.order[next.index]?.id ?? "");
    if (item) playClip(item.questionSrc);
  }

  function replayQuestion() {
    setHearing("");
    judgedRef.current = null;
    closeMic();
    send({ type: "replay-question" }, true);
    const item = itemById(stateRef.current.order[stateRef.current.index]?.id ?? "");
    if (item) playClip(item.questionSrc);
  }

  function replayModel() {
    const item = itemById(stateRef.current.order[stateRef.current.index]?.id ?? "");
    if (!item?.modelSrc) return;
    send({ type: "replay-model" }, true);
    playClip(item.modelSrc);
  }

  useEffect(() => {
    void loadStudentKanaTokenizer();
  }, []);

  useEffect(() => {
    onEndedRef.current = (token, src) => {
      if (token !== playToken.current) return;
      if (src !== currentSrcRef.current) return;
      send({ type: "playback-ended" }, true);
      if (playToken.current !== token) return;
      if (stateRef.current.phase === "listening") openMic();
    };
  });

  useEffect(() => {
    const slot = state.order[state.index];
    if (!slot) return;
    const item = itemById(slot.id);
    const next = state.order[state.index + 1];
    const nextItem = next ? itemById(next.id) : undefined;
    if (item?.modelSrc) ensureAudio(item.modelSrc);
    if (nextItem) ensureAudio(nextItem.questionSrc);
  }, [state.index, state.order]);

  const count = practiceItems().length;
  const slot = state.order[state.index];
  const item = slot ? itemById(slot.id) : undefined;
  const showModel = state.phase === "model" || state.phase === "review";
  const finished = isPracticeFinished(state);
  const canNext = hasNextQuestion(state);
  const audioBusy = (state.phase === "playing" || state.phase === "model") && !playFailed;
  const hearingKana = hearing ? studentKanaNow(hearing) : null;
  const errorCopy = ERROR_COPY[state.phase];

  let primaryLabel = "Start practice";
  let primaryAction = () => begin(practiceSlots());
  if (state.phase === "done" || finished) {
    primaryLabel = "Start again";
    primaryAction = () => begin(practiceSlots());
  } else if (state.phase === "playing") {
    primaryLabel = playFailed ? "Hear it again" : "Playing the question";
    primaryAction = replayQuestion;
  } else if (state.phase === "model") {
    primaryLabel = playFailed ? "Play the model answer" : "Playing the model answer";
    primaryAction = replayModel;
  } else if (canNext) {
    primaryLabel = "Next question";
    primaryAction = goNext;
  } else if (isErrorPhase(state.phase)) {
    primaryLabel = "Hear it again";
    primaryAction = replayQuestion;
  }

  const showPrimary =
    state.phase === "idle" ||
    state.phase === "playing" ||
    state.phase === "model" ||
    state.phase === "done" ||
    finished ||
    canNext ||
    isErrorPhase(state.phase);
  const showRestart = state.phase !== "idle" && !finished && state.phase !== "done";
  const showHearModel = state.phase === "review";
  const showPlayAgain = showPlayQuestionAgain(state, audioBusy);

  return (
    <section
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:px-8 sm:py-10"
      data-phase={state.phase}
      data-mic={state.micOpen ? "open" : "closed"}
      data-order={state.order.map((entry) => entry.id).join(",")}
      data-count={count}
      data-index={state.phase === "idle" ? "" : String(state.index)}
      data-question={item?.question ?? ""}
      data-model={showModel ? (item?.modelAnswer ?? "") : ""}
      data-answer={answerKana ?? ""}
      data-transcript={state.transcript}
      data-kana-ready={kanaReady ? "true" : "false"}
    >
      <div ref={audioHostRef} className="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden="true" />
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium tracking-wide text-[#6b5e52]">Oral Exam Partner</p>
        <p className="rounded-full bg-white px-3 py-1 text-sm text-[#3d342c] shadow-sm" role="status">
          {PHASE_LABEL[state.phase]}
        </p>
      </header>

      {state.phase === "idle" ? (
        <div className="flex flex-1 flex-col justify-center py-10">
          <h1 className="text-4xl font-semibold tracking-tight text-[#1f1a17] sm:text-6xl">Oral Exam Partner</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#3d342c]">
            {count} questions, in slide order. A model answer plays only when yours does not match. Shuffle the
            questions mixes them and starts again.
          </p>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-[#6b5e52]">
            Press Start practice when you are ready. Questions play in order.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col py-8">
          {finished ? <p className="mb-4 text-lg text-[#3d342c]">You finished this set.</p> : null}
          <p className="text-sm font-medium uppercase tracking-wide text-[#6b5e52]">Now</p>
          <p className="mt-1 text-sm text-[#6b5e52]">
            {state.index + 1} of {state.order.length}
          </p>
          <h1 className="mt-4 text-3xl leading-snug font-semibold text-[#1f1a17] sm:text-5xl" lang="ja">
            {item?.question}
          </h1>

          <div className="mt-8 flex items-center gap-3 text-base text-[#3d342c]">
            <span
              className={`size-3 rounded-full ${state.micOpen ? "bg-emerald-600" : "bg-[#c4b8aa]"}`}
              aria-hidden="true"
            />
            {state.micOpen ? "Microphone is open" : "Microphone is closed"}
          </div>

          {state.phase === "listening" && hearing ? (
            <p className="mt-6 text-lg text-[#3d342c]">
              Hearing:{" "}
              {hearingKana ? (
                <span lang="ja">{hearingKana}</span>
              ) : (
                <span>Converting to kana…</span>
              )}
            </p>
          ) : null}

          {state.transcript ? (
            <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-wide text-[#6b5e52]">Your answer</p>
              {convertFailed ? (
                <p className="mt-2 text-2xl text-[#1f1a17]">Could not convert to kana</p>
              ) : answerKana ? (
                <p className="mt-2 text-2xl leading-relaxed text-[#1f1a17] sm:text-3xl" lang="ja">
                  {answerKana}
                </p>
              ) : (
                <p className="mt-2 text-2xl text-[#1f1a17]">Converting to kana…</p>
              )}
            </div>
          ) : null}

          {showModel && item?.modelAnswer ? (
            <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-wide text-[#6b5e52]">Model answer</p>
              <p className="mt-2 text-2xl leading-relaxed text-[#1f1a17] sm:text-3xl" lang="ja">
                {item.modelAnswer}
              </p>
            </div>
          ) : null}

          {errorCopy ? <p className="mt-6 text-lg text-[#3d342c]">{errorCopy}</p> : null}
        </div>
      )}

      <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap">
        {showPrimary ? (
          <Button type="button" size="xl" disabled={audioBusy} onClick={primaryAction}>
            {primaryLabel}
          </Button>
        ) : null}
        {showPlayAgain ? (
          <Button type="button" size="xl" variant="outline" onClick={replayQuestion}>
            Play the question again
          </Button>
        ) : null}
        {showHearModel ? (
          <Button type="button" size="xl" variant="outline" onClick={replayModel}>
            Hear it again
          </Button>
        ) : null}
        {showRestart ? (
          <Button type="button" size="xl" variant="outline" onClick={() => begin(practiceSlots())}>
            Start again
          </Button>
        ) : null}
        <Button type="button" size="xl" variant="outline" onClick={() => begin(shuffleQuestions(practiceSlots()))}>
          Shuffle the questions
        </Button>
      </div>
    </section>
  );
}
