Component({
  properties: {
    item: {
      type: Object,
      value: {}
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('itemtap', { id: this.data.item.id })
    },
    onLong() {
      this.triggerEvent('itemlong', { id: this.data.item.id })
    }
  }
})
