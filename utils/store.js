/**
 * 业务仓储层：页面只跟它打交道，不直接读 storage。
 * 变更统一通过 bus.emit('change', { scope }) 通知页面刷新。
 */
const db = require('./db')
const bus = require('./bus')
const storage = require('./storage')
const ids = require('./id')
const seed = require('./seed')
const dateUtil = require('./date')
const metrics = require('./metrics')
const migrations = require('./migrations')
const appVersion = require('./version')
const media = require('./media')
const icons = require('./icons')
const money = require('./money')
const csv = require('./csv')

const VERSION = appVersion.VERSION
let ready = false

function emit(scope) {
  bus.emit('change', { scope: scope })
}

/* ================= 初始化 ================= */

function init() {
  if (ready) return
  // 先重建月份索引：迁移和种子逻辑都要用它
  rebuildMonths()
  const meta = db.meta()
  if (!meta) {
    seed.bootstrap()
  } else {
    const version = Number(meta.version) || 0
    if (version < VERSION) {
      migrations.run(version, VERSION)
    }
    // meta 存在但账本丢失（异常退出 / 手工清过 key）时补一次种子，避免白屏
    if (!db.books().length) {
      seed.bootstrap()
    }
  }
  rebuildMonths()
  ready = true
}

/** 从实际存储的 key 重建月份索引，防止索引与数据不一致 */
function rebuildMonths() {
  const keys = storage.listKeys()
  const prefix = 'acc:txn:'
  const months = []
  keys.forEach(function (key) {
    if (key.indexOf(prefix) !== 0) return
    const month = key.slice(prefix.length)
    if (/^\d{4}-\d{2}$/.test(month)) {
      months.push(month)
    }
  })
  months.sort()
  db.setMonths(months)
  return months
}

function isReady() {
  return ready
}

/* ================= 设置 ================= */

function getMeta() {
  return db.meta() || {}
}

function updateMeta(patch) {
  const next = Object.assign({}, getMeta(), patch || {})
  db.setMeta(next)
  emit('meta')
  return next
}

function getStorageInfo() {
  const usage = storage.usage()
  return {
    currentSize: usage.currentSize,
    limitSize: usage.limitSize,
    percent: usage.limitSize ? Math.min(100, Math.round(usage.currentSize * 100 / usage.limitSize)) : 0
  }
}

/* ================= 外观（背景图） ================= */

function getBackground() {
  return getMeta().background || ''
}

function setBackground(path) {
  const previous = getBackground()
  updateMeta({ background: path || '' })
  if (previous && previous !== path) {
    media.removeFile(previous)
  }
  return path || ''
}

function clearBackground() {
  const previous = getBackground()
  updateMeta({ background: '' })
  media.removeFile(previous)
}

/* ================= 账本 ================= */

function sortByOrder(a, b) {
  const oa = a.order === undefined ? 0 : a.order
  const ob = b.order === undefined ? 0 : b.order
  if (oa !== ob) return oa - ob
  return (a.createdAt || 0) - (b.createdAt || 0)
}

function listBooks(includeArchived) {
  const list = db.books().slice().sort(sortByOrder)
  if (includeArchived) return list
  return list.filter(function (book) {
    return !book.archived
  })
}

function getBook(id) {
  const list = db.books()
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i]
  }
  return null
}

function getActiveBookId() {
  const meta = getMeta()
  const current = meta.activeBookId ? getBook(meta.activeBookId) : null
  if (current && !current.archived) return current.id
  const first = listBooks()[0]
  if (!first) return ''
  // 静默写回，不触发 change 事件，避免在 refresh 里递归
  db.setMeta(Object.assign({}, meta, { activeBookId: first.id }))
  return first.id
}

function getActiveBook() {
  return getBook(getActiveBookId())
}

function setActiveBook(id) {
  if (!getBook(id)) return false
  updateMeta({ activeBookId: id })
  return true
}

