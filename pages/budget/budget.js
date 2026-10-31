const store = require('../../utils/store')
const dateUtil = require('../../utils/date')
const money = require('../../utils/money')

Page({
  data: {
    month: '',
    monthText: '',
    isCurrentMonth: true,
    totalInput: '',
    totalHint: '',
    rows: []
  },

  onLoad() {
    store.init()
    this.setData({ month: dateUtil.nowMonth() })
    this.load()
  },

  load() {
    const bookId = store.getActiveBookId()
    if (!bookId) return
    const month = this.data.month
    const budget = store.getBudget(bookId, month) || { totalCents: 0, byCategory: {} }
    const byCategory = budget.byCategory || {}
    const cats = store.listCategories(bookId, 'expense')
    const stats = store.categoryStats({ bookId: bookId, month: month, type: 'expense' })
    const spentMap = Object.create(null)
    stats.rows.forEach(function (row) {
      spentMap[row.categoryId] = row.cents
    })
    const rows = cats.map(function (cat) {
      const planned = byCategory[cat.id]
      return {
        id: cat.id,
        name: cat.name,
        emoji: cat.emoji,
        iconPath: cat.iconPath || '',
        iconKey: cat.iconKey || '',
        input: planned ? money.toInput(planned) : '',
        spentText: money.format(spentMap[cat.id] || 0)
      }
    })
    this.setData({
      monthText: dateUtil.monthLabel(month),
      isCurrentMonth: month === dateUtil.nowMonth(),
      totalInput: budget.totalCents ? money.toInput(budget.totalCents) : '',
      totalHint: '本月已支出 ' + money.format(stats.total),
      rows: rows
    })
  },

  shiftMonth(delta) {
    const next = dateUtil.shiftMonth(this.data.month, delta)
    this.setData({ month: next }, () => {
      this.load()
    })
  },

  prevMonth() {
    this.shiftMonth(-1)
  },

  nextMonth() {
    this.shiftMonth(1)
  },

  backToToday() {
    this.setData({ month: dateUtil.nowMonth() }, () => {
      this.load()
    })
  },

  onTotal(event) {
    this.setData({ totalInput: event.detail.value })
  },

  onCell(event) {
    const index = Number(event.currentTarget.dataset.index)
    if (isNaN(index)) return
    this.setData({ ['rows[' + index + '].input']: event.detail.value })
  },

  save() {
    const bookId = store.getActiveBookId()
    if (!bookId) return

    let totalCents = 0
    if (this.data.totalInput) {
      const parsed = money.toCents(this.data.totalInput)
      if (isNaN(parsed) || parsed < 0) {
        wx.showToast({ title: '总预算金额格式不对', icon: 'none' })
        return
      }
      totalCents = parsed
    }

    const byCategory = {}
    const rows = this.data.rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row.input) continue
      const cents = money.toCents(row.input)
      if (isNaN(cents) || cents < 0) {
        wx.showToast({ title: '「' + row.name + '」金额格式不对', icon: 'none' })
        return
      }
      if (cents > 0) byCategory[row.id] = cents
    }

    if (totalCents <= 0 && Object.keys(byCategory).length === 0) {
      store.clearBudget(bookId, this.data.month)
      wx.showToast({ title: '预算已清空', icon: 'none' })
      return
    }

    store.setBudget(bookId, this.data.month, {
      totalCents: totalCents,
      byCategory: byCategory
    })
    this.load()
    wx.showToast({ title: '已保存', icon: 'none' })
  }
})
