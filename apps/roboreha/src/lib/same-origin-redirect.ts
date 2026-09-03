export function sameOriginRedirect(pathname: string) {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || /[\r\n]/.test(pathname)) {
    throw new Error("Redirect path must stay on the current origin.");
  }

  return {
    status: 303 as const,
    headers: { location: pathname },
  };
}
