// Tiny IndexedDB key-value store. Bibles and embeddings are too big for localStorage.
const open = (): Promise<IDBDatabase> =>
  new Promise((res, rej) => {
    const r = indexedDB.open('scriptureflow', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('kv')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })

export async function get<T>(key: string): Promise<T | undefined> {
  const db = await open()
  return new Promise((res, rej) => {
    const q = db.transaction('kv').objectStore('kv').get(key)
    q.onsuccess = () => res(q.result as T | undefined)
    q.onerror = () => rej(q.error)
  })
}

export async function set(key: string, value: unknown): Promise<void> {
  const db = await open()
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite')
    tx.objectStore('kv').put(value, key)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}

export async function del(key: string): Promise<void> {
  const db = await open()
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite')
    tx.objectStore('kv').delete(key)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}
