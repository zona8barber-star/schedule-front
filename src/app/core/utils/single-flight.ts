const IN_FLIGHT = Symbol('singleFlightCalls');

type WithFlights = { [IN_FLIGHT]?: Set<string> };

/**
 * SONDA BUG-025 / BUG-060: a double click sent the same request twice (two «Completar», a duplicated customer).
 * Applied to an async action method, a call made while the previous one is still running is ignored and returns
 * that same promise. The key is the instance and the method, plus the `id` of the first argument when it has one,
 * so two different rows can still be acted on at the same time.
 */
export function SingleFlight(): MethodDecorator {
  return (_target, propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    const running = new WeakMap<object, Map<string, Promise<unknown>>>();

    descriptor.value = function (this: object & WithFlights, ...args: unknown[]): Promise<unknown> {
      const first = args[0] as { id?: unknown } | null | undefined;
      const key = `${String(propertyKey)}:${first && typeof first === 'object' && 'id' in first ? String(first.id) : ''}`;
      const calls = running.get(this) ?? new Map<string, Promise<unknown>>();
      running.set(this, calls);

      const current = calls.get(key);
      if (current) {
        return current;
      }

      // Started right away (same timing as without the guard); only the repeated call is skipped.
      const call = Promise.resolve(original.apply(this, args)).finally(() => calls.delete(key));
      calls.set(key, call);
      return call;
    };

    return descriptor;
  };
}
