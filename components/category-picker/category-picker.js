Component({
  properties: {
    categories: {
      type: Array,
      value: []
    },
    selectedId: {
      type: String,
      value: ''
    }
  },
  methods: {
    onTap(event) {
      const id = event.currentTarget.dataset.id
      if (!id) return
      this.triggerEvent('change', { id: id })
    }
  }
})
