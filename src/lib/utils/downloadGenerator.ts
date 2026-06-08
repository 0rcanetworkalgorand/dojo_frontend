import { LaneType } from '@/lib/types';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_FILENAME_LENGTH = 80;

export interface DownloadOptions {
  taskId: string;
  taskTitle: string;
  content: string;
  lane: LaneType;
  agentAddress: string;
  completionDate: string; // ISO 8601
}

/**
 * Converts a string to kebab-case: lowercase alphanumeric characters separated by hyphens.
 * Removes all non-alphanumeric characters except spaces/hyphens, then normalizes separators.
 */
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric except spaces and hyphens
    .replace(/[\s_]+/g, '-')       // replace spaces/underscores with hyphens
    .replace(/-+/g, '-')           // collapse consecutive hyphens
    .replace(/^-|-$/g, '');        // trim leading/trailing hyphens
}

/**
 * Builds a kebab-case filename from a task ID and title.
 * The filename is at most 80 characters (including the `.md` extension),
 * contains only lowercase alphanumeric characters and hyphens, and incorporates the taskId.
 */
export function buildFilename(taskId: string, taskTitle: string): string {
  const kebabId = toKebabCase(taskId);
  const kebabTitle = toKebabCase(taskTitle);

  const extension = '.md';
  // Reserve space for: kebabId + '-' + extension
  const reservedLength = kebabId.length + 1 + extension.length;

  if (reservedLength >= MAX_FILENAME_LENGTH) {
    // taskId alone is very long; truncate it to fit with extension
    const maxIdLength = MAX_FILENAME_LENGTH - extension.length;
    return kebabId.slice(0, maxIdLength) + extension;
  }

  const availableForTitle = MAX_FILENAME_LENGTH - reservedLength;

  if (!kebabTitle) {
    // No usable title characters, just use the ID
    return kebabId + extension;
  }

  let truncatedTitle = kebabTitle.slice(0, availableForTitle);
  // Remove trailing hyphen after truncation
  truncatedTitle = truncatedTitle.replace(/-$/, '');

  if (!truncatedTitle) {
    return kebabId + extension;
  }

  return `${kebabId}-${truncatedTitle}${extension}`;
}

/**
 * Generates a UTF-8 Markdown file as a Blob with YAML frontmatter and the original content.
 * Returns `null` if content is empty/unavailable or if the resulting file exceeds 10MB.
 */
export function generateMarkdownFile(options: DownloadOptions): Blob | null {
  const { taskId, taskTitle, content, lane, agentAddress, completionDate } = options;

  // Return null for empty or unavailable content
  if (!content || content.trim().length === 0) {
    return null;
  }

  const frontmatter = [
    '---',
    `title: "${taskTitle}"`,
    `taskId: "${taskId}"`,
    `lane: "${lane}"`,
    `agent: "${agentAddress}"`,
    `completedAt: "${completionDate}"`,
    '---',
  ].join('\n');

  const heading = `# ${taskTitle}`;

  const fileContent = `${frontmatter}\n\n${heading}\n\n${content}`;

  // Check file size limit
  const encoder = new TextEncoder();
  const encoded = encoder.encode(fileContent);

  if (encoded.byteLength > MAX_FILE_SIZE_BYTES) {
    return null;
  }

  return new Blob([fileContent], { type: 'text/markdown;charset=utf-8' });
}

/**
 * Triggers a file download in the browser using a Blob URL and a hidden `<a download>` element.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  // Clean up after a short delay to allow the download to initiate
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 100);
}
