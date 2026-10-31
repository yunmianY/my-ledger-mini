/**
 * 月历：每格显示当天金额，按金额高低做深浅底色。
 * 只负责渲染和抛事件，月份切换由页面控制。
 */
const dateUtil = require('../../utils/date')

Component({
  properties: {
    month: {
      type: String,
      value: '',
      observer: 'rebuild'
    },
    // { 'YYYY-MM-DD': { cents, count } }
    marks: {
      type: Object,
      value: {},
      observer: 'rebuild'
    },
    selected: {
      type: String,
      value: '',
      observer: 'rebuild'
    },
    // 'expense' | 'income'，决定热度配色
    accent: {
      type: String,
      value: 'expense',
      observer: 'rebuild'
    }
  },
  data: {
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
    cells: []
  },
  lifetimes: {
    attached() {
      this.rebuild()
    }
  },
  methods: {
    /** 金额压缩成适合小格子的文本：1234 元 → 1234，123456 元 → 12.3万 */
    compact(cents) {
      const yuan = Math.round((Number(cents) || 0) / 100)
      if (yuan >= 10000) {
        return (Math.round(yuan / 1000) / 10) + '万'
      }
      return String(yuan)
    },

    rebuild() {
      const month = this.data.month
      if (!month) {
        this.setData({ cells: [] })
        return
      }
      const marks = this.data.marks || {}
      const selected = this.data.selected
      const today = dateUtil.todayStr()
      const accent = this.data.accent === 'income' ? 'i' : 'e'

      let max = 0
      Object.keys(marks).forEach(function (key) {
        const mark = marks[key]
        const cents = mark && mark.cents ? mark.cents : 0
        if (cents > max) max = cents
      })

      const days = dateUtil.daysInMonth(month)
      const leading = dateUtil.weekdayIndex(month + '-01')
      const prevMonth = dateUtil.shiftMonth(month, -1)
      const prevDays = dateUtil.daysInMonth(prevMonth)
      const cells = []

      for (let i = leading - 1; i >= 0; i--) {
        cells.push({ key: 'p' + i, day: prevDays - i, date: '', empty: true })
      }

      for (let day = 1; day <= days; day++) {
        const date = month + '-' + dateUtil.pad2(day)
        const mark = marks[date]
        const cents = mark && mark.cents ? mark.cents : 0
        let level = 0
        if (cents > 0 && max > 0) {
          const ratio = cents / max
          level = ratio > 0.66 ? 3 : (ratio > 0.33 ? 2 : 1)
        }
        cells.push({
          key: date,
          day: day,
          date: date,
          empty: false,
          cents: cents,
          level: level,
          levelClass: level ? 'heat-' + accent + '-' + level : '',
          amountText: cents > 0 ? '¥' + this.compact(cents) : '',
          isToday: date === today,
          selected: date === selected
        })
      }

      let nextDay = 1
      while (cells.length % 7 !== 0) {
        cells.push({ key: 'n' + nextDay, day: nextDay, date: '', empty: true })
        nextDay += 1
      }

      this.setData({ cells: cells })
    },

    onTap(event) {
      const date = event.currentTarget.dataset.date
      if (!date) return
      this.triggerEvent('daytap', { date: date })
    }
  }
})
