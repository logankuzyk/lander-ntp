export type HandAngles = { hour: number; minute: number; second: number }

/** Clockwise degrees from twelve, including the motion between visible ticks. */
export function handAngles(date: Date): HandAngles {
  const seconds = date.getSeconds()
  const minutes = date.getMinutes()
  const hours = date.getHours() % 12

  return {
    hour: (hours + minutes / 60 + seconds / 3600) * 30,
    minute: (minutes + seconds / 60) * 6,
    second: seconds * 6,
  }
}
