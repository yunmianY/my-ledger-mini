/**
 * 折线图：纯 view 实现（圆点 + 旋转的细线），不依赖 canvas。
 * 所有坐标都用 rpx 计算，所以不同屏幕下比例一致。
 */
const COLOR = {
  expense: '#E4572E',
  income: '#2A9D8F'
}

Component({
  properties: {
    series: {
      type: Array,
      value: [],
      observer: 'rebuild'
    },
    type: {
      type: String,
      value: 'expense',
      observer: 'rebuild'
    },
    activeMonth: {
      type: String,
      value: '',
      observer: 'rebuild'
    }
  },
  data: {
    width: 620,
    height: 180,
    stroke: COLOR.expense,
    points: [],
    segments: []
  },
  lifetimes: {
    attached() {
      this.rebuild()
    }
  },
  methods: {
    rebuild() {
      const series = this.data.series || []
      const type = this.data.type
      const active = this.data.activeMonth
      const stroke = type === 'income' ? COLOR.income : COLOR.expense
      const width = this.data.width
      const height = this.data.height
      const padX = 14
      const padY = 14

      let max = 0
      series.forEach(function (row) {
        const value = type === 'income' ? row.income : row.expense
        if (value > max) max = value
      })

      const innerWidth = width - padX * 2
      const innerHeight = height - padY * 2
      const step = series.length > 1 ? innerWidth / (series.length - 1) : 0

      const points = series.map(function (row, index) {
        const value = type === 'income' ? row.income : row.expense
        const ratio = max ? value / max : 0
        return {
          month: row.month,
          label: String(Number(String(row.month).split('-')[1])),
          x: padX + step * index,
          y: height - padY - ratio * innerHeight,
          active: row.month === active
        }
      })

      const segments = []
      for (let i = 0; i < points.length - 1; i++) {
        const from = points[i]
        const to = points[i + 1]
        const dx = to.x - from.x
        const dy = to.y - from.y
        segments.push({
          key: from.month + '_' + to.month,
          x: from.x,
          y: from.y,
          len: Math.sqrt(dx * dx + dy * dy),
          angle: Math.atan2(dy, dx) * 180 / Math.PI
        })
      }

      this.setData({
        stroke: stroke,
        points: points,
        segments: segments
      })
    }
  }
})
