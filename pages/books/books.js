const store = require('../../utils/store')
const media = require('../../utils/media')
const icons = require('../../utils/icons')

const BOOK_ICONS = icons.BOOK_PICKER

Page({
  data: {
    books: [],
    bookIcons: BOOK_ICONS,
    showForm: false,
    formId: '',
    formName: '',
    formEmoji: '📒',
    formIconKey: 'book:日记',
    formIconPath: '',
    originalIconPath: '',
    formTitle: '新建账本'
  },

  onShow() {
    store.init()
    this.refresh()
  },

  refresh() {
    const activeId = store.getActiveBookId()
    const books = store.listBooks().map(function (book) {
      const members = book.members || []
      return {
        id: book.id,
        name: book.name,
        emoji: book.emoji,
        iconKey: book.iconKey || '',
        iconPath: book.iconPath || '',
        active: book.id === activeId,
        subText: members.length + ' 位记账人'
      }
    })
    this.setData({ books: books })
  },

  onSelect(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    if (id === store.getActiveBookId()) {
      wx.navigateBack()
      return
    }
    store.setActiveBook(id)
    wx.navigateBack()
  },

  onMore(event) {
    const id = event.currentTarget.dataset.id
    const that = this
    wx.showActionSheet({
      itemList: ['重命名', '归档'],
      success(res) {
        if (res.tapIndex === 0) {
          that.openEdit(id)
        } else if (res.tapIndex === 1) {
          that.archive(id)
        }
      },
      fail() {}
    })
  },

  archive(id) {
    const that = this
    wx.showModal({
      title: '归档这个账本？',
      content: '归档后账本不再显示，但数据会保留。',
      success(res) {
        if (!res.confirm) return
        try {
          store.archiveBook(id)
          that.refresh()
          wx.showToast({ title: '已归档', icon: 'none' })
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  openAdd() {
    this.setData({
      showForm: true,
      formId: '',
      formName: '',
      formEmoji: '📒',
      formIconKey: 'book:日记',
      formIconPath: '',
      originalIconPath: '',
      formTitle: '新建账本'
    })
  },

  openEdit(id) {
    const book = store.getBook(id)
    if (!book) return
    this.setData({
      showForm: true,
      formId: id,
      formName: book.name,
      formEmoji: book.emoji || '📒',
      formIconKey: book.iconKey || '',
      formIconPath: book.iconPath || '',
      originalIconPath: book.iconPath || '',
      formTitle: '重命名账本'
    })
  },

  closeForm() {
    this.cleanupDraftIcon()
    this.setData({ showForm: false, formIconPath: '', originalIconPath: '', formIconKey: 'book:日记' })
  },

  /** 取消时删掉本次刚上传、还没保存的图片 */
  cleanupDraftIcon() {
    const path = this.data.formIconPath
    if (path && path !== this.data.originalIconPath) {
      media.removeFile(path)
    }
  },

  onPickIcon() {
    const that = this
    media.pickImage({ prefix: 'book', width: 240, quality: 80 }, function (err, path) {
      if (err) {
        if (err.message !== 'cancel') {
          wx.showToast({ title: err.message || '选择失败', icon: 'none' })
        }
        return
      }
      const previous = that.data.formIconPath
      if (previous && previous !== that.data.originalIconPath) {
        media.removeFile(previous)
      }
      that.setData({ formIconPath: path })
    })
  },

  onClearIcon() {
    const previous = this.data.formIconPath
    if (previous && previous !== this.data.originalIconPath) {
      media.removeFile(previous)
    }
    this.setData({ formIconPath: '' })
  },

  onName(event) {
    this.setData({ formName: event.detail.value })
  },

  onSelectIcon(event) {
    const key = event.currentTarget.dataset.key
    if (!key) return
    const previous = this.data.formIconPath
    if (previous && previous !== this.data.originalIconPath) {
      media.removeFile(previous)
    }
    this.setData({
      formIconKey: key,
      formIconPath: ''
    })
  },

  onSubmit() {
    const name = (this.data.formName || '').trim()
    if (!name) {
      wx.showToast({ title: '请输入账本名称', icon: 'none' })
      return
    }
    try {
      if (this.data.formId) {
        store.updateBook(this.data.formId, {
          name: name,
          emoji: this.data.formEmoji,
          iconKey: this.data.formIconKey,
          iconPath: this.data.formIconPath
        })
      } else {
        const book = store.createBook({
          name: name,
          emoji: this.data.formEmoji,
          iconKey: this.data.formIconKey,
          iconPath: this.data.formIconPath
        })
        store.setActiveBook(book.id)
      }
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' })
      return
    }
    this.setData({ showForm: false, formIconPath: '', originalIconPath: '', formIconKey: 'book:日记' })
    this.refresh()
    wx.showToast({ title: '已保存', icon: 'none' })
  }
})
