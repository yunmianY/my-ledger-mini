/**
 * 自选时刻面板：小时 24 格 + 分钟 60 格，配几个常用时间快捷项。
 * 与 calendar-panel 同一套视觉，不用原生 picker。
 */
const dateUtil = require('../../utils/date')

function padList(count) {
  const list = []
  for (let i = 0; i < count; i++) {
    list.push(dateUtil.pad2(i))
  }
  return list
}

const HOURS = padList(24)
const MINUTES = padList(60)
const PRESETS = [
  { key: 'now', label: '现在' },
  { key: '08:00', label: '08:00' },
  { key: '12:00', label: '12:00' },
  { key: '18:00', label: '18:00' },
  { key: '22:00', label: '22:00' }
]

Component({
  properties: {
    value: {
      type: String,
      value: '',
      observer: 'sync'
    }
  },
  data: {
    hours: HOURS,
    minutes: MINUTES,
    presets: PRESETS,
    hour: '12',
    minute: '00'
  },
  lifetimes: {
    attached() {
      this.sync(this.data.value)
    }
  },
  methods: {
    sync(value) {
      const normalized = dateUtil.normalizeTime(value) || dateUtil.nowTime()
      const parts = normalized.split(':')
      this.setData({ hour: parts[0], minute: parts[1] })
    },
    onPick(event) {
      const unit = event.currentTarget.dataset.unit
      const value = event.currentTarget.dataset.v
      if (!unit || !value) return
      if (unit === 'hour') {
        this.setData({ hour: value })
      } else {
        this.setData({ minute: value })
      }
    },
    onPreset(event) {
      const key = event.currentTarget.dataset.key
      if (!key) return
      if (key === 'now') {
        this.sync(dateUtil.nowTime())
      } else {
        this.sync(key)
      }
    },
    onCancel() {
      this.triggerEvent('cancel', {})
    },
    onConfirm() {
      this.triggerEvent('confirm', { time: this.data.hour + ':' + this.data.minute })
    }
  }
})