function createBook(input) {
  const payload = input || {}
  const name = String(payload.name || '').trim()
  if (!name) throw new Error('账本名称不能为空')
  const list = db.books()
  let maxOrder = -1
  list.forEach(function (item) {
    if (Number(item.order) > maxOrder) maxOrder = Number(item.order)
  })
  const book = {
    id: ids.uid('bk'),
    name: name,
    emoji: payload.emoji || '📒',
    iconKey: payload.iconKey || '',
    iconPath: payload.iconPath || '',
    color: payload.color || '#F4A261',
    members: payload.members && payload.members.length ? payload.members.slice() : ['我'],
    archived: false,
    order: maxOrder + 1,
    createdAt: Date.now()
  }
  db.setBooks(list.concat([book]))
  seed.cloneCategories(book.id)
  emit('book')
  return book
}

function updateBook(id, patch) {
  const p = patch || {}
  const current = getBook(id)
  const list = db.books().map(function (book) {
    if (book.id !== id) return book
    const next = Object.assign({}, book, p)
    if (p.name !== undefined) {
      next.name = String(p.name).trim() || book.name
    }
    if (p.iconPath === null) next.iconPath = ''
    return next
  })
  db.setBooks(list)
  const nextBook = getBook(id)
  if (current && p.iconPath !== undefined && current.iconPath &&
    current.iconPath !== (nextBook ? nextBook.iconPath : '')) {
    media.removeFile(current.iconPath)
  }
  emit('book')
  return nextBook
}

function archiveBook(id) {
  if (listBooks().length <= 1) throw new Error('至少保留一个账本')
  updateBook(id, { archived: true })
  if (getMeta().activeBookId === id) {
    const next = listBooks()[0]
    updateMeta({ activeBookId: next ? next.id : '' })
  }
  emit('book')
}

/* ================= 分类 ================= */

/**
 * 读出分类时兜底解析图标。
 * 不依赖历史迁移：只要分类名在映射表里，即使数据里没有 iconKey 也能显示图标。
 */
function withIcon(cat) {
  if (!cat) return cat
  if (cat.iconKey && icons.path(cat.iconKey)) return cat
  const fallback = icons.CATEGORY_ICON_BY_NAME[cat.name]
  if (!fallback) return cat
  return Object.assign({}, cat, { iconKey: fallback })
}

function listCategories(bookId, type) {
  return db.cats()
    .filter(function (cat) {
      return cat.bookId === bookId
    })
    .filter(function (cat) {
      return !type || cat.type === type
    })
    .map(withIcon)
    .sort(sortByOrder)
}

function categoryMap(bookId) {
  const map = Object.create(null)
  const list = db.cats()
  for (let i = 0; i < list.length; i++) {
    if (list[i].bookId === bookId) {
      map[list[i].id] = withIcon(list[i])
    }
  }
  return map
}

function getCategory(id) {
  const list = db.cats()
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return withIcon(list[i])
  }
  return null
}

function createCategory(input) {
  const payload = input || {}
  const name = String(payload.name || '').trim()
  if (!name) throw new Error('分类名称不能为空')
  const type = payload.type === 'income' ? 'income' : 'expense'
  const bookId = payload.bookId || getActiveBookId()
  const siblings = listCategories(bookId, type)
  let maxOrder = -1
  siblings.forEach(function (item) {
    if (Number(item.order) > maxOrder) maxOrder = Number(item.order)
  })
  const cat = {
    id: ids.uid('ct'),
    bookId: bookId,
    name: name,
    emoji: payload.emoji || '📌',
    iconKey: payload.iconKey || '',
    iconPath: payload.iconPath || '',
    type: type,
    color: payload.color || '#8A8A8A',
    order: maxOrder + 1,
    builtin: false,
    createdAt: Date.now()
  }
  db.setCats(db.cats().concat([cat]))
  emit('category')
  return cat
}

function updateCategory(id, patch) {
  const p = patch || {}
  const current = getCategory(id)
  const list = db.cats().map(function (cat) {
    if (cat.id !== id) return cat
    const next = Object.assign({}, cat, p)
    if (p.name !== undefined) {
      next.name = String(p.name).trim() || cat.name
    }
    if (p.iconPath === null) next.iconPath = ''
    return next
  })
  db.setCats(list)
  const nextCat = getCategory(id)
  if (current && p.iconPath !== undefined && current.iconPath &&
    current.iconPath !== (nextCat ? nextCat.iconPath : '')) {
    media.removeFile(current.iconPath)
  }
  emit('category')
  return nextCat
}

