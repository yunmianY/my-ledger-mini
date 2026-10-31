const store = require('../../utils/store')
const media = require('../../utils/media')
const icons = require('../../utils/icons')

const CATEGORY_ICONS = icons.CATEGORY_PICKER

Page({
  data: {
    type: 'expense',
    list: [],
    categoryIcons: CATEGORY_ICONS,
    showForm: false,
    formId: '',
    formName: '',
    formEmoji: '📌',
    formIconKey: '',
    formIconPath: '',
    originalIconPath: '',
    formTitle: '新建分类'
  },

  onLoad() {
    store.init()
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const bookId = store.getActiveBookId()
    const type = this.data.type
    const cats = store.listCategories(bookId, type)
    const list = cats.map(function (cat, index) {
      return {
        id: cat.id,
        name: cat.name,
        emoji: cat.emoji,
        iconPath: cat.iconPath || '',
        iconKey: cat.iconKey || '',
        canUp: index > 0,
        canDown: index < cats.length - 1
      }
    })
    this.setData({ list: list })
  },

  onType(event) {
    const type = event.currentTarget.dataset.type
    if (!type || type === this.data.type) return
    this.setData({ type: type }, () => {
      this.refresh()
    })
  },

  openAdd() {
    this.setData({
      showForm: true,
      formId: '',
      formName: '',
      formEmoji: '📌',
      formIconKey: '',
      formIconPath: '',
      originalIconPath: '',
      formTitle: this.data.type === 'income' ? '新建收入分类' : '新建支出分类'
    })
  },

  onEdit(event) {
    const id = event.currentTarget.dataset.id
    const cat = store.getCategory(id)
    if (!cat) return
    this.setData({
      showForm: true,
      formId: id,
      formName: cat.name,
      formEmoji: cat.emoji || '📌',
      formIconKey: cat.iconKey || '',
      formIconPath: cat.iconPath || '',
      originalIconPath: cat.iconPath || '',
      formTitle: '编辑分类'
    })
  },

  closeForm() {
    this.cleanupDraftIcon()
    this.setData({ showForm: false, formIconPath: '', originalIconPath: '', formIconKey: '' })
  },

  /** 取消编辑时，把本次刚上传、还没落库的图片删掉，免得留下孤儿文件 */
  cleanupDraftIcon() {
    const path = this.data.formIconPath
    if (path && path !== this.data.originalIconPath) {
      media.removeFile(path)
    }
  },

  onPickIcon() {
    const that = this
    media.pickImage({ prefix: 'cat', width: 240, quality: 80 }, function (err, path) {
      if (err) {
        if (err.message !== 'cancel') {
          wx.showToast({ title: err.message || '选择失败', icon: 'none' })
        }
        return
      }
      // 换图时先把上一张草稿图删掉
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
    this.setData({ formIconPath: '', formIconKey: '' })
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
    // 选内置图标就放弃上传图，两者互斥
    this.setData({
      formIconKey: key,
      formIconPath: ''
    })
  },

  onSubmit() {
    const name = (this.data.formName || '').trim()
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' })
      return
    }
    try {
      if (this.data.formId) {
        store.updateCategory(this.data.formId, {
          name: name,
          emoji: this.data.formEmoji,
          iconKey: this.data.formIconKey,
          iconPath: this.data.formIconPath
        })
      } else {
        store.createCategory({
          name: name,
          emoji: this.data.formEmoji,
          iconKey: this.data.formIconKey,
          iconPath: this.data.formIconPath,
          type: this.data.type,
          bookId: store.getActiveBookId()
        })
      }
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' })
      return
    }
    this.setData({ showForm: false, formIconPath: '', originalIconPath: '', formIconKey: '' })
    this.refresh()
    wx.showToast({ title: '已保存', icon: 'none' })
  },

  onMove(event) {
    const id = event.currentTarget.dataset.id
    const dir = Number(event.currentTarget.dataset.dir)
    store.moveCategory(id, dir)
    this.refresh()
  },

  onDelete(event) {
    const id = event.currentTarget.dataset.id
    const that = this
    wx.showModal({
      title: '删除这个分类？',
      content: '如果这个分类已经被用过，需要先把记录改成别的分类。',
      confirmText: '删除',
      confirmColor: '#D64545',
      success(res) {
        if (!res.confirm) return
        try {
          store.deleteCategory(id)
          that.refresh()
          wx.showToast({ title: '已删除', icon: 'none' })
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' })
        }
      }
    })
  }
})
