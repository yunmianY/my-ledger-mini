/**
 * 底部弹层。
 * 布局用 position: fixed + 100vh（见 sheet.wxss）：
 * 组件节点在 Skyline 下会成为定位参照物，absolute 会把面板摆到组件所在位置（页面底部/屏幕外）。
 */
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: ''
    },
    closable: {
      type: Boolean,
      value: true
    },
    maskClosable: {
      type: Boolean,
      value: true
    }
  },
  methods: {
    onMask() {
      if (!this.data.maskClosable) return
      this.triggerEvent('close', {})
    },
    onClose() {
      if (!this.data.closable) return
      this.triggerEvent('close', {})
    },
    noop() {}
  }
})
