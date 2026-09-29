// 브라우저 내부 저장소 (IndexedDB) — 자동 저장·기억한 폰트용. 실패해도 앱은 그대로 동작
const DB = 'svgforge';
const STORE = 'kv';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
      rq.onblocked = () => res(null);
    } catch (e) {
      res(null);
    }
  });
  return dbp;
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((res) => {
        if (!db) return res(undefined);
        try {
          const t = db.transaction(STORE, mode);
          const r = fn(t.objectStore(STORE));
          t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
          t.onerror = () => res(undefined);
          t.onabort = () => res(undefined);
        } catch (e) {
          res(undefined);
        }
      })
  );
}

export const kvGet = (k) => tx('readonly', (s) => s.get(k));
export const kvSet = (k, v) => tx('readwrite', (s) => s.put(v, k));
export const kvDel = (k) => tx('readwrite', (s) => s.delete(k));

export function lsGet(k, d = null) {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : v;
  } catch (e) {
    return d;
  }
}
export function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
}
