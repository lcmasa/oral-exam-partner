declare module "kuromoji" {
  const kuromoji: {
    builder: (option: { dicPath?: string }) => {
      build: (callback: (error: Error | null, tokenizer?: unknown) => void) => void;
    };
  };
  export default kuromoji;
}

declare module "kuromoji/build/kuromoji.js" {
  const kuromoji: {
    builder: (option: { dicPath?: string }) => {
      build: (callback: (error: Error | null, tokenizer?: unknown) => void) => void;
    };
  };
  export default kuromoji;
}
