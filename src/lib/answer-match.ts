const IGNORED = /[\[\]［］【】〔〕（）()「」『』〈〉《》、。．，,.！？!?：:;；・…〜~"'“”‘’]/g;

export function normalizeKanaAnswer(text: string): string {
  return text.replace(IGNORED, "").replace(/[\s\u3000]+/g, "");
}

export function modelAlternatives(modelKana: string): string[] {
  return modelKana
    .split("/")
    .map((part) => normalizeKanaAnswer(part))
    .filter((part) => part.length > 0);
}

export function kanaAnswersMatch(studentKana: string, modelKana: string): boolean {
  const student = normalizeKanaAnswer(studentKana);
  if (!student) return false;
  return modelAlternatives(modelKana).includes(student);
}
