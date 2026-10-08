import assert from "node:assert/strict";
import test from "node:test";
import { katakanaToHiragana, tokensToStudentKana, toStudentKana } from "./to-student-kana.ts";

test("katakana readings become hiragana and the long vowel stays", () => {
  assert.equal(katakanaToHiragana("ガクセイ"), "がくせい");
  assert.equal(katakanaToHiragana("ラーメン"), "らーめん");
  assert.equal(katakanaToHiragana("ケン"), "けん");
});

test("tokens keep a katakana surface and hiragana particles", () => {
  assert.equal(
    tokensToStudentKana([
      { surface_form: "学生", reading: "ガクセイ" },
      { surface_form: "食堂", reading: "ショクドウ" },
      { surface_form: "で", reading: "デ" },
      { surface_form: "ラーメン", reading: "ラーメン" },
      { surface_form: "を", reading: "ヲ" },
      { surface_form: "食べ", reading: "タベ" },
      { surface_form: "ます", reading: "マス" },
    ]),
    "がくせいしょくどうでラーメンをたべます",
  );
});

test("dictionary sample keeps katakana words", async () => {
  assert.equal(await toStudentKana("学生食堂でラーメンを食べます"), "がくせいしょくどうでラーメンをたべます");
});

test("punctuation stays on the kana line", async () => {
  assert.equal(
    await toStudentKana("学生食堂で、ラーメンを食べます。"),
    "がくせいしょくどうで、ラーメンをたべます。",
  );
});
