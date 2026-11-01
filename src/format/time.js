const PAD = 2;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

// YouTube's own timestamp style: 75 -> "1:15", 3725 -> "1:02:05".
// Kept identical for cue timestamps and video length so a transcript reads as one.
export function clock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const rest = seconds % SECONDS_PER_MINUTE;

  if (hours) {
    return `${hours}:${pad(minutes)}:${pad(rest)}`;
  }

  return `${minutes}:${pad(rest)}`;
}

function pad(value) {
  return String(value).padStart(PAD, '0');
}
