/**
 * 数字键盘：只管抛按键，不持有金额状态。
 * 金额拼接规则在 utils/amount-input.js，便于复用和测试。
 */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']

Component({
  properties: {
    disabled: {
      type: Boolean,
      value: false
    },
    saveText: {
      type: String,
      value: '保存'
    }
  },
  data: {
    keys: KEYS
  },
  methods: {
    onKey(event) {
      const key = event.currentTarget.dataset.key
      if (!key) return
      this.triggerEvent('key', { key: key })
    },
    onSave() {
      if (this.data.disabled) return
      this.triggerEvent('save', {})
    },
    onAgain() {
      this.triggerEvent('again', {})
    }
  }
})