function countTxnByCategory(categoryId) {
  let count = 0
  const months = db.months()
  months.forEach(function (month) {
    db.monthTxns(month).forEach(function (txn) {
      if (!txn.deleted && txn.categoryId === categoryId) count += 1
    })
  })
  return count
}

function deleteCategory(id) {
  const used = countTxnByCategory(id)
  if (used > 0) {
    throw new Error('这个分类下还有 ' + used + ' 笔记录，先改掉它们再删')
  }
  const target = getCategory(id)
  db.setCats(db.cats().filter(function (cat) {
    return cat.id !== id
  }))
  if (target) {
    media.removeFile(target.iconPath)
  }
  emit('category')
}

function moveCategory(id, direction) {
  const cat = getCategory(id)
  if (!cat) return
  const siblings = listCategories(cat.bookId, cat.type)
  let index = -1
  for (let i = 0; i < siblings.length; i++) {
    if (siblings[i].id === id) index = i
  }
  const target = index + (direction > 0 ? 1 : -1)
  if (index < 0 || target < 0 || target >= siblings.length) return
  const a = siblings[index]
  const b = siblings[target]
  db.setCats(db.cats().map(function (item) {
    if (item.id === a.id) return Object.assign({}, item, { order: b.order })
    if (item.id === b.id) return Object.assign({}, item, { order: a.order })
    return item
  }))
  emit('category')
}

/* ================= 流水 ================= */

function sortTxnsDesc(list) {
  return list.slice().sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    const timeA = a.time || ''
    const timeB = b.time || ''
    if (timeA !== timeB) return timeA < timeB ? 1 : -1
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
}

function addMonthIndex(month) {
  const months = db.months()
  if (months.indexOf(month) < 0) {
    db.setMonths(months.concat([month]).sort())
  }
}

function cleanupMonth(month) {
  const alive = db.monthTxns(month).filter(function (txn) {
    return !txn.deleted
  })
  if (alive.length === 0) {
    db.dropMonthTxns(month)
    db.setMonths(db.months().filter(function (item) {
      return item !== month
    }))
  }
}

/**
 * 查询流水
 * @param {Object} query { bookId, month, type, categoryId, member, from, to, keyword }
 */
function listTxns(query) {
  const q = query || {}
  const months = q.month ? [q.month] : db.months()
  const out = []
  months.forEach(function (month) {
    const shard = db.monthTxns(month)
    for (let i = 0; i < shard.length; i++) {
      const txn = shard[i]
      if (txn.deleted) continue
      if (q.bookId && txn.bookId !== q.bookId) continue
      if (q.month && txn.date.slice(0, 7) !== q.month) continue
      if (q.type && txn.type !== q.type) continue
      if (q.categoryId && txn.categoryId !== q.categoryId) continue
      if (q.member && txn.member !== q.member) continue
      if (q.from && txn.date < q.from) continue
      if (q.to && txn.date > q.to) continue
      if (q.keyword) {
        const keyword = String(q.keyword).toLowerCase()
        if ((txn.note || '').toLowerCase().indexOf(keyword) < 0) continue
      }
      out.push(txn)
    }
  })
  return sortTxnsDesc(out)
}

function findTxn(id) {
  const months = db.months().slice().reverse()
  for (let i = 0; i < months.length; i++) {
    const shard = db.monthTxns(months[i])
    for (let j = 0; j < shard.length; j++) {
      if (shard[j].id === id) {
        return { txn: shard[j], month: months[i] }
      }
    }
  }
  return null
}

function getTxn(id) {
  const found = findTxn(id)
  return found ? found.txn : null
}

