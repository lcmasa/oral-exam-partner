/** Prefix for the GitHub Pages build. Empty when the dev server is at the site root. */
export function publicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
