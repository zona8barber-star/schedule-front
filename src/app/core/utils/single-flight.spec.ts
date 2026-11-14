import { SingleFlight } from './single-flight';

class Actions {
  calls: string[] = [];
  release: () => void = () => undefined;

  @SingleFlight()
  async complete(appointment: { id: string }): Promise<string> {
    this.calls.push(appointment.id);
    await new Promise<void>((resolve) => (this.release = resolve));
    return appointment.id;
  }

  @SingleFlight()
  async save(): Promise<void> {
    this.calls.push('save');
    await Promise.resolve();
  }
}

/** SONDA BUG-025 / BUG-060: a double click must not send the same request twice. */
describe('SingleFlight', () => {
  it('ignores a repeated call while the first is running and returns the same promise', async () => {
    const actions = new Actions();

    const first = actions.complete({ id: 'a-1' });
    const second = actions.complete({ id: 'a-1' });

    expect(second).toBe(first);
    expect(actions.calls).toEqual(['a-1']);
    actions.release();
    await first;
  });

  it('starts the action right away, as without the guard', () => {
    const actions = new Actions();

    void actions.complete({ id: 'a-1' });

    expect(actions.calls).toEqual(['a-1']);
  });

  it('lets another row act at the same time and allows the action again once finished', async () => {
    const actions = new Actions();

    const one = actions.complete({ id: 'a-1' });
    const releaseOne = actions.release;
    const two = actions.complete({ id: 'a-2' });
    expect(actions.calls).toEqual(['a-1', 'a-2']);

    releaseOne();
    actions.release();
    await Promise.all([one, two]);
    await actions.save();
    await actions.save();
    expect(actions.calls).toEqual(['a-1', 'a-2', 'save', 'save']);
  });

  it('keeps instances apart', () => {
    const first = new Actions();
    const second = new Actions();

    void first.complete({ id: 'a-1' });
    void second.complete({ id: 'a-1' });

    expect(first.calls).toEqual(['a-1']);
    expect(second.calls).toEqual(['a-1']);
  });
});
