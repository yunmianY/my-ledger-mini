const store = require('../../utils/store')
const media = require('../../utils/media')
const bus = require('../../utils/bus')

Page({
  data: {
    background: ''
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
    const background = store.getBackground()
    if (background === this.data.background) return
    this.setData({ background: background })
  },

  chooseBackground() {
    // 9:16 是系统裁切框里最接近手机屏幕的比例；
    // 选完还能拖动、缩放，挑自己想露出来的那一段。
    media.pickImage({ prefix: 'bg', width: 1080, quality: 72, cropScale: '9:16' }, (err, path) => {
      if (err) {
        if (err.message !== 'cancel') {
          wx.showToast({ title: err.message || '选择失败', icon: 'none' })
        }
        return
      }
      store.setBackground(path)
      wx.showToast({ title: '背景已更新', icon: 'none' })
    })
  },

  removeBackground() {
    wx.showModal({
      title: '移除背景图？',
      content: '本地保存的这张图片也会一起删掉。',
      confirmText: '移除',
      confirmColor: '#D64545',
      success(res) {
        if (!res.confirm) return
        store.clearBackground()
        wx.showToast({ title: '已移除', icon: 'none' })
      }
    })
  }
})
