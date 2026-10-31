const store = require('../../utils/store')
const dateUtil = require('../../utils/date')
const money = require('../../utils/money')
const amountInput = require('../../utils/amount-input')
const prefill = require('../../utils/prefill')

Page({
  data: {
    mode: 'create',
    txnId: '',
    bookId: '',
    type: 'expense',
    amount: '',
    amountText: '0.00',
    categories: [],
    categoryId: '',
    date: '',
    dateText: '',
    time: '',
    note: '',
    member: '',
    members: [],
    memberOptions: [],
    showDate: false,
    showTime: false,
    showMember: false
  },

  onLoad(options) {
    store.init()
    // 一次性取走预填数据（购物清单「买到了」会塞进来），避免残留到下一次
    const draft = prefill.take()
    const bookId = store.getActiveBookId()
    const book = store.getBook(bookId)
    const members = book ? (book.members || []).slice() : []
    const date = dateUtil.todayStr()
    const id = options && options.id

    const base = {
      bookId: bookId,
      members: members,
      memberOptions: [''].concat(members),
      date: date,
      dateText: this.buildDateText(date),
      time: dateUtil.nowTime(),
      member: members.length ? members[0] : ''
    }

    if (id) {
      const found = store.findTxn(id)
      if (found) {
        const txn = found.txn
        const input = money.toInput(txn.amountCents)
        this.setData(Object.assign({}, base, {
          mode: 'edit',
          txnId: id,
          type: txn.type,
          amount: input,
          amountText: money.formatInput(input),
          date: txn.date,
          dateText: this.buildDateText(txn.date),
          time: dateUtil.normalizeTime(txn.time) || dateUtil.timeOfStamp(txn.createdAt),
          note: txn.note || '',
          member: txn.member || ''
        }))
        this.loadCategories(txn.categoryId)
        return
      }
    }

    this.setData(Object.assign({}, base, { mode: 'create', type: 'expense' }))
    this.loadCategories('')

    if (draft) {
      const input = draft.amountCents ? money.toInput(draft.amountCents) : ''
      this.setData({
        amount: input,
        amountText: input ? money.formatInput(input) : '0.00',
        note: draft.note || ''
      })
    }
  },

  buildDateText(dateStr) {
    const year = String(dateStr).slice(0, 4)
    const thisYear = dateUtil.todayStr().slice(0, 4)
    const parts = [dateUtil.dateLabel(dateStr), dateUtil.weekdayLabel(dateStr)]
    if (year !== thisYear) parts.push(year + '年')
    return parts.join(' · ')
  },

  loadCategories(preserveId) {
    const list = store.listCategories(this.data.bookId, this.data.type)
    let categoryId = preserveId || ''
    let exists = false
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === categoryId) exists = true
    }
    if (!exists) {
      categoryId = list.length ? list[0].id : ''
    }
    this.setData({ categories: list, categoryId: categoryId })
  },

  onType(event) {
    const type = event.currentTarget.dataset.type
    if (!type || type === this.data.type) return
    this.setData({ type: type }, () => {
      this.loadCategories('')
    })
  },

  onCategory(event) {
    this.setData({ categoryId: event.detail.id })
  },

  onKey(event) {
    const key = event.detail.key
    const next = amountInput.applyKey(this.data.amount, key)
    this.setData({
      amount: next,
      amountText: next ? money.formatInput(next) : '0.00'
    })
  },

  onNote(event) {
    this.setData({ note: event.detail.value })
  },

  openDate() {
    this.setData({ showDate: true })
  },

  closeDate() {
    this.setData({ showDate: false })
  },

  onDateSelect(event) {
    const date = event.detail.date
    if (!date) return
    this.setData({
      date: date,
      dateText: this.buildDateText(date),
      showDate: false
    })
  },

  openTime() {
    this.setData({ showTime: true })
  },

  closeTime() {
    this.setData({ showTime: false })
  },

  onTimeConfirm(event) {
    const time = event.detail.time
    if (!time) return
    this.setData({ time: time, showTime: false })
  },

  openMember() {
    this.setData({ showMember: true })
  },

  closeMember() {
    this.setData({ showMember: false })
  },

  onMemberSelect(event) {
    const value = event.currentTarget.dataset.value || ''
    this.setData({ member: value, showMember: false })
  },

  onSave() {
    this.save(false)
  },

  onAgain() {
    this.save(true)
  },

  save(keepGoing) {
    const cents = money.toCents(this.data.amount)
    if (isNaN(cents) || cents <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }
    if (!this.data.categoryId) {
      wx.showToast({ title: '请选择分类', icon: 'none' })
      return
    }

    const payload = {
      type: this.data.type,
      amountCents: cents,
      categoryId: this.data.categoryId,
      date: this.data.date,
      time: this.data.time,
      note: this.data.note,
      member: this.data.member
    }

    try {
      if (this.data.mode === 'edit') {
        store.updateTxn(this.data.txnId, payload)
      } else {
        store.addTxn(Object.assign({ bookId: this.data.bookId }, payload))
      }
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' })
      return
    }

    if (keepGoing) {
      this.setData({ amount: '', amountText: '0.00', note: '' })
      wx.showToast({ title: '已记一笔', icon: 'none' })
      return
    }

    wx.navigateBack({
      fail() {
        wx.reLaunch({ url: '/pages/index/index' })
      }
    })
  }
})
