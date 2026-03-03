export const DEFAULT_MESSAGE_CHUNK_SIZE = 200;

export function getInitialVisibleMessageCount(
  totalMessages: number,
  chunkSize = DEFAULT_MESSAGE_CHUNK_SIZE
) {
  return Math.min(totalMessages, chunkSize);
}

export function getNextVisibleMessageCount(
  currentVisible: number,
  totalMessages: number,
  chunkSize = DEFAULT_MESSAGE_CHUNK_SIZE
) {
  return Math.min(totalMessages, currentVisible + chunkSize);
}

export function getVisibleMessages<T>(items: T[], visibleCount: number): T[] {
  if (visibleCount >= items.length) {
    return items;
  }

  return items.slice(items.length - visibleCount);
}
