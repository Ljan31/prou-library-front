export const errMsg = (e: any, fallback: string) =>
  e?.response?.data?.error ?? e?.response?.data?.message ?? fallback;