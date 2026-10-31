// app.js
const store = require('./utils/store')

App({
  globalData: {
    version: '1.0.0'
  },
  onLaunch() {
    try {
      store.init()
    } catch (err) {
      console.error('[app] store init failed', err)
      wx.showModal({
        title: '初始化失败',
        content: '本地数据读取异常，可尝试重启小程序。',
        showCancel: false
      })
    }
  }
})
