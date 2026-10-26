import { describe, expect, it } from 'vitest';
import { DEFAULT_FORM } from './form';
import { createSavedRepository, MAX_SAVED, SavedLimitError, withFallback, type KeyValueStore } from './storage';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    keys: async () => Object.keys(data),
    getMany: async (keys) => Object.fromEntries(keys.map((k) => [k, data[k]])),
    set: async (k, v) => {
      data[k] = v;
    },
    remove: async (k) => {
      delete data[k];
    },
  };
}

const form = { ...DEFAULT_FORM, productName: 'Кружка', price: '990', cost: '350' };

describe('saved repository', () => {
  it('сохраняет, читает, обновляет и удаляет расчёт', async () => {
    const repo = createSavedRepository(memoryStore());
    const saved = await repo.save(form, 'Кружка');
    expect((await repo.list()).map((i) => i.name)).toEqual(['Кружка']);

    await repo.save({ ...form, price: '1090' }, 'Кружка XL', saved.id);
    const [updated] = await repo.list();
    expect(updated.id).toBe(saved.id);
    expect(updated.name).toBe('Кружка XL');
    expect(updated.form.price).toBe('1090');

    await repo.remove(saved.id);
    expect(await repo.list()).toEqual([]);
  });

  it('дублирует расчёт', async () => {
    const repo = createSavedRepository(memoryStore());
    const saved = await repo.save(form, 'Кружка');
    const copy = await repo.duplicate(saved);
    expect(copy.id).not.toBe(saved.id);
    expect(copy.name).toBe('Кружка (копия)');
    expect(await repo.list()).toHaveLength(2);
  });

  it(`не даёт сохранить больше ${MAX_SAVED} расчётов`, async () => {
    const repo = createSavedRepository(memoryStore());
    for (let i = 0; i < MAX_SAVED; i++) await repo.save(form, `Товар ${i}`);
    await expect(repo.save(form, 'Лишний')).rejects.toBeInstanceOf(SavedLimitError);
  });

  it('пропускает испорченные записи и чужие ключи', async () => {
    const store = memoryStore({ calc_bad: '{oops', other_key: 'x', calc_ok: JSON.stringify({ name: 'Ок', form }) });
    const list = await createSavedRepository(store).list();
    expect(list.map((i) => i.id)).toEqual(['ok']);
  });

  it('переключается на запасное хранилище при ошибке основного', async () => {
    const broken: KeyValueStore = {
      keys: () => Promise.reject(new Error('down')),
      getMany: () => Promise.reject(new Error('down')),
      set: () => Promise.reject(new Error('down')),
      remove: () => Promise.reject(new Error('down')),
    };
    const fallback = memoryStore();
    const repo = createSavedRepository(withFallback(broken, fallback));
    const origWarn = console.warn;
    console.warn = () => {};
    await repo.save(form, 'Кружка');
    console.warn = origWarn;
    expect(Object.keys(fallback.data)).toHaveLength(1);
  });
});
