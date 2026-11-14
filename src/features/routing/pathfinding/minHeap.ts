/** Binary min-heap priority queue. Lower priority values pop first. */
export class MinHeap<T> {
  private readonly items: T[] = []
  private readonly priorities: number[] = []

  get size(): number {
    return this.items.length
  }

  push(item: T, priority: number): void {
    this.items.push(item)
    this.priorities.push(priority)
    this.siftUp(this.items.length - 1)
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined
    const top = this.items[0]
    const lastItem = this.items.pop() as T
    const lastPriority = this.priorities.pop() as number
    if (this.items.length > 0) {
      this.items[0] = lastItem
      this.priorities[0] = lastPriority
      this.siftDown(0)
    }
    return top
  }

  private swap(i: number, j: number): void {
    ;[this.items[i], this.items[j]] = [this.items[j], this.items[i]]
    ;[this.priorities[i], this.priorities[j]] = [
      this.priorities[j],
      this.priorities[i],
    ]
  }

  private siftUp(index: number): void {
    let i = index
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.priorities[parent] <= this.priorities[i]) return
      this.swap(i, parent)
      i = parent
    }
  }

  private siftDown(index: number): void {
    const n = this.items.length
    let i = index
    for (;;) {
      const left = 2 * i + 1
      const right = left + 1
      let smallest = i
      if (left < n && this.priorities[left] < this.priorities[smallest]) {
        smallest = left
      }
      if (right < n && this.priorities[right] < this.priorities[smallest]) {
        smallest = right
      }
      if (smallest === i) return
      this.swap(i, smallest)
      i = smallest
    }
  }
}
