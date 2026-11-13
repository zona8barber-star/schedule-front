/**
 * Test helper: makes the code under test run as if the device were in another timezone.
 *
 * The unit tests run on Node, which applies a change of `process.env.TZ` at once to `Date` and to the default
 * timezone of `Intl`. The CI machine and the developers are in Bogotá, so a spec that only runs there cannot tell
 * Bogotá time from device time (SONDA BUG-030 / BUG-033): those specs force another zone.
 *
 * Usage: `let restore: () => void; beforeAll(() => (restore = setDeviceTimeZone('UTC'))); afterAll(() => restore());`
 */
type NodeLikeGlobal = { process?: { env: Record<string, string | undefined> } };

export function setDeviceTimeZone(timeZone: string): () => void {
  const env = (globalThis as NodeLikeGlobal).process?.env;
  if (!env) {
    throw new Error('The device timezone can only be changed when the tests run on Node.');
  }

  const previous = env['TZ'];
  env['TZ'] = timeZone;

  return () => {
    if (previous === undefined) {
      delete env['TZ'];
    } else {
      env['TZ'] = previous;
    }
  };
}
