export function useMedia() {
  const base = import.meta.env.VITE_MEDIA_URL;

  const getUrl = (path?: string | null) =>
    !path ? "" : path.startsWith("http") ? path : `${base}${path}`;

  return { getUrl };
}
