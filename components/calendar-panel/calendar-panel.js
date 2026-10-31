/**
 * 自绘日历：不依赖 picker，避开渲染器差异，也便于以后加「有账单的日子」标记。
 */
const dateUtil = require('../../utils/date')

Component({
  properties: {
    value: {
      type: String,
      value: '',
      observer: 'onValueChange'
    }
  },
  data: {
    month: '',
    label: '',
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
    cells: []
  },
  lifetimes: {
    attached() {
      const value = this.data.value || dateUtil.todayStr()
      this.build(value.slice(0, 7), value)
    }
  },
  methods: {
    onValueChange(next) {
      if (!next) return
      this.build(next.slice(0, 7), next)
    },
    cellOf(month, day, inMonth, selected, today) {
      const dateStr = month + '-' + dateUtil.pad2(day)
      return {
        key: dateStr,
        day: day,
        date: dateStr,
        inMonth: inMonth,
        isToday: dateStr === today,
        selected: dateStr === selected
      }
    },
    build(month, selected) {
      if (!month) return
      const today = dateUtil.todayStr()
      const days = dateUtil.daysInMonth(month)
      const leading = dateUtil.weekdayIndex(month + '-01')
      const prevMonth = dateUtil.shiftMonth(month, -1)
      const prevDays = dateUtil.daysInMonth(prevMonth)
      const cells = []
      for (let i = leading - 1; i >= 0; i--) {
        cells.push(this.cellOf(prevMonth, prevDays - i, false, selected, today))
      }
      for (let day = 1; day <= days; day++) {
        cells.push(this.cellOf(month, day, true, selected, today))
      }
      const nextMonth = dateUtil.shiftMonth(month, 1)
      let nextDay = 1
      while (cells.length % 7 !== 0) {
        cells.push(this.cellOf(nextMonth, nextDay, false, selected, today))
        nextDay += 1
      }
      this.setData({
        month: month,
        label: dateUtil.monthLabel(month),
        cells: cells
      })
    },
    prev() {
      const month = dateUtil.shiftMonth(this.data.month, -1)
      this.build(month, this.data.value)
      this.triggerEvent('monthchange', { month: month })
    },
    next() {
      const month = dateUtil.shiftMonth(this.data.month, 1)
      this.build(month, this.data.value)
      this.triggerEvent('monthchange', { month: month })
    },
    onDay(event) {
      const date = event.currentTarget.dataset.date
      if (!date) return
      this.triggerEvent('select', { date: date })
    }
  }
})
