/**
 * Content Splitter Utility
 *
 * Splits HTML content into non-contiguous DOM segments and inserts invisible
 * decoy characters to deter programmatic text extraction via textContent scraping.
 *
 * Requirements: 8.2, 8.4
 */

export interface SplitResult {
  segments: string[];       // HTML segments (min 3 per block)
  decoyPositions: number[]; // indices where decoys are inserted
}

/** Zero-width space (U+200B) used as decoy character */
const ZERO_WIDTH_SPACE = '\u200B';
/** Zero-width joiner (U+200D) used as decoy character */
const ZERO_WIDTH_JOINER = '\u200D';

/** Decoy characters cycled through for variety */
const DECOY_CHARS = [ZERO_WIDTH_SPACE, ZERO_WIDTH_JOINER];

/** Wraps a decoy character in an accessible-hidden, zero-width span */
function wrapDecoy(char: string): string {
  return `<span aria-hidden="true" style="font-size:0;position:absolute">${char}</span>`;
}

/**
 * Counts visible characters in an HTML string by stripping all tags.
 * Visible characters are those that would appear in rendered text output.
 */
function countVisibleChars(html: string): number {
  const textOnly = html.replace(/<[^>]*>/g, '');
  return textOnly.length;
}

/**
 * Splits HTML content into at least 3 non-contiguous DOM segments per block.
 *
 * The splitting strategy:
 * 1. Determine split points based on visible character count
 * 2. Split at safe boundaries (between tags or at word boundaries)
 * 3. Insert decoys into each segment
 * 4. Return segments and decoy positions
 *
 * @param html - The HTML string to split and obfuscate
 * @returns SplitResult with segments and decoy positions
 */
export function splitContent(html: string): SplitResult {
  if (!html || html.trim().length === 0) {
    return { segments: ['', '', ''], decoyPositions: [] };
  }

  const visibleCount = countVisibleChars(html);
  const minSegments = Math.max(3, Math.ceil(visibleCount / 100));
  const segments: string[] = splitIntoSegments(html, minSegments);

  // Ensure minimum 3 segments
  while (segments.length < 3) {
    segments.push('');
  }

  // Insert decoys into each segment and track positions
  const decoyPositions: number[] = [];
  let globalOffset = 0;

  const processedSegments = segments.map((segment) => {
    const result = insertDecoys(segment, 50);
    // Track decoy positions relative to the overall content
    const segmentVisibleCount = countVisibleChars(segment);
    for (let i = 50; i <= segmentVisibleCount; i += 50) {
      decoyPositions.push(globalOffset + i);
    }
    globalOffset += segmentVisibleCount;
    return result;
  });

  // Verify 10% decoy ratio - add extra decoys if needed
  const totalVisible = countVisibleChars(html);
  const totalDecoys = countDecoysInSegments(processedSegments);
  const requiredDecoys = Math.ceil(totalVisible * 0.1);

  if (totalDecoys < requiredDecoys) {
    // Add additional decoys to meet the 10% threshold
    const additionalNeeded = requiredDecoys - totalDecoys;
    return boostDecoys(processedSegments, additionalNeeded, decoyPositions);
  }

  return { segments: processedSegments, decoyPositions };
}

/**
 * Splits HTML into the requested number of segments at safe boundaries.
 * Avoids splitting inside HTML tags.
 */
function splitIntoSegments(html: string, targetCount: number): string[] {
  if (html.length === 0) return ['', '', ''];

  // Find safe split points (outside of HTML tags, at text boundaries)
  const splitPoints = findSafeSplitPoints(html, targetCount);

  const segments: string[] = [];
  let lastIndex = 0;

  for (const point of splitPoints) {
    segments.push(html.slice(lastIndex, point));
    lastIndex = point;
  }
  // Add the final segment
  segments.push(html.slice(lastIndex));

  // Filter out truly empty segments but keep at least 3
  const nonEmpty = segments.filter(s => s.length > 0);
  if (nonEmpty.length >= 3) return nonEmpty;

  // Pad with empty strings to ensure minimum 3
  while (nonEmpty.length < 3) {
    nonEmpty.push('');
  }
  return nonEmpty;
}

/**
 * Finds safe split points in HTML that don't break tags.
 */
function findSafeSplitPoints(html: string, targetCount: number): number[] {
  const points: number[] = [];
  const segmentSize = Math.floor(html.length / targetCount);

  for (let i = 1; i < targetCount; i++) {
    const approxPoint = i * segmentSize;
    const safePoint = findNearestSafePoint(html, approxPoint);
    if (safePoint > 0 && safePoint < html.length && !points.includes(safePoint)) {
      points.push(safePoint);
    }
  }

  return points.sort((a, b) => a - b);
}

