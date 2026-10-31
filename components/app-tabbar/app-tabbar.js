const tabs = require('../../utils/tabs')

Component({
  properties: {
    current: {
      type: String,
      value: 'index'
    }
  },
  data: {
    tabs: tabs.TABS,
    iconsBroken: false
  },
  methods: {
    // 任意一个图标加载失败就整体退回 emoji，避免出现只有文字的标签栏
    onIconError() {
      if (this.data.iconsBroken) return
      this.setData({ iconsBroken: true })
    },
    onTap(event) {
      const key = event.currentTarget.dataset.key
      if (!key || key === this.data.current) return
      tabs.switchTo(key)
    }
  }
})