function addTxn(payload) {
  const p = payload || {}
  const amountCents = Math.round(Number(p.amountCents) || 0)
  if (amountCents <= 0) throw new Error('金额必须大于 0')
  const date = p.date || dateUtil.todayStr()
  const month = date.slice(0, 7)
  const txn = {
    id: ids.uid('tx'),
    bookId: p.bookId || getActiveBookId(),
    type: p.type === 'income' ? 'income' : 'expense',
    amountCents: amountCents,
    categoryId: p.categoryId || '',
    date: date,
    time: dateUtil.normalizeTime(p.time) || dateUtil.nowTime(),
    note: String(p.note || '').slice(0, 50),
    member: p.member || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deleted: false
  }
  db.setMonthTxns(month, sortTxnsDesc(db.monthTxns(month).concat([txn])))
  addMonthIndex(month)
  emit('txn')
  return txn
}

function updateTxn(id, patch) {
  const found = findTxn(id)
  if (!found) return null
  const p = patch || {}
  const oldMonth = found.month
  const next = Object.assign({}, found.txn)
  Object.keys(p).forEach(function (key) {
    if (key === 'id' || key === 'createdAt' || key === 'bookId') return
    next[key] = p[key]
  })
  if (p.amountCents !== undefined) {
    const cents = Math.round(Number(p.amountCents) || 0)
    if (cents <= 0) throw new Error('金额必须大于 0')
    next.amountCents = cents
  }
  if (p.note !== undefined) {
    next.note = String(p.note || '').slice(0, 50)
  }
  if (p.time !== undefined) {
    const normalized = dateUtil.normalizeTime(p.time)
    if (normalized) next.time = normalized
  }
  next.updatedAt = Date.now()
  const newMonth = String(next.date).slice(0, 7)
  if (newMonth === oldMonth) {
    db.setMonthTxns(oldMonth, sortTxnsDesc(db.monthTxns(oldMonth).map(function (txn) {
      return txn.id === id ? next : txn
    })))
  } else {
    db.setMonthTxns(oldMonth, sortTxnsDesc(db.monthTxns(oldMonth).filter(function (txn) {
      return txn.id !== id
    })))
    db.setMonthTxns(newMonth, sortTxnsDesc(db.monthTxns(newMonth).concat([next])))
    addMonthIndex(newMonth)
    cleanupMonth(oldMonth)
  }
  emit('txn')
  return next
}

function deleteTxn(id) {
  const found = findTxn(id)
  if (!found) return false
  const month = found.month
  db.setMonthTxns(month, db.monthTxns(month).map(function (txn) {
    if (txn.id !== id) return txn
    return Object.assign({}, txn, { deleted: true, updatedAt: Date.now() })
  }))
  cleanupMonth(month)
  emit('txn')
  return true
}

function countTxns(query) {
  return listTxns(query || {}).length
}

/* ================= 汇总 ================= */

function monthSummary(query) {
  const q = query || {}
  return metrics.summarize(listTxns({ bookId: q.bookId, month: q.month, member: q.member }))
}

function categoryStats(query) {
  const q = query || {}
  const txns = listTxns({ bookId: q.bookId, month: q.month, member: q.member })
  return metrics.categoryStats({
    txns: txns,
    categories: categoryMap(q.bookId),
    type: q.type
  })
}

function yearTrend(query) {
  const q = query || {}
  const months = dateUtil.monthsOfYear(q.year)
  return months.map(function (month) {
    const summary = monthSummary({ bookId: q.bookId, month: month })
    return { month: month, expense: summary.expense, income: summary.income }
  })
}

/* ================= 预算 ================= */

function budgetKey(bookId, month) {
  return month + '|' + bookId
}

function getBudget(bookId, month) {
  const all = db.budgets()
  const direct = all[budgetKey(bookId, month)]
  if (direct) return direct
  if (!getMeta().carryBudget) return null
  let cursor = dateUtil.shiftMonth(month, -1)
  for (let i = 0; i < 12; i++) {
    const prev = all[budgetKey(bookId, cursor)]
    if (prev) return prev
    cursor = dateUtil.shiftMonth(cursor, -1)
  }
  return null
}

function setBudget(bookId, month, budget) {
  const all = Object.assign({}, db.budgets())
  all[budgetKey(bookId, month)] = budget
  db.setBudgets(all)
  emit('budget')
}

function clearBudget(bookId, month) {
  const all = Object.assign({}, db.budgets())
  delete all[budgetKey(bookId, month)]
  db.setBudgets(all)
  emit('budget')
}

