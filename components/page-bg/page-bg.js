/**
 * 全屏背景层。
 * 用 fixed + 100vw/100vh 铺满视口（组件节点在 Skyline 下会成为定位参照物，absolute 不可用）。
 * z-index 1，页面内容包在 .page-body（z-index 2）里，保证文字始终在背景之上。
 */
const store = require('../../utils/store')
const bus = require('../../utils/bus')

Component({
  data: {
    url: ''
  },
  lifetimes: {
    attached() {
      this.refresh()
      this.offChange = bus.on('change', () => {
        this.refresh()
      })
    },
    detached() {
      if (this.offChange) {
        this.offChange()
        this.offChange = null
      }
    }
  },
  methods: {
    refresh() {
      const url = store.getBackground()
      if (url === this.data.url) return
      this.setData({ url: url })
    }
  }
})
