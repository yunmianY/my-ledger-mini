Component({
  properties: {
    percent: {
      type: Number,
      value: 0,
      observer: 'clamp'
    },
    color: {
      type: String,
      value: '#F4A261'
    }
  },
  data: {
    width: 0
  },
  lifetimes: {
    attached() {
      this.clamp(this.data.percent)
    }
  },
  methods: {
    clamp(value) {
      const num = Number(value) || 0
      this.setData({ width: Math.max(0, Math.min(100, Math.round(num))) })
    }
  }
})