/**
 * Finds the nearest safe split point (outside tags, preferably at whitespace).
 */
function findNearestSafePoint(html: string, target: number): number {
  // Ensure we're not inside a tag
  let insideTag = false;
  let adjustedTarget = target;

  // Look backwards to find if we're inside a tag
  for (let i = target; i >= Math.max(0, target - 100); i--) {
    if (html[i] === '>') break; // We're after a closing tag bracket, safe
    if (html[i] === '<') {
      insideTag = true;
      adjustedTarget = i; // Move before the tag
      break;
    }
  }

  if (insideTag) {
    return adjustedTarget;
  }

  // Look for nearest whitespace or tag boundary within ±50 chars
  const searchRadius = 50;
  const start = Math.max(0, adjustedTarget - searchRadius);
  const end = Math.min(html.length, adjustedTarget + searchRadius);

  // Prefer splitting after a closing tag
  for (let i = adjustedTarget; i < end; i++) {
    if (html[i] === '>' && (i + 1 >= html.length || html[i + 1] !== '<' || true)) {
      return i + 1;
    }
  }

  // Otherwise split at whitespace
  for (let i = adjustedTarget; i < end; i++) {
    if (html[i] === ' ' || html[i] === '\n' || html[i] === '\t') {
      return i;
    }
  }

  // Look backwards for whitespace
  for (let i = adjustedTarget; i > start; i--) {
    if (html[i] === ' ' || html[i] === '\n' || html[i] === '\t') {
      return i;
    }
  }

  return adjustedTarget;
}

/**
 * Inserts invisible decoy characters into an HTML segment.
 *
 * Inserts 1 decoy character per `ratio` visible characters. Decoys are
 * zero-width Unicode characters wrapped in aria-hidden spans so they are
 * invisible to users and screen readers but pollute textContent extraction.
 *
 * @param segment - HTML string to insert decoys into
 * @param ratio - Number of visible characters between each decoy (default: 50)
 * @returns HTML string with decoy spans inserted
 */
export function insertDecoys(segment: string, ratio: number = 50): string {
  if (!segment || segment.length === 0) return segment;
  if (ratio <= 0) return segment;

  let result = '';
  let visibleCount = 0;
  let insideTag = false;
  let decoyIndex = 0;

  for (let i = 0; i < segment.length; i++) {
    const char = segment[i];

    if (char === '<') {
      insideTag = true;
      result += char;
      continue;
    }

    if (char === '>') {
      insideTag = false;
      result += char;
      continue;
    }

    if (insideTag) {
      result += char;
      continue;
    }

    // This is a visible character
    visibleCount++;
    result += char;

    // Insert a decoy after every `ratio` visible characters
    if (visibleCount % ratio === 0) {
      const decoyChar = DECOY_CHARS[decoyIndex % DECOY_CHARS.length];
      result += wrapDecoy(decoyChar);
      decoyIndex++;
    }
  }

  return result;
}

/**
 * Counts the number of decoy characters present in processed segments.
 */
function countDecoysInSegments(segments: string[]): number {
  let count = 0;
  for (const segment of segments) {
    // Count occurrences of our decoy wrapper pattern
    const matches = segment.match(/<span aria-hidden="true" style="font-size:0;position:absolute">/g);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Adds additional decoys to segments to meet the 10% minimum ratio.
 * Distributes extra decoys evenly across segments.
 */
function boostDecoys(
  segments: string[],
  additionalNeeded: number,
  existingPositions: number[]
): SplitResult {
  const decoyPositions = [...existingPositions];
  const nonEmptySegments = segments.filter(s => countVisibleChars(s) > 0);
  const perSegment = Math.ceil(additionalNeeded / Math.max(1, nonEmptySegments.length));

  const boostedSegments = segments.map((segment) => {
    if (countVisibleChars(segment) === 0) return segment;

    let boosted = '';
    let visibleCount = 0;
    let insideTag = false;
    let decoysAdded = 0;
    const interval = Math.max(1, Math.floor(countVisibleChars(segment) / (perSegment + 1)));

    for (let i = 0; i < segment.length; i++) {
      const char = segment[i];

      if (char === '<') {
        insideTag = true;
        boosted += char;
        continue;
      }

      if (char === '>') {
        insideTag = false;
        boosted += char;
        continue;
      }

      if (insideTag) {
        boosted += char;
        continue;
      }

      visibleCount++;
      boosted += char;

      if (decoysAdded < perSegment && visibleCount % interval === 0) {
        const decoyChar = DECOY_CHARS[decoysAdded % DECOY_CHARS.length];
        boosted += wrapDecoy(decoyChar);
        decoysAdded++;
        decoyPositions.push(visibleCount);
      }
    }

    return boosted;
  });

  return { segments: boostedSegments, decoyPositions };
}
