/**
 * Хранение сохранённых расчётов.
 *
 * Внутри Telegram — CloudStorage (данные привязаны к пользователю и
 * доступны с любого устройства), в браузере или при ошибке — localStorage.
 * Каждый расчёт хранится в отдельном ключе: у CloudStorage лимит
 * 4096 символов на значение, и 20 расчётов в один ключ не поместятся.
 */
import { normalizeForm, PRODUCT_NAME_MAX, type CalcForm } from './form';
import { getCloudStorage, type TelegramCloudStorage } from './telegram';

export const MAX_SAVED = 20;
const KEY_PREFIX = 'calc_';

export interface SavedCalc {
  id: string;
  name: string;
  form: CalcForm;
  createdAt: number;
  updatedAt: number;
}

/** Минимальный асинхронный key-value интерфейс над любым хранилищем. */
export interface KeyValueStore {
  keys(): Promise<string[]>;
  getMany(keys: string[]): Promise<Record<string, string | undefined>>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class SavedLimitError extends Error {
  constructor() {
    super(`Можно сохранить до ${MAX_SAVED} расчётов. Удалите ненужные и попробуйте снова.`);
    this.name = 'SavedLimitError';
  }
}

function promisify<T>(call: (cb: (error: string | null, result?: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    call((error, result) => (error ? reject(new Error(error)) : resolve(result as T)));
  });
}

export function cloudStore(cloud: TelegramCloudStorage): KeyValueStore {
  return {
    keys: () => promisify<string[]>((cb) => cloud.getKeys(cb)),
    getMany: (keys) =>
      keys.length === 0
        ? Promise.resolve({})
        : promisify<Record<string, string>>((cb) => cloud.getItems(keys, cb)),
    set: (key, value) => promisify<boolean>((cb) => cloud.setItem(key, value, cb)).then(() => undefined),
    remove: (key) => promisify<boolean>((cb) => cloud.removeItem(key, cb)).then(() => undefined),
  };
}

export function localStore(storage: Storage = window.localStorage): KeyValueStore {
  return {
    async keys() {
      const result: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key !== null) result.push(key);
      }
      return result;
    },
    async getMany(keys) {
      return Object.fromEntries(keys.map((k) => [k, storage.getItem(k) ?? undefined]));
    },
    async set(key, value) {
      storage.setItem(key, value);
    },
    async remove(key) {
      storage.removeItem(key);
    },
  };
}

/** Пробует основное хранилище, при ошибке переключается на запасное. */
export function withFallback(primary: KeyValueStore, fallback: KeyValueStore): KeyValueStore {
  let active = primary;
  const run = async <T>(op: (s: KeyValueStore) => Promise<T>): Promise<T> => {
    try {
      return await op(active);
    } catch (error) {
      if (active === fallback) throw error;
      console.warn('CloudStorage недоступен, используем localStorage', error);
      active = fallback;
      return op(active);
    }
  };
  return {
    keys: () => run((s) => s.keys()),
    getMany: (keys) => run((s) => s.getMany(keys)),
    set: (key, value) => run((s) => s.set(key, value)),
    remove: (key) => run((s) => s.remove(key)),
  };
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function parseSaved(id: string, raw: string | undefined): SavedCalc | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SavedCalc>;
    const createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
    return {
      id,
      name: typeof data.name === 'string' && data.name.trim() ? data.name : 'Без названия',
      form: normalizeForm(data.form),
      createdAt,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : createdAt,
    };
  } catch {
    return null;
  }
}

export function createSavedRepository(store: KeyValueStore) {
  async function list(): Promise<SavedCalc[]> {
    const keys = (await store.keys()).filter((k) => k.startsWith(KEY_PREFIX));
    const values = await store.getMany(keys);
    return keys
      .map((key) => parseSaved(key.slice(KEY_PREFIX.length), values[key]))
      .filter((item): item is SavedCalc => item !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async function write(item: SavedCalc): Promise<SavedCalc> {
    const { id, ...data } = item;
    await store.set(KEY_PREFIX + id, JSON.stringify(data));
    return item;
  }

  async function ensureCapacity(): Promise<void> {
    const count = (await store.keys()).filter((k) => k.startsWith(KEY_PREFIX)).length;
    if (count >= MAX_SAVED) throw new SavedLimitError();
  }

  return {
    list,

    /** Создаёт новый расчёт или обновляет существующий, если передан id. */
    async save(form: CalcForm, name: string, id?: string): Promise<SavedCalc> {
      const now = Date.now();
      const cleanName = name.trim().slice(0, PRODUCT_NAME_MAX) || 'Без названия';
      if (id) {
        const existing = (await list()).find((item) => item.id === id);
        if (existing) {
          return write({ ...existing, name: cleanName, form: { ...form }, updatedAt: now });
        }
      }
      await ensureCapacity();
      return write({ id: newId(), name: cleanName, form: { ...form }, createdAt: now, updatedAt: now });
    },

    async duplicate(item: SavedCalc): Promise<SavedCalc> {
      await ensureCapacity();
      const now = Date.now();
      const name = `${item.name} (копия)`.slice(0, PRODUCT_NAME_MAX);
      return write({ id: newId(), name, form: { ...item.form, productName: name }, createdAt: now, updatedAt: now });
    },

    async remove(id: string): Promise<void> {
      await store.remove(KEY_PREFIX + id);
    },
  };
}

export type SavedRepository = ReturnType<typeof createSavedRepository>;

let repository: SavedRepository | undefined;

/** Репозиторий для приложения: CloudStorage в Telegram, иначе localStorage. */
export function getSavedRepository(): SavedRepository {
  if (!repository) {
    const cloud = getCloudStorage();
    const local = localStore();
    repository = createSavedRepository(cloud ? withFallback(cloudStore(cloud), local) : local);
  }
  return repository;
}
