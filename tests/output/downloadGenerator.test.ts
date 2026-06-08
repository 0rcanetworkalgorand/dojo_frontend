import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildFilename, generateMarkdownFile, triggerDownload, DownloadOptions } from '@/lib/utils/downloadGenerator';
import { LaneType } from '@/lib/types';

describe('buildFilename', () => {
  it('produces a kebab-case filename with taskId and title ending in .md', () => {
    const result = buildFilename('abc123', 'My Task Title');
    expect(result).toBe('abc123-my-task-title.md');
  });

  it('contains only lowercase alphanumeric characters, hyphens, and .md extension', () => {
    const result = buildFilename('TASK-99', 'Hello World! @#$%');
    expect(result).toMatch(/^[a-z0-9-]+\.md$/);
  });

  it('truncates the filename to at most 80 characters', () => {
    const longTitle = 'a'.repeat(200);
    const result = buildFilename('id1', longTitle);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result.endsWith('.md')).toBe(true);
  });

  it('incorporates the taskId in the filename', () => {
    const result = buildFilename('task42', 'Some Title');
    expect(result).toContain('task42');
  });

  it('is deterministic (same inputs produce same output)', () => {
    const a = buildFilename('xyz', 'Repeatable Title');
    const b = buildFilename('xyz', 'Repeatable Title');
    expect(a).toBe(b);
  });

  it('handles special characters in title by removing them', () => {
    const result = buildFilename('t1', 'Hello!!! @World#');
    expect(result).toBe('t1-hello-world.md');
  });

  it('handles empty title gracefully', () => {
    const result = buildFilename('abc', '');
    expect(result).toBe('abc.md');
  });

  it('handles title with only special characters', () => {
    const result = buildFilename('abc', '!@#$%');
    expect(result).toBe('abc.md');
  });

  it('collapses consecutive hyphens', () => {
    const result = buildFilename('id', 'hello---world');
    expect(result).toBe('id-hello-world.md');
  });

  it('handles unicode characters by removing them', () => {
    const result = buildFilename('id1', '日本語テスト hello');
    expect(result).toBe('id1-hello.md');
  });
});

describe('generateMarkdownFile', () => {
  const validOptions: DownloadOptions = {
    taskId: 'abc123',
    taskTitle: 'Test Task',
    content: 'This is the task output content.',
    lane: LaneType.CODE,
    agentAddress: 'ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234',
    completionDate: '2024-01-15T10:30:00Z',
  };

  it('produces a Blob with correct MIME type', () => {
    const blob = generateMarkdownFile(validOptions);
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('text/markdown;charset=utf-8');
  });

  it('produces valid YAML frontmatter with all metadata fields', async () => {
    const blob = generateMarkdownFile(validOptions)!;
    const text = await blob.text();

    expect(text).toMatch(/^---\n/);
    expect(text).toContain('title: "Test Task"');
    expect(text).toContain('taskId: "abc123"');
    expect(text).toContain('lane: "CODE"');
    expect(text).toContain(`agent: "${validOptions.agentAddress}"`);
    expect(text).toContain('completedAt: "2024-01-15T10:30:00Z"');
    // Frontmatter is closed
    expect(text).toMatch(/---\n.*\n---/s);
  });

  it('includes task title as h1 heading', async () => {
    const blob = generateMarkdownFile(validOptions)!;
    const text = await blob.text();
    expect(text).toContain('# Test Task');
  });

  it('preserves original content character-for-character', async () => {
    const blob = generateMarkdownFile(validOptions)!;
    const text = await blob.text();

    // Content appears after frontmatter and heading
    const contentSection = text.split('# Test Task\n\n')[1];
    expect(contentSection).toBe(validOptions.content);
  });

  it('returns null for empty content', () => {
    const result = generateMarkdownFile({ ...validOptions, content: '' });
    expect(result).toBeNull();
  });

  it('returns null for whitespace-only content', () => {
    const result = generateMarkdownFile({ ...validOptions, content: '   \n\t  ' });
    expect(result).toBeNull();
  });

  it('returns null when file size exceeds 10MB', () => {
    const largeContent = 'x'.repeat(11 * 1024 * 1024); // >10MB
    const result = generateMarkdownFile({ ...validOptions, content: largeContent });
    expect(result).toBeNull();
  });

  it('produces a file just under 10MB when content is large but fits', () => {
    // Create content that when combined with frontmatter fits under 10MB
    const content = 'a'.repeat(9 * 1024 * 1024);
    const result = generateMarkdownFile({ ...validOptions, content });
    expect(result).not.toBeNull();
  });
});

describe('triggerDownload', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLSpy = vi.fn().mockReturnValue('blob:http://localhost/test-blob');
    revokeObjectURLSpy = vi.fn();
    global.URL.createObjectURL = createObjectURLSpy;
    global.URL.revokeObjectURL = revokeObjectURLSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a blob URL and triggers a click on an anchor element', () => {
    const blob = new Blob(['test'], { type: 'text/markdown' });
    const clickSpy = vi.fn();
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      // Spy on click when the anchor is appended
      (node as HTMLAnchorElement).click = clickSpy;
      return node;
    });

    triggerDownload(blob, 'test-file.md');

    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();

    appendChildSpy.mockRestore();
  });

  it('sets the download attribute on the anchor element', () => {
    const blob = new Blob(['test'], { type: 'text/markdown' });
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');

    triggerDownload(blob, 'my-download.md');

    const anchor = appendChildSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('my-download.md');
    expect(anchor.href).toBe('blob:http://localhost/test-blob');
  });
});
