import assert from "node:assert/strict";
import test from "node:test";
import { kanaAnswersMatch, modelAlternatives, normalizeKanaAnswer } from "./answer-match.ts";
import { toStudentKana } from "./to-student-kana.ts";

test("cleanup drops brackets, spaces, and punctuation", () => {
  assert.equal(
    normalizeKanaAnswer("[おはようございます]。わたしは[ケン]です。"),
    "おはようございますわたしはケンです",
  );
  assert.equal(normalizeKanaAnswer("コーヒーを\u3000のみました。"), "コーヒーをのみました");
  assert.deepEqual(modelAlternatives("はいたべました / いいえまだです"), [
    "はいたべました",
    "いいえまだです",
  ]);
});

test("equal strings match and a shorter overlap does not", () => {
  assert.equal(
    kanaAnswersMatch("おはようございますわたしはケンです", "おはようございますわたしはケンです"),
    true,
  );
  assert.equal(kanaAnswersMatch("わたしはケンです", "おはようございますわたしはケンです"), false);
  assert.equal(kanaAnswersMatch("", "おはようございます"), false);
});

test("slash alternatives match one side only", () => {
  const model = "[はい、たべました]。 / [いいえ、まだです]。";
  assert.equal(kanaAnswersMatch("はい、たべました。", model), true);
  assert.equal(kanaAnswersMatch("いいえ、まだです。", model), true);
  assert.equal(kanaAnswersMatch("まだです", model), false);
});

test("greeting, age, and a wrong answer after kana conversion", async () => {
  const greetingStudent = await toStudentKana("おはようございます。わたしはケンです。");
  const greetingModel = await toStudentKana("[おはようございます]。わたしは[ケン]です。");
  assert.equal(kanaAnswersMatch(greetingStudent, greetingModel), true);

  const ageStudent = await toStudentKana("18さいです");
  const ageModel = await toStudentKana("[18さい]です。");
  assert.equal(kanaAnswersMatch(ageStudent, ageModel), true);

  const wrong = await toStudentKana("がくせいです");
  assert.equal(kanaAnswersMatch(wrong, ageModel), false);
  assert.equal(kanaAnswersMatch(await toStudentKana("わたしはケンです"), greetingModel), false);
});
