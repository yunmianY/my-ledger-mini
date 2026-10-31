const store = require('../../utils/store')
const bus = require('../../utils/bus')
const dateUtil = require('../../utils/date')
const money = require('../../utils/money')
const metrics = require('../../utils/metrics')
const txnView = require('../../utils/txn-view')
const tabs = require('../../utils/tabs')
const swipe = require('../../utils/swipe')

/** 折叠时列表显示几项 */
const LIST_LIMIT = 6
/** 折叠时饼图显示几块（剩下的并成一块「其余」） */
const PIE_LIMIT = 3

function toSlice(row) {
  return {
    categoryId: row.categoryId,
    name: row.name,
    ratio: row.ratio,
    percent: row.percent,
    barWidth: row.barWidth,
    color: row.color,
    iconKey: row.iconKey,
    iconPath: row.iconPath,
    emoji: row.emoji
  }
}

Page({
  data: {
    month: '',
    monthText: '',
    isCurrentMonth: true,
    year: 0,
    type: 'expense',
    totalText: '0.00',
    countText: '0 笔',
    avgText: '0.00',
    rows: [],
    series: [],
    catView: 'list',
    catExpanded: false,
    visibleRows: [],
    hiddenCount: 0,
    catToggleText: '',
    trendView: 'bar',
    pieSlices: [],
    marks: {},
    showList: false,
    listTitle: '',
    listItems: [],
    listTotalText: '0.00',
    listCount: 0,
    listMore: 0,
    listHeight: 0
  },

  onLoad(options) {
    store.init()
    // 从年度账单点某个月跳过来时，直接定位到那个月
    const requested = options && options.month
    const month = /^\d{4}-\d{2}$/.test(requested || '') ? requested : dateUtil.nowMonth()
    this.setData({ month: month })
    this.offChange = bus.on('change', () => {
      this.refresh()
    })
    this.refresh()
  },

  onShow() {
    if (this.data.month) this.refresh()
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
    const month = this.data.month
    const type = this.data.type
    const year = Number(String(month).slice(0, 4))

    const txns = store.listTxns({ bookId: bookId, month: month })
    const summary = metrics.summarize(txns)
    const total = type === 'income' ? summary.income : summary.expense
    let count = 0
    txns.forEach(function (txn) {
      if (txn.type === type) count += 1
    })
    const avg = metrics.dailyAverage(total, dateUtil.elapsedDays(month))

    const stats = store.categoryStats({ bookId: bookId, month: month, type: type })
    const series = store.yearTrend({ bookId: bookId, year: year })

    const pieSlices = []
    const expanded = this.data.catExpanded
    if (!expanded && stats.rows.length > PIE_LIMIT) {
      const rest = stats.rows.slice(PIE_LIMIT)
      let restCents = 0
      rest.forEach(function (row) {
        restCents += row.cents
      })
      stats.rows.slice(0, PIE_LIMIT).forEach(function (row) {
        pieSlices.push(toSlice(row))
      })
      const total = stats.total || 1
      pieSlices.push({
        categoryId: '',
        name: '其余 ' + rest.length + ' 项',
        ratio: restCents / total,
        percent: Math.round(restCents * 1000 / total) / 10,
        barWidth: Math.max(2, Math.round(restCents * 100 / total)),
        color: '#CFCFCF',
        iconKey: '',
        iconPath: '',
        emoji: '…'
      })
    } else {
      stats.rows.forEach(function (row) {
        pieSlices.push(toSlice(row))
      })
    }

    // 折叠条数按当前视图算：列表 6 项，饼图 3 块（其余合并成一块）
    const cut = this.data.catView === 'pie' ? PIE_LIMIT : LIST_LIMIT
    const hiddenCount = Math.max(0, stats.rows.length - cut)

    // 日历用：当天合计金额
    const marks = {}
    txns.forEach(function (txn) {
      if (txn.type !== type) return
      const key = txn.date
      const mark = marks[key] || { cents: 0, count: 0 }
      mark.cents += txn.amountCents
      mark.count += 1
      marks[key] = mark
    })

    this.setData({
      monthText: dateUtil.monthLabel(month),
      isCurrentMonth: month === dateUtil.nowMonth(),
      year: year,
      totalText: money.format(total),
      countText: count + ' 笔',
      avgText: money.format(avg),
      rows: stats.rows,
      visibleRows: expanded ? stats.rows : stats.rows.slice(0, LIST_LIMIT),
      hiddenCount: hiddenCount,
      catToggleText: expanded ? '收起' : '展开全部 ' + stats.rows.length + ' 项',
      series: series,
      pieSlices: pieSlices,
      marks: marks
    })
  },

  shiftMonth(delta) {
    const next = dateUtil.shiftMonth(this.data.month, delta)
    this.setData({ month: next }, () => {
      this.refresh()
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
      this.refresh()
    })
  },

  onType(event) {
    const type = event.currentTarget.dataset.type
    if (!type || type === this.data.type) return
    this.setData({ type: type }, () => {
      this.refresh()
    })
  },

  onYear(event) {
    const delta = Number(event.currentTarget.dataset.delta) || 0
    this.setData({ month: dateUtil.shiftMonth(this.data.month, delta * 12) }, () => {
      this.refresh()
    })
  },

  goBill() {
    wx.navigateTo({ url: '/pages/bill/bill?year=' + this.data.year })
  },

  dayTitleOf(dateStr) {
    const parts = String(dateStr).split('-')
    return Number(parts[1]) + '月' + Number(parts[2]) + '日 · ' + dateUtil.weekdayLabel(dateStr)
  },

  /** 打开明细弹层：当天和单个分类共用 */
  openTxns(title, list) {
    const bookId = store.getActiveBookId()
    const catMap = store.categoryMap(bookId)
    let total = 0
    list.forEach(function (txn) {
      total += txn.amountCents
    })
    // 弹层里的列表自己滚：高度按条数算，超过上限就固定住
    const ROW_HEIGHT = 128
    const MAX_HEIGHT = 760
    const maxItems = 200
    const shown = list.slice(0, maxItems)

    this.setData({
      showList: true,
      listTitle: title,
      listItems: txnView.decorateList(shown, catMap),
      listHeight: Math.min(shown.length * ROW_HEIGHT + 16, MAX_HEIGHT),
      listTotalText: money.format(total),
      listCount: list.length,
      listMore: list.length > maxItems ? list.length - maxItems : 0
    })
  },

  onDayTap(event) {
    const date = event.detail.date
    if (!date) return
    const list = store
      .listTxns({ bookId: store.getActiveBookId(), month: this.data.month, type: this.data.type })
      .filter(function (txn) {
        return txn.date === date
      })
    this.openTxns(this.dayTitleOf(date), list)
  },

  /** 点分类占比里的某一类（列表和饼图都走这里） */
  openCategory(id, name) {
    if (!id) return
    const list = store.listTxns({
      bookId: store.getActiveBookId(),
      month: this.data.month,
      type: this.data.type,
      categoryId: id
    })
    this.openTxns((name || '分类') + ' · ' + this.data.monthText, list)
  },

  onCategoryTap(event) {
    this.openCategory(event.currentTarget.dataset.id, event.currentTarget.dataset.name)
  },

  onPieSlice(event) {
    this.openCategory(event.detail.categoryId, event.detail.name)
  },

  onCatView(event) {
    const view = event.currentTarget.dataset.view
    if (!view || view === this.data.catView) return
    // 两个视图的折叠条数不同（列表 6 / 饼图 3），切完要重算
    this.setData({ catView: view }, () => {
      this.refresh()
    })
  },

  /** 展开 / 收起分类占比（列表和饼图共用一个状态） */
  onToggleCats() {
    this.setData({ catExpanded: !this.data.catExpanded }, () => {
      this.refresh()
    })
  },

  onTrendView(event) {
    const view = event.currentTarget.dataset.view
    if (!view || view === this.data.trendView) return
    this.setData({ trendView: view })
  },

  closeList() {
    this.setData({ showList: false })
  },

  onListItemTap(event) {
    const id = event.detail.id
    if (!id) return
    this.setData({ showList: false })
    wx.navigateTo({ url: '/pages/record/record?id=' + id })
  },

  onSwipeStart(event) {
    this._swipeStart = swipe.readStart(event)
  },

  onSwipeEnd(event) {
    const direction = swipe.resolve(this._swipeStart, event)
    this._swipeStart = null
    if (direction) tabs.swipe('stats', direction)
  }
})
