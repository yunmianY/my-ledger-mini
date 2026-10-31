const store = require('../../utils/store')
const bus = require('../../utils/bus')
const dateUtil = require('../../utils/date')
const money = require('../../utils/money')

/** 差额展示：负数带减号，正数不带加号，零显示 0.00 */
function formatDiff(cents) {
  if (cents < 0) return '-' + money.format(-cents)
  return money.format(cents)
}

Page({
  data: {
    year: 0,
    currentYear: 0,
    isCurrentYear: true,
    expenseText: '0.00',
    incomeText: '暂无',
    balanceText: '¥0.00',
    balanceNegative: false,
    expenseWidth: 0,
    incomeWidth: 0,
    rows: []
  },

  onLoad(options) {
    store.init()
    const currentYear = Number(dateUtil.todayStr().slice(0, 4))
    let year = options && options.year ? Number(options.year) : currentYear
    if (!year || isNaN(year)) year = currentYear
    this.setData({ year: year, currentYear: currentYear })
    this.offChange = bus.on('change', () => {
      this.refresh()
    })
    this.refresh()
  },

  onShow() {
    if (this.data.year) this.refresh()
  },

  onUnload() {
    if (this.offChange) {
      this.offChange()
      this.offChange = null
    }
  },

  refresh() {
    const bookId = store.getActiveBookId()
    if (!bookId) return
    const year = this.data.year
    const series = store.yearTrend({ bookId: bookId, year: year })

    let expense = 0
    let income = 0
    series.forEach(function (row) {
      expense += row.expense
      income += row.income
    })
    const balance = income - expense
    const max = Math.max(expense, income)
    const isCurrentYear = year === this.data.currentYear
    const nowMonth = Number(dateUtil.nowMonth().slice(5, 7))
    // 今年从当前月往回列，往年列满 12 个月，避免一屏全是 0.00
    const startMonth = isCurrentYear ? nowMonth : 12

    const rows = []
    for (let m = startMonth; m >= 1; m--) {
      const row = series[m - 1] || { expense: 0, income: 0 }
      const monthBalance = row.income - row.expense
      let balanceClass = 'td-zero'
      if (monthBalance < 0) {
        balanceClass = 'td-expense'
      } else if (monthBalance > 0) {
        balanceClass = 'td-income'
      }
      rows.push({
        month: year + '-' + dateUtil.pad2(m),
        label: m + '月',
        expenseText: money.format(row.expense),
        incomeText: money.format(row.income),
        balanceText: formatDiff(monthBalance),
        balanceClass: balanceClass,
        empty: !row.expense && !row.income
      })
    }

    this.setData({
      isCurrentYear: isCurrentYear,
      expenseText: money.format(expense),
      incomeText: income ? money.format(income) : '暂无',
      balanceText: (balance < 0 ? '-' : '') + '¥' + money.format(Math.abs(balance)),
      balanceNegative: balance < 0,
      expenseWidth: max ? Math.round(expense * 100 / max) : 0,
      incomeWidth: max ? Math.round(income * 100 / max) : 0,
      rows: rows
    })
  },

  shiftYear(delta) {
    const year = this.data.year + delta
    this.setData({ year: year }, () => {
      this.refresh()
    })
  },

  prevYear() {
    this.shiftYear(-1)
  },

  nextYear() {
    this.shiftYear(1)
  },

  backToThisYear() {
    this.setData({ year: this.data.currentYear }, () => {
      this.refresh()
    })
  },

  onMonthTap(event) {
    const month = event.currentTarget.dataset.month
    if (!month) return
    wx.reLaunch({ url: '/pages/stats/stats?month=' + month })
  }
})
