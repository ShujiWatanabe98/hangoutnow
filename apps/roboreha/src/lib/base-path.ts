export const ROBOREHA_BASE_PATH = process.env.NEXT_PUBLIC_ROBOREHA_BASE_PATH?.trim() ?? "";

export function withBasePath(path: string) {
  if (!path.startsWith("/") || !ROBOREHA_BASE_PATH || path.startsWith(`${ROBOREHA_BASE_PATH}/`)) return path;
  return `${ROBOREHA_BASE_PATH}${path}`;
}
