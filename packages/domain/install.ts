export type InstallMode =
  | "installed"
  | "unavailable"
  | "embedded"
  | "ios"
  | "prompt"
  | "manual";
export function installMode(input: {
  origin: string;
  configuredOrigin: string;
  connected: boolean;
  installed: boolean;
  userAgent: string;
  prompt: boolean;
}): InstallMode {
  if (input.installed) return "installed";
  try {
    const url = new URL(input.configuredOrigin);
    if (
      !input.connected ||
      url.protocol !== "https:" ||
      url.origin !== input.origin ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      return "unavailable";
  } catch {
    return "unavailable";
  }
  if (/KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(/i.test(input.userAgent))
    return "embedded";
  if (
    /iPhone|iPad|iPod/i.test(input.userAgent) &&
    /Safari/i.test(input.userAgent) &&
    !/CriOS|FxiOS|EdgiOS/i.test(input.userAgent)
  )
    return "ios";
  return input.prompt ? "prompt" : "manual";
}
export function maySuggestInstall(
  firstSaved: boolean,
  alreadySuggested: boolean,
  dismissedAt: number,
  now: number,
) {
  return (
    firstSaved &&
    !alreadySuggested &&
    (!dismissedAt || now - dismissedAt >= 7 * 86400000)
  );
}
