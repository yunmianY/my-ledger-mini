/**
 * 数据迁移：steps[n-1] 负责把数据升到第 n 版。
 * 以后加字段（比如流水加「标签」）时：
 *   1. 在 steps 末尾 push 一个 step
 *   2. 把 version.js 里的 VERSION +1（必须与 steps.length 一致）
 */
const db = require('./db')
const dateUtil = require('./date')
const appVersion = require('./version')
const ids = require('./id')
const icons = require('./icons')

const steps = [
  function toV1() {
    const meta = db.meta() || {}
    db.setMeta(Object.assign({
      currency: 'CNY',
      carryBudget: true,
      activeBookId: ''
    }, meta, { version: 1 }))
  },

  // v2：流水新增 time 字段（HH:mm）；老数据按 createdAt 回填
  function toV2() {
    backfillTime()
  },

  // v3：分类新增 iconKey（内置图标），并给每个账本补「饮品」「通讯」
  function toV3() {
    backfillIcons()
  },

  // v4：图标换成 PNG 套图，补齐其余分类的 iconKey，并给账本补图标
  function toV4() {
    backfillIcons()
    backfillBookIcons()
  },

  // v5：删掉没有图标的「医疗」「理财」，把「购物」改名「日用」
  function toV5() {
    reconcileBuiltinCategories()
  }
]

/** v3 要补进每个账本的支出分类 */
const EXTRA_CATEGORIES = [
  { name: '饮品', emoji: '🧋', iconKey: '饮品' },
  { name: '通讯', emoji: '📱', iconKey: '通讯' }
]

/** 默认账本图标 */
const DEFAULT_BOOK_ICON = icons.DEFAULT_BOOK_ICON

/** v5 要删掉的分类 */
const REMOVE_CATEGORY_NAMES = ['医疗', '理财']

/** v5 要改名的分类：旧名 → 新名 */
const RENAME_CATEGORY = { '购物': '日用' }

/**
 * 给缺少 time 的流水补上时刻，按 createdAt 推断。
 * 幂等，可在导入备份后重复调用。
 */
function backfillTime() {
  const months = db.months()
  months.forEach(function (month) {
    const list = db.monthTxns(month)
    let changed = false
    const next = list.map(function (txn) {
      if (txn.time) return txn
      changed = true
      return Object.assign({}, txn, { time: dateUtil.timeOfStamp(txn.createdAt) })
    })
    if (changed) {
      db.setMonthTxns(month, next)
    }
  })
}

/**
 * 给分类补 iconKey，并补齐「饮品」「通讯」。
 * 幂等：已经有 iconKey 的分类跳过，已存在的同名分类不重复添加。
 */
function backfillIcons() {
  const patched = db.cats().map(function (cat) {
    if (cat.iconKey) return cat
    const key = icons.CATEGORY_ICON_BY_NAME[cat.name]
    if (!key) return cat
    return Object.assign({}, cat, { iconKey: key })
  })

  const extras = []
  db.books().forEach(function (book) {
    const own = patched.filter(function (cat) {
      return cat.bookId === book.id && cat.type === 'expense'
    })
    let maxOrder = -1
    own.forEach(function (cat) {
      const order = Number(cat.order) || 0
      if (order > maxOrder) maxOrder = order
    })
    EXTRA_CATEGORIES.forEach(function (item) {
      let exists = false
      own.forEach(function (cat) {
        if (cat.name === item.name) exists = true
      })
      if (exists) return
      maxOrder += 1
      extras.push({
        id: ids.uid('ct'),
        bookId: book.id,
        name: item.name,
        emoji: item.emoji,
        iconKey: item.iconKey,
        type: 'expense',
        color: '#8A8A8A',
        order: maxOrder,
        builtin: true,
        createdAt: Date.now()
      })
    })
  })

  db.setCats(patched.concat(extras))
}

/** 给没有图标的账本补一个默认图标。幂等，没变化时不写盘。 */
function backfillBookIcons() {
  let changed = false
  const books = db.books().map(function (book) {
    if (book.iconKey) return book
    changed = true
    return Object.assign({}, book, { iconKey: DEFAULT_BOOK_ICON })
  })
  if (changed) {
    db.setBooks(books)
  }
}

/** 把某个分类下的流水整体挪到另一个分类（toId 为空表示置为未分类） */
function moveTxns(fromId, toId) {
  db.months().forEach(function (month) {
    const list = db.monthTxns(month)
    let changed = false
    const next = list.map(function (txn) {
      if (txn.categoryId !== fromId) return txn
      changed = true
      return Object.assign({}, txn, { categoryId: toId })
    })
    if (changed) {
      db.setMonthTxns(month, next)
    }
  })
}

/**
 * v5：删掉「医疗」「理财」，把「购物」改名「日用」。
 * 先处理改名（同账本已存在「日用」时做合并），再处理删除；
 * 分类下的流水会挪到同账本的「其他」，避免变成孤儿记录。
 */
function reconcileBuiltinCategories() {
  let cats = db.cats().slice()

  const byName = Object.create(null)
  cats.forEach(function (cat) {
    byName[cat.bookId + '|' + cat.name] = cat
  })

  const mergedInto = Object.create(null)
  cats = cats.map(function (cat) {
    const target = RENAME_CATEGORY[cat.name]
    if (!target) return cat
    const existing = byName[cat.bookId + '|' + target]
    if (existing && existing.id !== cat.id) {
      mergedInto[cat.id] = existing.id
      return cat
    }
    const next = Object.assign({}, cat, { name: target, iconKey: target })
    byName[cat.bookId + '|' + target] = next
    return next
  })

  Object.keys(mergedInto).forEach(function (fromId) {
    moveTxns(fromId, mergedInto[fromId])
  })
  const mergedIds = Object.keys(mergedInto)
  if (mergedIds.length) {
    cats = cats.filter(function (cat) {
      return mergedIds.indexOf(cat.id) < 0
    })
  }

  const toRemove = cats.filter(function (cat) {
    return REMOVE_CATEGORY_NAMES.indexOf(cat.name) >= 0
  })
  if (toRemove.length) {
    const removeIds = toRemove.map(function (cat) {
      return cat.id
    })
    toRemove.forEach(function (cat) {
      const other = cats.filter(function (item) {
        return item.bookId === cat.bookId && item.type === cat.type && item.name === '其他'
      })[0]
      moveTxns(cat.id, other ? other.id : '')
    })
    cats = cats.filter(function (cat) {
      return removeIds.indexOf(cat.id) < 0
    })
  }

  db.setCats(cats)
}

function run(fromVersion, toVersion) {
  const from = Number(fromVersion) || 0
  const to = Number(toVersion) || steps.length
  for (let target = from + 1; target <= to; target++) {
    const step = steps[target - 1]
    if (step) {
      step()
      console.log('[migration] upgraded to v' + target)
    }
  }
  const meta = db.meta() || {}
  db.setMeta(Object.assign({}, meta, { version: to }))
}

module.exports = {
  run: run,
  backfillTime: backfillTime,
  backfillIcons: backfillIcons,
  backfillBookIcons: backfillBookIcons,
  reconcileBuiltinCategories: reconcileBuiltinCategories,
  VERSION: appVersion.VERSION
}

// 忘了补 step 却改了版本号时，尽早暴露问题
if (steps.length !== appVersion.VERSION) {
  console.warn('[migration] steps(' + steps.length + ') 与 version(' + appVersion.VERSION + ') 不一致')
}
