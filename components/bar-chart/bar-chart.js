/**
 * 纯 view 手绘柱状图：不依赖 canvas，避免 Skyline 下的兼容问题。
 * series: [{ month: '2026-01', expense, income }]
 */
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
    bars: []
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
      let max = 0
      series.forEach(function (row) {
        const value = type === 'income' ? row.income : row.expense
        if (value > max) max = value
      })
      const bars = series.map(function (row) {
        const value = type === 'income' ? row.income : row.expense
        const height = max ? Math.max(value > 0 ? 4 : 0, Math.round(value * 100 / max)) : 0
        return {
          month: row.month,
          label: String(Number(String(row.month).split('-')[1])),
          height: height,
          active: row.month === active
        }
      })
      this.setData({ bars: bars })
    }
  }
})
