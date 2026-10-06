// Resolves files from /public so they work when the site is hosted under a
// sub-path (e.g. https://USERNAME.github.io/mac-os/).
// BASE_URL comes from `base` in vite.config.js.
const BASE = import.meta.env.BASE_URL || "/";

const isExternal = (p) => /^(https?:|data:|blob:|\/\/)/i.test(p);

/** "/Wallpaper/a.png" -> "/mac-os/Wallpaper/a.png" (safe to call twice) */
export const asset = (p) => {
  if (!p || typeof p !== "string" || isExternal(p)) return p;
  if (BASE !== "/" && p.startsWith(BASE)) return p;
  return BASE + p.replace(/^\/+/, "");
};

/** "/mac-os/Wallpaper/a.png" -> "/Wallpaper/a.png" (used for preset lookups) */
export const unasset = (p) => {
  if (!p || typeof p !== "string") return p;
  return BASE !== "/" && p.startsWith(BASE) ? "/" + p.slice(BASE.length) : p;
};
