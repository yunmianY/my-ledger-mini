/**
 * 统一图标：优先用户上传的图片，其次内置 SVG，最后退回 emoji。
 *
 * 内置 SVG 走 <image src="/svg/...">；万一某台设备或渲染器不认 SVG，
 * binderror 会把它降级成 emoji，不至于出现空白。
 */
const icons = require('../../utils/icons')

Component({
  properties: {
    // 内置图标 key，见 utils/icons.js
    iconKey: {
      type: String,
      value: '',
      observer: 'rebuild'
    },
    // 用户上传的图片路径，优先级最高
    path: {
      type: String,
      value: '',
      observer: 'rebuild'
    },
    emoji: {
      type: String,
      value: '📌',
      observer: 'rebuild'
    },
    // 图标展示尺寸（rpx），图片按此尺寸等比缩放
    size: {
      type: Number,
      value: 40,
      observer: 'rebuild'
    }
  },
  data: {
    src: '',
    emojiText: '📌',
    emojiSize: 32
  },
  lifetimes: {
    attached() {
      this.rebuild()
    }
  },
  methods: {
    rebuild() {
      const size = Number(this.data.size) || 40
      const src = this._failed ? '' : (this.data.path || icons.path(this.data.iconKey))
      this.setData({
        src: src,
        emojiText: this.data.emoji || '📌',
        emojiSize: Math.round(size * 0.8)
      })
    },
    onError(event) {
      // SVG 加载失败（或文件不存在）→ 永久降级为 emoji
      console.warn('[app-icon] load failed:', this.data.src, event && event.detail && event.detail.errMsg)
      this._failed = true
      this.setData({ src: '' })
    }
  }
})
