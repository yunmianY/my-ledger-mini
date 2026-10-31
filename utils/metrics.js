/**
 * 纯函数指标计算：不碰 wx.*，不碰存储，方便后续接单元测试。
 */
const money = require('./money')

/** 收支汇总 */
function summarize(txns) {
  let expense = 0
  let income = 0
  const list = txns || []
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (!item || item.deleted) continue
    const cents = Math.round(Number(item.amountCents) || 0)
    if (item.type === 'income') {
      income += cents
    } else {
      expense += cents
    }
  }
  return { expense: expense, income: income, balance: income - expense }
}

/** 按天分组，日期倒序，组内按创建时间倒序 */
function groupByDay(txns) {
  const map = Object.create(null)
  const order = []
  const list = (txns || []).slice().sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    const timeA = a.time || ''
    const timeB = b.time || ''
    if (timeA !== timeB) return timeA < timeB ? 1 : -1
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
  list.forEach(function (txn) {
    let group = map[txn.date]
    if (!group) {
      group = { date: txn.date, expense: 0, income: 0, items: [] }
      map[txn.date] = group
      order.push(txn.date)
    }
    group.items.push(txn)
    if (txn.type === 'income') {
      group.income += txn.amountCents
    } else {
      group.expense += txn.amountCents
    }
  })
  return order.map(function (date) {
    return map[date]
  })
}

/**
 * 分类占比
 * @param {Object} input { txns, categories: {id: cat}, type }
 * @returns {{ rows: Array, total: number }}
 */
function categoryStats(input) {
  const txns = input.txns || []
  const categories = input.categories || {}
  const type = input.type || 'expense'
  const map = Object.create(null)
  let total = 0

  txns.forEach(function (txn) {
    if (txn.type !== type) return
    const key = txn.categoryId || 'unknown'
    let row = map[key]
    if (!row) {
      const cat = categories[key]
      row = {
        categoryId: key,
        name: cat ? cat.name : '未分类',
        emoji: cat ? cat.emoji : '❓',
        iconPath: cat ? (cat.iconPath || '') : '',
        iconKey: cat ? (cat.iconKey || '') : '',
        color: cat ? cat.color : '#8A8A8A',
        cents: 0,
        count: 0
      }
      map[key] = row
    }
    row.cents += txn.amountCents
    row.count += 1
    total += txn.amountCents
  })

  const rows = Object.keys(map).map(function (key) {
    return map[key]
  })
  rows.sort(function (a, b) {
    return b.cents - a.cents
  })
  rows.forEach(function (row) {
    row.ratio = total ? row.cents / total : 0
    row.percent = total ? Math.round(row.cents * 1000 / total) / 10 : 0
    row.barWidth = total ? Math.max(2, Math.round(row.cents * 100 / total)) : 0
    row.amountText = money.format(row.cents)
  })
  return { rows: rows, total: total }
}

/** 预算进度；limit <= 0 返回 null */
function budgetProgress(spent, limit) {
  const used = Math.round(Number(spent) || 0)
  const total = Math.round(Number(limit) || 0)
  if (total <= 0) return null
  const ratio = used / total
  let state = 'ok'
  if (ratio >= 1) {
    state = 'over'
  } else if (ratio >= 0.8) {
    state = 'warn'
  }
  return {
    used: used,
    limit: total,
    ratio: ratio,
    percent: Math.min(100, Math.round(ratio * 100)),
    remaining: total - used,
    state: state
  }
}

/** 日均；days 为 0 时返回 0 */
function dailyAverage(total, days) {
  const count = Number(days) || 0
  if (!count) return 0
  return Math.round((Number(total) || 0) / count)
}

/** 趋势数据补零：保证 12 根柱子都在 */
function normalizeTrend(rows, months) {
  const map = Object.create(null)
  ;(rows || []).forEach(function (row) {
    map[row.month] = row
  })
  return (months || []).map(function (month) {
    const row = map[month]
    return {
      month: month,
      expense: row ? row.expense : 0,
      income: row ? row.income : 0
    }
  })
}

module.exports = {
  summarize: summarize,
  groupByDay: groupByDay,
  categoryStats: categoryStats,
  budgetProgress: budgetProgress,
  dailyAverage: dailyAverage,
  normalizeTrend: normalizeTrend
}