/* ================= 记账人 ================= */

function listMembers(bookId) {
  const book = getBook(bookId)
  return book && book.members ? book.members.slice() : []
}

function addMember(bookId, name) {
  const value = String(name || '').trim()
  if (!value) throw new Error('名字不能为空')
  const book = getBook(bookId)
  if (!book) return null
  const members = (book.members || []).slice()
  if (members.indexOf(value) >= 0) throw new Error('已经有同名成员了')
  members.push(value)
  return updateBook(bookId, { members: members })
}

function removeMember(bookId, name) {
  const book = getBook(bookId)
  if (!book) return null
  if ((book.members || []).length <= 1) throw new Error('至少保留一个记账人')
  const members = (book.members || []).filter(function (item) {
    return item !== name
  })
  return updateBook(bookId, { members: members })
}

/* ================= 购物清单 ================= */

/** 老数据没有这些字段，读出来时补默认值 */
function withWish(item) {
  if (!item) return item
  return Object.assign({
    priceCents: 0,
    note: '',
    imagePath: '',
    tag: '',
    priority: 1,
    done: false,
    doneAt: 0
  }, item)
}

function listWishes() {
  const pending = []
  const bought = []
  db.wishes().forEach(function (item) {
    const wish = withWish(item)
    if (wish.done) {
      bought.push(wish)
    } else {
      pending.push(wish)
    }
  })

  // 待买：想要程度高的在前，同档按添加时间倒序
  pending.sort(function (a, b) {
    const pa = Number(a.priority) || 1
    const pb = Number(b.priority) || 1
    if (pa !== pb) return pb - pa
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
  // 已买到：最近买到的在前
  bought.sort(function (a, b) {
    return (b.doneAt || 0) - (a.doneAt || 0)
  })

  return pending.concat(bought)
}

function getWish(id) {
  const list = db.wishes()
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return withWish(list[i])
  }
  return null
}

function addWish(payload) {
  const p = payload || {}
  const name = String(p.name || '').trim()
  if (!name) throw new Error('先给它起个名字')
  const priority = Math.min(3, Math.max(1, Number(p.priority) || 1))
  const wish = {
    id: ids.uid('wi'),
    name: name.slice(0, 30),
    priceCents: Math.max(0, Math.round(Number(p.priceCents) || 0)),
    note: String(p.note || '').slice(0, 60),
    imagePath: p.imagePath || '',
    tag: String(p.tag || '').slice(0, 6),
    priority: priority,
    done: false,
    doneAt: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  db.setWishes(db.wishes().concat([wish]))
  emit('wish')
  return wish
}

function updateWish(id, patch) {
  const p = patch || {}
  const list = db.wishes().map(function (item) {
    if (item.id !== id) return item
    const next = Object.assign({}, item, p)
    if (p.name !== undefined) {
      next.name = String(p.name).trim().slice(0, 30) || item.name
    }
    if (p.priceCents !== undefined) {
      next.priceCents = Math.max(0, Math.round(Number(p.priceCents) || 0))
    }
    if (p.note !== undefined) {
      next.note = String(p.note || '').slice(0, 60)
    }
    if (p.tag !== undefined) {
      next.tag = String(p.tag || '').slice(0, 6)
    }
    if (p.priority !== undefined) {
      next.priority = Math.min(3, Math.max(1, Number(p.priority) || 1))
    }
    if (p.imagePath !== undefined) {
      next.imagePath = p.imagePath || ''
    }
    next.updatedAt = Date.now()
    return next
  })
  db.setWishes(list)
  emit('wish')
  return getWish(id)
}

function toggleWish(id) {
  const list = db.wishes().map(function (item) {
    if (item.id !== id) return item
    const done = !item.done
    return Object.assign({}, item, {
      done: done,
      doneAt: done ? Date.now() : 0,
      updatedAt: Date.now()
    })
  })
  db.setWishes(list)
  emit('wish')
  return getWish(id)
}

function removeWish(id) {
  db.setWishes(db.wishes().filter(function (item) {
    return item.id !== id
  }))
  emit('wish')
}

function wishSummary() {
  const list = db.wishes()
  let pendingCents = 0
  let pendingCount = 0
  let boughtCents = 0
  let boughtCount = 0
  list.forEach(function (item) {
    const cents = Number(item.priceCents) || 0
    if (item.done) {
      boughtCount += 1
      boughtCents += cents
      return
    }
    pendingCount += 1
    pendingCents += cents
  })
  return {
    pendingCents: pendingCents,
    pendingCount: pendingCount,
    boughtCents: boughtCents,
    boughtCount: boughtCount,
    total: list.length
  }
}

/** 每月能存多少钱（单位：分）；0 表示还没设置 */
function getWishMonthly() {
  return Math.max(0, Math.round(Number(getMeta().wishMonthlyCents) || 0))
}

function setWishMonthly(cents) {
  updateMeta({ wishMonthlyCents: Math.max(0, Math.round(Number(cents) || 0)) })
}

/* ================= 导入导出 ================= */

/** 一条流水的去重指纹 */
function txnFingerprint(txn) {
  return [
    txn.bookId, txn.date, txn.time || '', txn.type,
    txn.amountCents, txn.categoryId, txn.note || ''
  ].join('|')
}

function cellAt(cells, index) {
  if (index < 0) return ''
  const value = cells[index]
  return value === undefined || value === null ? '' : String(value)
}

function findHeader(header, names) {
  for (let i = 0; i < header.length; i++) {
    for (let j = 0; j < names.length; j++) {
      if (header[i] === names[j]) return i
    }
  }
  return -1
}

/** 账本按名字匹配，没有就新建 */
function ensureBook(name) {
  if (!name) return getActiveBookId()
  const books = listBooks()
  for (let i = 0; i < books.length; i++) {
    if (books[i].name === name) return books[i].id
  }
  const book = createBook({ name: name })
  return book.id
}

/** 分类按「账本 + 类型 + 名字」匹配，没有就新建 */
function ensureCategory(bookId, type, name) {
  const cats = listCategories(bookId, type)
  for (let i = 0; i < cats.length; i++) {
    if (cats[i].name === name) return cats[i].id
  }
  const cat = createCategory({ name: name, type: type, bookId: bookId })
  return cat.id
}

/**
 * 导入 CSV。认本程序导出的列名，也兼容「日期 / 金额」这种大致能对上的表。
 * 相同的流水（账本+日期+时间+类型+金额+分类+备注）会跳过，所以重复导入不会翻倍。
 */
function importCsv(text) {
  const rows = csv.parse(text)
  if (rows.length < 2) throw new Error('没有解析到数据行')

  const header = rows[0].map(function (cell) {
    return String(cell).trim()
  })
  const index = {
    book: findHeader(header, ['账本', 'book']),
    date: findHeader(header, ['日期', 'date']),
    time: findHeader(header, ['时间', 'time']),
    type: findHeader(header, ['类型', 'type']),
    category: findHeader(header, ['分类', 'category']),
    amount: findHeader(header, ['金额(元)', '金额（元）', '金额', 'amount']),
    member: findHeader(header, ['记账人', 'member']),
    note: findHeader(header, ['备注', 'note'])
  }

  if (index.date < 0 || index.amount < 0) {
    throw new Error('表头里缺少「日期」或「金额(元)」列')
  }

  const seen = Object.create(null)
  db.months().forEach(function (month) {
    db.monthTxns(month).forEach(function (txn) {
      if (txn.deleted) return
      seen[txnFingerprint(txn)] = true
    })
  })

  let created = 0
  let skipped = 0

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
    const date = csv.parseDate(cellAt(cells, index.date))
    const cents = money.toCents(cellAt(cells, index.amount))
    if (!date || isNaN(cents) || cents <= 0) {
      skipped += 1
      continue
    }

    const type = /收/.test(cellAt(cells, index.type)) ? 'income' : 'expense'
    const bookId = ensureBook(cellAt(cells, index.book).trim())
    const categoryId = ensureCategory(bookId, type, cellAt(cells, index.category).trim() || '其他')
    const time = csv.parseTime(cellAt(cells, index.time))
    const note = cellAt(cells, index.note).slice(0, 50)
    const member = cellAt(cells, index.member).slice(0, 10)

    const key = [bookId, date, time, type, cents, categoryId, note].join('|')
    if (seen[key]) {
      skipped += 1
      continue
    }

    addTxn({
      bookId: bookId,
      type: type,
      amountCents: cents,
      categoryId: categoryId,
      date: date,
      time: time || undefined,
      note: note,
      member: member
    })
    seen[key] = true
    created += 1
  }

  return { created: created, skipped: skipped }
}

/**
 * 按条件取导出用的行，跨账本按时间正序合并。
 * options: { scope: 'book' | 'all', from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', categoryNames: [] }
 * 分类按「名字」过滤，这样跨账本合并时同一个分类能对上。
 */
function queryForExport(options) {
  const opts = options || {}
  const books = opts.scope === 'all' ? listBooks() : [getActiveBook()]
  const names = opts.categoryNames || []
  const rows = []

  books.forEach(function (book) {
    if (!book) return
    const catMap = categoryMap(book.id)
    const txns = listTxns({
      bookId: book.id,
      from: opts.from || '',
      to: opts.to || ''
    })
    txns.forEach(function (txn) {
      const cat = catMap[txn.categoryId]
      const name = cat ? cat.name : '未分类'
      if (names.length && names.indexOf(name) < 0) return
      rows.push({
        book: book.name,
        date: txn.date,
        time: txn.time || '',
        type: txn.type,
        category: name,
        amountCents: txn.amountCents,
        member: txn.member || '',
        note: txn.note || ''
      })
    })
  })

  rows.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.time !== b.time) return a.time < b.time ? -1 : 1
    return 0
  })
  return rows
}

