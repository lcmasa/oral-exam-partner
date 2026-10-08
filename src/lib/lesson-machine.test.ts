import assert from "node:assert/strict";
import test from "node:test";
import {
  initialState,
  readyForNext,
  reduce,
  shouldOpenMic,
  showPlayQuestionAgain,
  shuffleQuestions,
  type PracticeSlot,
} from "./lesson-machine.ts";

const order: PracticeSlot[] = [
  { id: "slide-02", hasModel: true },
  { id: "slide-03", hasModel: true },
  { id: "slide-04", hasModel: false },
];

test("mic stays closed during the question and opens only after it ends", () => {
  const playing = reduce(initialState, { type: "start", order });
  assert.equal(playing.phase, "playing");
  assert.equal(playing.micOpen, false);
  assert.equal(shouldOpenMic(playing), false);
  assert.deepEqual(
    playing.order.map((slot) => slot.id),
    order.map((slot) => slot.id),
  );
  const listening = reduce(playing, { type: "playback-ended" });
  assert.equal(listening.phase, "listening");
  assert.equal(listening.micOpen, true);
  assert.equal(shouldOpenMic(listening), true);
});

test("model playback does not open the mic", () => {
  let state = reduce(initialState, { type: "start", order });
  state = reduce(state, { type: "playback-ended" });
  state = reduce(state, { type: "answer", transcript: "がくせいです" });
  assert.equal(state.phase, "answered");
  assert.equal(readyForNext(state), false);
  state = reduce(state, { type: "show-model" });
  assert.equal(state.phase, "model");
  assert.equal(state.micOpen, false);
  state = reduce(state, { type: "playback-ended" });
  assert.equal(state.phase, "review");
  assert.equal(state.micOpen, false);
  assert.equal(shouldOpenMic(state), false);
  assert.equal(readyForNext(state), true);
});

test("a match can move on and a later model request is ignored", () => {
  let state = reduce(initialState, { type: "start", order });
  state = reduce(state, { type: "playback-ended" });
  state = reduce(state, { type: "answer", transcript: "match" });
  const skipped = reduce(state, { type: "skip-model" });
  assert.equal(skipped.skipModel, true);
  assert.equal(skipped.micOpen, false);
  assert.equal(readyForNext(skipped), true);
  assert.equal(reduce(skipped, { type: "show-model" }).phase, "answered");
  const next = reduce(skipped, { type: "next-question" });
  assert.equal(next.phase, "playing");
  assert.equal(next.index, 1);
  assert.equal(next.skipModel, false);
  assert.equal(next.micOpen, false);
});

test("an item without a model can move on immediately", () => {
  let state = reduce(initialState, { type: "start", order });
  state = reduce(state, { type: "next-question" });
  assert.equal(state.phase, "playing");
  state = { ...state, index: 2, phase: "listening", micOpen: true };
  state = reduce(state, { type: "answer", transcript: "はい" });
  assert.equal(readyForNext(state), true);
});

test("errors close the mic and a late error does not erase an answer", () => {
  let state = reduce(initialState, { type: "start", order });
  state = reduce(state, { type: "playback-ended" });
  const blocked = reduce(state, { type: "mic-blocked" });
  assert.equal(blocked.phase, "mic-blocked");
  assert.equal(blocked.micOpen, false);
  const answered = reduce(state, { type: "answer", transcript: "はい" });
  assert.equal(reduce(answered, { type: "no-speech" }).phase, "answered");
  assert.equal(reduce(state, { type: "speech-unavailable" }).phase, "speech-unavailable");
  assert.equal(reduce(state, { type: "recognition-error" }).phase, "recognition-error");
  assert.equal(reduce(state, { type: "no-speech" }).phase, "no-speech");
});

test("replaying the question keeps the answer and does not move on", () => {
  let state = reduce(initialState, { type: "start", order });
  state = reduce(state, { type: "playback-ended" });
  assert.equal(showPlayQuestionAgain(state), true);
  state = reduce(state, { type: "answer", transcript: "がくせいです" });
  state = reduce(state, { type: "skip-model" });
  assert.equal(showPlayQuestionAgain(state), true);
  assert.equal(showPlayQuestionAgain(state, true), false);
  const replayed = reduce(state, { type: "replay-question" });
  assert.equal(replayed.phase, "playing");
  assert.equal(replayed.micOpen, false);
  assert.equal(replayed.transcript, "がくせいです");
  assert.equal(replayed.index, 0);
  assert.equal(shouldOpenMic(replayed), false);
  assert.equal(showPlayQuestionAgain(replayed, true), false);
  const listening = reduce(replayed, { type: "playback-ended" });
  assert.equal(listening.phase, "listening");
  assert.equal(listening.micOpen, true);
  assert.equal(listening.transcript, "がくせいです");
  assert.equal(listening.index, 0);
  assert.equal(readyForNext(listening), false);
  assert.notEqual(reduce(listening, { type: "playback-ended" }).phase, "review");
});

test("shuffle keeps every id and start does not reorder", () => {
  const slots = [
    { id: "a", hasModel: true },
    { id: "b", hasModel: true },
    { id: "c", hasModel: true },
  ];
  const original = Math.random;
  Math.random = () => 0.1;
  const shuffled = shuffleQuestions(slots);
  Math.random = original;
  assert.deepEqual(
    shuffled.map((slot) => slot.id).sort(),
    ["a", "b", "c"],
  );
  assert.notDeepEqual(
    shuffled.map((slot) => slot.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    slots.map((slot) => slot.id),
    ["a", "b", "c"],
  );
  const started = reduce(initialState, { type: "start", order: slots });
  assert.deepEqual(
    started.order.map((slot) => slot.id),
    ["a", "b", "c"],
  );
});
