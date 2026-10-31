/**
 * 数据访问层（集合级）—— 只负责「存哪里、怎么存」，不含业务规则。
 * 流水按月分片：acc:txn:YYYY-MM，避免每次全量反序列化。
 */
const storage = require('./storage')

const cache = Object.create(null)

const KEYS = {
  meta: 'meta',
  books: 'books',
  cats: 'cats',
  budgets: 'budgets',
  months: 'months',
  wishes: 'wishes'
}

function txnKey(month) {
  return 'txn:' + month
}

function get(key, fallback) {
  if (!(key in cache)) {
    const value = storage.read(key, undefined)
    cache[key] = value === undefined ? fallback : value
  }
  return cache[key]
}

function set(key, value) {
  cache[key] = value
  storage.write(key, value)
  return value
}

function drop(key) {
  delete cache[key]
  storage.remove(key)
}

function clearCache() {
  Object.keys(cache).forEach(function (key) {
    delete cache[key]
  })
}

/* ---------------- meta ---------------- */
function meta() {
  return get(KEYS.meta, null)
}
function setMeta(value) {
  return set(KEYS.meta, value)
}

/* ---------------- books ---------------- */
function books() {
  return get(KEYS.books, [])
}
function setBooks(value) {
  return set(KEYS.books, value || [])
}

/* ---------------- categories ---------------- */
function cats() {
  return get(KEYS.cats, [])
}
function setCats(value) {
  return set(KEYS.cats, value || [])
}

/* ---------------- budgets ---------------- */
function budgets() {
  return get(KEYS.budgets, {})
}
function setBudgets(value) {
  return set(KEYS.budgets, value || {})
}

/* ---------------- months index ---------------- */
function months() {
  return get(KEYS.months, [])
}
function setMonths(value) {
  return set(KEYS.months, value || [])
}

/* ---------------- wishes（购物清单） ---------------- */
function wishes() {
  return get(KEYS.wishes, [])
}
function setWishes(value) {
  return set(KEYS.wishes, value || [])
}

/* ---------------- transactions ---------------- */
function monthTxns(month) {
  return get(txnKey(month), [])
}
function setMonthTxns(month, list) {
  return set(txnKey(month), list || [])
}
function dropMonthTxns(month) {
  drop(txnKey(month))
}

/** 危险操作：清空全部记账数据（保留 meta 可选） */
function wipeAll() {
  const keys = storage.listKeys()
  keys.forEach(function (key) {
    if (key.indexOf(storage.PREFIX) === 0) {
      storage.remove(key.slice(storage.PREFIX.length))
    }
  })
  clearCache()
}

module.exports = {
  meta: meta,
  setMeta: setMeta,
  books: books,
  setBooks: setBooks,
  cats: cats,
  setCats: setCats,
  budgets: budgets,
  setBudgets: setBudgets,
  months: months,
  setMonths: setMonths,
  wishes: wishes,
  setWishes: setWishes,
  monthTxns: monthTxns,
  setMonthTxns: setMonthTxns,
  dropMonthTxns: dropMonthTxns,
  wipeAll: wipeAll,
  clearCache: clearCache,
  txnKey: txnKey
}
