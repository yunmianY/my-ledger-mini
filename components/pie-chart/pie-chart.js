/**
 * 环形饼图：canvas 2d 绘制，中心挖空。
 * 点击时按落点角度反查是哪一块，抛 slice 事件。
 *
 * slices: [{ categoryId, name, ratio, color }]
 */
Component({
  properties: {
    slices: {
      type: Array,
      value: [],
      observer: 'onDataChange'
    }
  },
  data: {
    canvasWidth: 300,
    canvasHeight: 300
  },
  lifetimes: {
    ready() {
      this.initCanvas()
    }
  },
  methods: {
    initCanvas() {
      const query = this.createSelectorQuery()
      query.select('#pie').fields({ node: true, size: true }).exec((res) => {
        const info = res && res[0]
        if (!info || !info.node) return
        const canvas = info.node
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let pixelRatio = 2
        try {
          const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
          pixelRatio = windowInfo.pixelRatio || 2
        } catch (err) {
          pixelRatio = 2
        }

        canvas.width = info.width * pixelRatio
        canvas.height = info.height * pixelRatio
        ctx.scale(pixelRatio, pixelRatio)

        this._ctx = ctx
        this._width = info.width
        this._height = info.height
        this.draw()
      })
    },

    onDataChange() {
      if (this._ctx) this.draw()
    },

    /** 环的外内半径 */
    radiuses() {
      const size = Math.min(this._width || 0, this._height || 0)
      const outer = size / 2 - 6
      return { outer: outer, inner: outer * 0.56 }
    },

    draw() {
      const ctx = this._ctx
      if (!ctx) return
      const width = this._width
      const height = this._height
      const cx = width / 2
      const cy = height / 2
      const r = this.radiuses()

      ctx.clearRect(0, 0, width, height)

      const slices = this.data.slices || []
      let start = -Math.PI / 2
      slices.forEach(function (slice) {
        const sweep = (Number(slice.ratio) || 0) * Math.PI * 2
        if (sweep <= 0) return
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, r.outer, start, start + sweep)
        ctx.closePath()
        ctx.fillStyle = slice.color || '#CCCCCC'
        ctx.fill()
        start += sweep
      })

      // 挖空成环形
      ctx.beginPath()
      ctx.arc(cx, cy, r.inner, 0, Math.PI * 2)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
    },

    onTap(event) {
      const touch = (event.touches && event.touches[0]) ||
        (event.changedTouches && event.changedTouches[0])
      if (!touch) return

      this.createSelectorQuery().select('#pie').boundingClientRect((rect) => {
        if (!rect) return
        const dx = touch.clientX - rect.left - rect.width / 2
        const dy = touch.clientY - rect.top - rect.height / 2
        const dist = Math.sqrt(dx * dx + dy * dy)
        const size = Math.min(rect.width, rect.height)
        const outer = size / 2 - 6
        const inner = outer * 0.56
        // 只在环上生效，点中心或圆外忽略
        if (dist > outer || dist < inner) return

        let angle = Math.atan2(dy, dx) + Math.PI / 2
        if (angle < 0) angle += Math.PI * 2

        const slices = this.data.slices || []
        let acc = 0
        for (let i = 0; i < slices.length; i++) {
          acc += (Number(slices[i].ratio) || 0) * Math.PI * 2
          if (angle <= acc) {
            this.triggerEvent('slice', {
              categoryId: slices[i].categoryId,
              name: slices[i].name
            })
            return
          }
        }
      }).exec()
    }
  }
})