function exportAll() {
  const txns = {}
  db.months().forEach(function (month) {
    txns[month] = db.monthTxns(month)
  })
  return {
    app: 'mini-account-book',
    version: VERSION,
    exportedAt: new Date().toISOString(),
    meta: getMeta(),
    books: db.books(),
    categories: db.cats(),
    budgets: db.budgets(),
    wishes: db.wishes(),
    txns: txns
  }
}

function replaceImport(data) {
  const incomingMonths = Object.keys(data.txns || {})
  db.months().forEach(function (month) {
    if (incomingMonths.indexOf(month) < 0) {
      db.dropMonthTxns(month)
    }
  })
  db.setBooks(data.books || [])
  db.setCats(data.categories || [])
  db.setBudgets(data.budgets || {})
  db.setWishes(data.wishes || [])
  incomingMonths.forEach(function (month) {
    db.setMonthTxns(month, data.txns[month] || [])
  })
  db.setMeta(Object.assign({}, data.meta || {}, { version: VERSION }))
}

function mergeImport(data) {
  const bookIds = Object.create(null)
  db.books().forEach(function (book) {
    bookIds[book.id] = true
  })
  db.setBooks(db.books().concat((data.books || []).filter(function (book) {
    return !bookIds[book.id]
  })))

  const catIds = Object.create(null)
  db.cats().forEach(function (cat) {
    catIds[cat.id] = true
  })
  db.setCats(db.cats().concat((data.categories || []).filter(function (cat) {
    return !catIds[cat.id]
  })))

  const monthSet = Object.create(null)
  db.months().forEach(function (month) {
    monthSet[month] = true
  })
  Object.keys(data.txns || {}).forEach(function (month) {
    const existing = db.monthTxns(month)
    const incoming = (data.txns[month] || []).filter(function (txn) {
      for (let i = 0; i < existing.length; i++) {
        if (existing[i].id === txn.id) return false
      }
      return true
    })
    if (incoming.length) {
      db.setMonthTxns(month, sortTxnsDesc(existing.concat(incoming)))
      monthSet[month] = true
    }
  })
  db.setMonths(Object.keys(monthSet).sort())
  db.setBudgets(Object.assign({}, data.budgets || {}, db.budgets()))

  const wishIds = Object.create(null)
  db.wishes().forEach(function (item) {
    wishIds[item.id] = true
  })
  db.setWishes(db.wishes().concat((data.wishes || []).filter(function (item) {
    return !wishIds[item.id]
  })))
}

