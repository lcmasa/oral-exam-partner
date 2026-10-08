export type KanaToken = {
  surface_form: string;
  reading?: string;
};

type Tokenizer = {
  tokenize: (text: string) => KanaToken[];
};

type Engine = {
  builder: (option: { dicPath?: string }) => {
    build: (callback: (error: Error | null, tokenizer?: Tokenizer) => void) => void;
  };
};

const KANJI = /[\u3400-\u9fff\u3005]/;

let tokenizer: Tokenizer | null = null;
let pending: Promise<Tokenizer> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function katakanaToHiragana(reading: string): string {
  let out = "";
  for (const ch of reading) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x30a1 && code <= 0x30f6) {
      out += String.fromCodePoint(code - 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

export function tokensToStudentKana(tokens: KanaToken[]): string {
  return tokens
    .map((token) => {
      if (KANJI.test(token.surface_form) && token.reading) {
        return katakanaToHiragana(token.reading);
      }
      return token.surface_form;
    })
    .join("");
}

function unwrap(mod: unknown): Engine {
  const record = mod as {
    builder?: Engine["builder"];
    default?: { builder?: Engine["builder"] };
  };
  const builder = record.builder ?? record.default?.builder;
  if (!builder) throw new Error("Could not load the kana dictionary.");
  return { builder };
}

async function loadEngine(): Promise<Engine> {
  if (typeof window === "undefined") {
    const mod = await import(/* turbopackIgnore: true */ "kuromoji");
    return unwrap(mod);
  }
  const mod = await import("kuromoji/build/kuromoji.js");
  return unwrap(mod);
}

function dictionaryPath(): string {
  if (typeof window === "undefined") return "node_modules/kuromoji/dict";
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}/kuromoji-dict`;
}

export function loadStudentKanaTokenizer(): Promise<Tokenizer> {
  if (tokenizer) return Promise.resolve(tokenizer);
  if (pending) return pending;
  const request = loadEngine().then(
    (engine) =>
      new Promise<Tokenizer>((resolve, reject) => {
        engine.builder({ dicPath: dictionaryPath() }).build((error, built) => {
          if (error || !built) {
            reject(error ?? new Error("Could not load the kana dictionary."));
            return;
          }
          resolve(built);
        });
      }),
  );
  pending = request.then(
    (built) => {
      tokenizer = built;
      emit();
      return built;
    },
    (error: unknown) => {
      pending = null;
      throw error;
    },
  );
  return pending;
}

export function isStudentKanaReady(): boolean {
  return tokenizer !== null;
}

export function studentKanaNow(text: string): string | null {
  if (!tokenizer) return null;
  return tokensToStudentKana(tokenizer.tokenize(text));
}

export async function toStudentKana(text: string): Promise<string> {
  const built = await loadStudentKanaTokenizer();
  return tokensToStudentKana(built.tokenize(text));
}

export function subscribeStudentKana(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
