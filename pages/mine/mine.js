const store = require('../../utils/store')
const bus = require('../../utils/bus')
const dateUtil = require('../../utils/date')
const tabs = require('../../utils/tabs')
const swipe = require('../../utils/swipe')

Page({
  data: {
    bookName: '',
    bookEmoji: '📒',
    bookIconKey: '',
    bookIconPath: '',
    bookId: '',
    txnCount: 0,
    bookCount: 0,
    storageText: '',
    members: [],
    showMember: false,
    newMember: '',
    version: '1.0.0'
  },

  onLoad() {
    store.init()
    this.offChange = bus.on('change', () => {
      this.refresh()
    })
    this.refresh()
  },

  onShow() {
    this.refresh()
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
    if (!book) return
    const usage = store.getStorageInfo()
    this.setData({
      bookId: book.id,
      bookName: book.name,
      bookEmoji: book.emoji,
      bookIconKey: book.iconKey || '',
      bookIconPath: book.iconPath || '',
      txnCount: store.countTxns({ bookId: book.id }),
      bookCount: store.listBooks().length,
      storageText: usage.currentSize + ' KB / ' + usage.limitSize + ' KB',
      members: (book.members || []).slice()
    })
  },

  goBooks() {
    wx.navigateTo({ url: '/pages/books/books' })
  },

  goCategories() {
    wx.navigateTo({ url: '/pages/categories/categories' })
  },

  goBudget() {
    wx.navigateTo({ url: '/pages/budget/budget' })
  },

  goExport() {
    wx.navigateTo({ url: '/pages/export/export' })
  },

  goAppearance() {
    wx.navigateTo({ url: '/pages/appearance/appearance' })
  },

  openMembers() {
    this.setData({ showMember: true })
  },

  closeMembers() {
    this.setData({ showMember: false, newMember: '' })
  },

  onMemberInput(event) {
    this.setData({ newMember: event.detail.value })
  },

  onAddMember() {
    const name = (this.data.newMember || '').trim()
    if (!name) {
      wx.showToast({ title: '请输入名字', icon: 'none' })
      return
    }
    try {
      store.addMember(this.data.bookId, name)
      this.setData({ newMember: '' })
      wx.showToast({ title: '已添加', icon: 'none' })
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '添加失败', icon: 'none' })
    }
  },

  onRemoveMember(event) {
    const name = event.currentTarget.dataset.name
    const that = this
    wx.showModal({
      title: '移除记账人',
      content: '移除「' + name + '」后，已有记录里的名字会保留。',
      success(res) {
        if (!res.confirm) return
        try {
          store.removeMember(that.data.bookId, name)
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '移除失败', icon: 'none' })
        }
      }
    })
  },

  showAbout() {
    wx.showModal({
      title: '关于',
      content: '记账小程序 v' + this.data.version + '\n数据全部保存在本机，换手机前请先导出备份。\n' + dateUtil.monthLabel(dateUtil.nowMonth()),
      showCancel: false
    })
  },

  onSwipeStart(event) {
    this._swipeStart = swipe.readStart(event)
  },

  onSwipeEnd(event) {
    const direction = swipe.resolve(this._swipeStart, event)
    this._swipeStart = null
    if (direction) tabs.swipe('mine', direction)
  }
})
