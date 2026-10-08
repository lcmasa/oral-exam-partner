import assert from "node:assert/strict";
import test from "node:test";
import { EXAM_ITEMS, practiceItems } from "./exam-items.ts";

test("keeps both halves and pairs them into one pass", () => {
  assert.equal(EXAM_ITEMS.length, 40);
  const practice = practiceItems();
  assert.equal(practice.length, 20);
  assert.deepEqual(
    practice.map((item) => item.id),
    EXAM_ITEMS.slice(0, 20).map((item) => item.id),
  );
  for (let i = 0; i < 20; i += 1) {
    const question = EXAM_ITEMS[i];
    const later = EXAM_ITEMS[i + 20];
    const paired = practice[i];
    assert.equal(later?.question, question?.question);
    assert.equal(paired?.question, question?.question);
    assert.equal(paired?.modelAnswer, later?.modelAnswer);
    assert.equal(paired?.modelSrc, later?.modelSrc);
    assert.ok(paired?.modelSrc);
    assert.ok((paired?.slide ?? 99) < 22);
  }
  assert.equal(practice.filter((item) => item.question.includes("おはようございます")).length, 1);
  assert.ok(practice[0]?.modelAnswer?.includes("ケン"));
  assert.ok(practice[3]?.question.includes("\u3000"));
  assert.ok(practice[10]?.modelAnswer?.includes("/"));
  assert.ok(practice[19]?.question.includes("ゆうめい"));
});