/**
 * 导入备份
 * @param {String|Object} payload JSON 字符串或对象
 * @param {String} mode 'replace' | 'merge'
 */
/**
 * 备份里只存了图片路径，换设备导入后文件并不存在，
 * 这里把指向不存在文件的引用清掉，避免列表里出现裂图。
 */
function sanitizeMediaRefs() {
  function usable(path) {
    if (!path) return true
    if (!media.isManaged(path)) return true
    try {
      wx.getFileSystemManager().accessSync(path)
      return true
    } catch (err) {
      return false
    }
  }

  const cats = db.cats().map(function (cat) {
    if (usable(cat.iconPath)) return cat
    return Object.assign({}, cat, { iconPath: '' })
  })
  db.setCats(cats)

  const books = db.books().map(function (book) {
    if (usable(book.iconPath)) return book
    return Object.assign({}, book, { iconPath: '' })
  })
  db.setBooks(books)

  const meta = getMeta()
  if (meta.background && !usable(meta.background)) {
    db.setMeta(Object.assign({}, meta, { background: '' }))
  }
}

function importAll(payload, mode) {
  let data = payload
  if (typeof payload === 'string') {
    try {
      data = JSON.parse(payload)
    } catch (err) {
      throw new Error('不是合法的 JSON 文本')
    }
  }
  if (!data || !data.books || !data.categories || !data.txns) {
    throw new Error('备份内容不完整')
  }
  if (Number(data.version) > VERSION) {
    throw new Error('备份来自更高版本，请先升级小程序')
  }
  if (mode === 'merge') {
    mergeImport(data)
  } else {
    replaceImport(data)
  }
  ready = false
  init()
  // 老备份（v1）里的流水没有 time，导入后补齐
  migrations.backfillTime()
  migrations.backfillIcons()
  migrations.backfillBookIcons()
  migrations.reconcileBuiltinCategories()
  sanitizeMediaRefs()
  emit('data')
  return data
}

