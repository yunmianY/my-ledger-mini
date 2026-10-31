const store = require('../../utils/store')
const bus = require('../../utils/bus')
const dateUtil = require('../../utils/date')
const money = require('../../utils/money')
const metrics = require('../../utils/metrics')
const txnView = require('../../utils/txn-view')
const tabs = require('../../utils/tabs')
const swipe = require('../../utils/swipe')

Page({
  data: {
    loaded: false,
    month: '',
    monthText: '',
    isCurrentMonth: true,
    summary: {
      expenseText: '0.00',
      incomeText: '0.00',
      balanceText: '0.00'
    },
    budget: null,
    groups: [],
    totalCount: 0,
    members: [],
    memberFilter: '',
    bookName: '',
    bookEmoji: '📒'
  },

  onLoad() {
    store.init()
    const month = dateUtil.nowMonth()
    this.setData({ month: month })
    this.offChange = bus.on('change', () => {
      this.refresh()
    })
    this.refresh()
  },

  onShow() {
    if (this.data.month) {
      this.refresh()
    }
  },

  onUnload() {
    if (this.offChange) {
      this.offChange()
      this.offChange = null
    }
  },

  refresh() {
    const bookId = store.getActiveBookId()
    const book = store.getBook(bookId)
    if (!book) {
      this.setData({ loaded: true, groups: [], totalCount: 0, budget: null })
      return
    }
    const month = this.data.month
    const memberFilter = this.data.memberFilter
    const members = (book.members || []).slice()
    let txns = store.listTxns({ bookId: bookId, month: month })
    if (memberFilter) {
      txns = txns.filter(function (txn) {
        return txn.member === memberFilter
      })
    }
    const catMap = store.categoryMap(bookId)
    const summary = metrics.summarize(txns)

    const groups = metrics.groupByDay(txns).map(function (group) {
      const parts = []
      if (group.expense) parts.push('支出 ' + money.format(group.expense))
      if (group.income) parts.push('收入 ' + money.format(group.income))
      return {
        date: group.date,
        dateText: dateUtil.dateLabel(group.date),
        weekText: dateUtil.weekdayLabel(group.date),
        sumText: parts.join('  ·  '),
        items: group.items.map(function (txn) {
          return txnView.decorate(txn, catMap)
        })
      }
    })

    const rawBudget = store.getBudget(bookId, month)
    let budget = null
    if (rawBudget && rawBudget.totalCents > 0) {
      const progress = metrics.budgetProgress(summary.expense, rawBudget.totalCents)
      if (progress) {
        budget = {
          percent: progress.percent,
          state: progress.state,
          text: '已用 ' + money.format(progress.used) + ' / ' + money.format(progress.limit),
          restText: progress.remaining >= 0
            ? '还剩 ' + money.format(progress.remaining)
            : '超支 ' + money.format(-progress.remaining)
        }
      }
    }

    this.setData({
      loaded: true,
      bookName: book.name,
      bookEmoji: book.emoji,
      monthText: dateUtil.monthLabel(month),
      isCurrentMonth: month === dateUtil.nowMonth(),
      members: members,
      summary: {
        expenseText: money.format(summary.expense),
        incomeText: money.format(summary.income),
        balanceText: money.formatSigned(summary.balance)
      },
      budget: budget,
      groups: groups,
      totalCount: txns.length
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

  onMemberFilter(event) {
    const value = event.currentTarget.dataset.value || ''
    if (value === this.data.memberFilter) return
    this.setData({ memberFilter: value }, () => {
      this.refresh()
    })
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/record/record' })
  },

  onTxnTap(event) {
    this.openActions(event.detail.id)
  },

  onTxnLong(event) {
    this.openActions(event.detail.id)
  },

  openActions(id) {
    if (!id) return
    const that = this
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success(res) {
        if (res.tapIndex === 0) {
          that.editTxn(id)
        } else if (res.tapIndex === 1) {
          that.removeTxn(id)
        }
      },
      fail() {}
    })
  },

  editTxn(id) {
    wx.navigateTo({ url: '/pages/record/record?id=' + id })
  },

  removeTxn(id) {
    wx.showModal({
      title: '删除这笔记录？',
      content: '删除后无法恢复',
      confirmText: '删除',
      confirmColor: '#D64545',
      success(res) {
        if (!res.confirm) return
        store.deleteTxn(id)
        wx.showToast({ title: '已删除', icon: 'none' })
      }
    })
  },

  onSwipeStart(event) {
    this._swipeStart = swipe.readStart(event)
  },

  onSwipeEnd(event) {
    const direction = swipe.resolve(this._swipeStart, event)
    this._swipeStart = null
    if (direction) tabs.swipe('index', direction)
  }
})
