import { PREVIEW_DB_NAME, PREVIEW_DB_VERSION, PREVIEW_SEED_VERSION } from "@/shared/config/preview";

type PreviewStoreName = "users" | "posts" | "drafts" | "tags" | "chats" | "messages" | "meta" | "profiles";

const STORE_NAMES: PreviewStoreName[] = ["users", "posts", "drafts", "tags", "chats", "messages", "meta", "profiles"];

function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

class MemoryFallback {
  private stores = new Map<PreviewStoreName, Map<string, unknown>>();

  constructor() {
    STORE_NAMES.forEach((name) => this.stores.set(name, new Map()));
  }

  async get<T>(store: PreviewStoreName, key: string): Promise<T | undefined> {
    return this.stores.get(store)?.get(key) as T | undefined;
  }

  async getAll<T>(store: PreviewStoreName): Promise<T[]> {
    const map = this.stores.get(store);
    return map ? (Array.from(map.values()) as T[]) : [];
  }

  async put<T extends { id?: string; key?: string }>(
    store: PreviewStoreName,
    value: T,
  ): Promise<void> {
    const key = (value as { id?: string }).id ?? (value as { key?: string }).key;
    if (!key) return;
    this.stores.get(store)?.set(key, value);
  }

  async putWithKey(store: PreviewStoreName, key: string, value: unknown): Promise<void> {
    this.stores.get(store)?.set(key, value);
  }

  async delete(store: PreviewStoreName, key: string): Promise<void> {
    this.stores.get(store)?.delete(key);
  }

  async clear(store: PreviewStoreName): Promise<void> {
    this.stores.get(store)?.clear();
  }
}

const memoryFallback = new MemoryFallback();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PREVIEW_DB_NAME, PREVIEW_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("users")) {
        db.createObjectStore("users", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("posts")) {
        db.createObjectStore("posts", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("drafts")) {
        db.createObjectStore("drafts", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("tags")) {
        db.createObjectStore("tags", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("chats")) {
        db.createObjectStore("chats", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("messages")) {
        db.createObjectStore("messages", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("profiles")) {
        db.createObjectStore("profiles", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: PreviewStoreName,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  if (!isIndexedDBAvailable()) return undefined;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let request: IDBRequest | undefined;
    try {
      const result = callback(store);
      if (result && "onsuccess" in result) request = result as IDBRequest;
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      if (request) resolve(request.result as T);
      else resolve(undefined);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export const previewDB = {
  async get<T>(store: PreviewStoreName, key: string): Promise<T | undefined> {
    if (!isIndexedDBAvailable()) return memoryFallback.get<T>(store, key);
    try {
      return await withStore<T>(store, "readonly", (s) => s.get(key));
    } catch {
      return memoryFallback.get<T>(store, key);
    }
  },

  async getAll<T>(store: PreviewStoreName): Promise<T[]> {
    if (!isIndexedDBAvailable()) return memoryFallback.getAll<T>(store);
    try {
      const result = await withStore<T[]>(store, "readonly", (s) => s.getAll());
      return result ?? [];
    } catch {
      return memoryFallback.getAll<T>(store);
    }
  },

  async put<T extends { id?: string; key?: string }>(
    store: PreviewStoreName,
    value: T,
  ): Promise<void> {
    if (!isIndexedDBAvailable()) return memoryFallback.put(store, value);
    const key = (value as { id?: string }).id ?? (value as { key?: string }).key;
    if (!key) return;
    try {
      await withStore(store, "readwrite", (s) => s.put(value));
    } catch {
      await memoryFallback.put(store, value);
    }
  },

  async putWithKey(store: PreviewStoreName, key: string, value: unknown): Promise<void> {
    if (!isIndexedDBAvailable()) return memoryFallback.putWithKey(store, key, value);
    try {
      await withStore(store, "readwrite", (s) => s.put({ key, value } as unknown as never));
    } catch {
      await memoryFallback.putWithKey(store, key, value);
    }
  },

  async delete(store: PreviewStoreName, key: string): Promise<void> {
    if (!isIndexedDBAvailable()) return memoryFallback.delete(store, key);
    try {
      await withStore(store, "readwrite", (s) => s.delete(key));
    } catch {
      await memoryFallback.delete(store, key);
    }
  },

  async getMeta(key: string): Promise<unknown | undefined> {
    const record = await previewDB.get<{ key: string; value: unknown }>("meta", key);
    return record?.value;
  },

  async setMeta(key: string, value: unknown): Promise<void> {
    await previewDB.put("meta", { key, value });
  },

  async isSeeded(): Promise<boolean> {
    const version = await previewDB.getMeta("seedVersion");
    return version === PREVIEW_SEED_VERSION;
  },
};