function clearAll() {
  db.wipeAll()
  media.removeAllUploads()
  ready = false
  seed.bootstrap()
  rebuildMonths()
  ready = true
  emit('data')
}

module.exports = {
  VERSION: VERSION,
  init: init,
  isReady: isReady,
  rebuildMonths: rebuildMonths,
  getStorageInfo: getStorageInfo,
  getBackground: getBackground,
  setBackground: setBackground,
  clearBackground: clearBackground,
  getMeta: getMeta,
  updateMeta: updateMeta,
  listBooks: listBooks,
  getBook: getBook,
  getActiveBookId: getActiveBookId,
  getActiveBook: getActiveBook,
  setActiveBook: setActiveBook,
  createBook: createBook,
  updateBook: updateBook,
  archiveBook: archiveBook,
  listCategories: listCategories,
  categoryMap: categoryMap,
  getCategory: getCategory,
  createCategory: createCategory,
  updateCategory: updateCategory,
  deleteCategory: deleteCategory,
  moveCategory: moveCategory,
  countTxnByCategory: countTxnByCategory,
  listTxns: listTxns,
  findTxn: findTxn,
  getTxn: getTxn,
  addTxn: addTxn,
  updateTxn: updateTxn,
  deleteTxn: deleteTxn,
  countTxns: countTxns,
  monthSummary: monthSummary,
  categoryStats: categoryStats,
  yearTrend: yearTrend,
  getBudget: getBudget,
  setBudget: setBudget,
  clearBudget: clearBudget,
  listMembers: listMembers,
  addMember: addMember,
  removeMember: removeMember,
  listWishes: listWishes,
  getWish: getWish,
  addWish: addWish,
  updateWish: updateWish,
  toggleWish: toggleWish,
  removeWish: removeWish,
  wishSummary: wishSummary,
  getWishMonthly: getWishMonthly,
  setWishMonthly: setWishMonthly,
  exportAll: exportAll,
  queryForExport: queryForExport,
  importCsv: importCsv,
  importAll: importAll,
  clearAll: clearAll
}
