export class LruCache<K, V> {
  private readonly maxSize: number;
  private readonly map = new Map<K, V>();

  constructor(maxSize: number) {
    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      throw new Error("LruCache maxSize must be a positive integer");
    }

    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) {
      return undefined;
    }

    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value as V);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    this.map.set(key, value);

    if (this.map.size > this.maxSize) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}
