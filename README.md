# Oral Exam Partner

Practice for LANG 1211. Twenty questions play in slide order. The microphone opens after each question. A model answer plays only when the kana form of your answer does not match.

Start practice and Start again keep the original order. Shuffle the questions mixes these 20 and starts immediately. Start again after a shuffle returns to slide order.

## Run

```bash
npm install
npm run dev
```

The dev server listens on port 43127:

```bash
npx next dev --hostname 0.0.0.0 --port 43127
```

Open http://127.0.0.1:43127.

Question audio is in `public/exam/`. The kana dictionary is in `public/kuromoji-dict/` and loads once when the page opens.

```bash
npm test
```
