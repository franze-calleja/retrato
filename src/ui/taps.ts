/** Records a tap; triggers when `count` taps land within `windowMs`. */
export function registerTap(times: readonly number[], now: number, count = 5, windowMs = 2000) {
  const recent = [...times.filter((t) => now - t < windowMs), now]
  return recent.length >= count ? { times: [], triggered: true } : { times: recent, triggered: false }
}
