/**
 * Common English stop words for deduplication filtering.
 * These are filtered out before Jaccard similarity calculation
 * to reduce false positive duplicate detection.
 */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may',
  'new', 'now', 'old', 'see', 'way', 'who', 'oil', 'sit', 'use', 'get',
  'day', 'lot', 'say', 'she', 'too', 'two', 'want', 'well', 'been', 'call',
  'come', 'each', 'find', 'give', 'good', 'here', 'just', 'know', 'look',
  'made', 'make', 'more', 'most', 'must', 'name', 'need', 'next', 'only',
  'over', 'part', 'same', 'such', 'take', 'than', 'that', 'their',
  'them', 'then', 'there', 'these', 'they', 'this', 'time', 'turn', 'under',
  'very', 'what', 'when', 'where', 'which', 'will', 'with', 'work', 'your'
]);