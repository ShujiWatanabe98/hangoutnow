export const HANGOUT_START_WINDOWS_MINUTES = [30, 60, 180] as const;
export type HangoutStartWindowMinutes = (typeof HANGOUT_START_WINDOWS_MINUTES)[number];
