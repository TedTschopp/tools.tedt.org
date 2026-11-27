// The single-file edition carries the same files as the static site.
const payload = document.getElementById("atlas-files");
const packed = payload ? JSON.parse(payload.textContent) : null;
const urls = new Map();
export const portable = Boolean(packed);
export function assetUrl(path) {
  if (!packed || !Object.hasOwn(packed, path)) return path;
  if (!urls.has(path)) {
    const [type, encoding] = packed[path],
      bytes = Uint8Array.from(atob(encoding), (c) => c.charCodeAt(0));
    urls.set(path, URL.createObjectURL(new Blob([bytes], { type })));
  }
  return urls.get(path);
}
