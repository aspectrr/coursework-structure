import { promises as fs } from 'node:fs';
import path from 'node:path';

const NOTES_ROOT = process.env.NOTES_DIR ?? '/notes';

// Build a stable, slug-like filename for a note.
// Course-level note:    {courseSlug}.md
// Lecture-level note:   {courseSlug}/lec-01-{slug}.md
// Assignment-level:     {courseSlug}/hw-01-{slug}.md
export function notePath(courseSlug: string, type: 'course' | 'lecture' | 'assignment', order: number | null, titleSlug: string): string {
  if (type === 'course') return path.posix.join(courseSlug, `${courseSlug}.md`);
  const prefix = type === 'lecture' ? 'lec' : 'hw';
  const ord = order !== null ? `${String(order).padStart(2, '0')}-` : '';
  return path.posix.join(courseSlug, `${prefix}-${ord}${titleSlug}.md`);
}

export async function readNote(relPath: string): Promise<string | null> {
  const abs = path.join(NOTES_ROOT, relPath);
  try {
    return await fs.readFile(abs, 'utf8');
  } catch {
    return null;
  }
}

export async function writeNote(relPath: string, content: string): Promise<void> {
  const abs = path.join(NOTES_ROOT, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
}

// Extract [[wiki-links]] from markdown
export function extractWikiLinks(md: string): string[] {
  const re = /\[\[([^\]\n|#]+)(?:[#|][^\]\n]*)?\]\]/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    out.add(m[1].trim());
  }
  return [...out];
}

// Compute backlinks: scan all notes, find ones linking to targetSlug
export async function computeBacklinks(targetSlug: string): Promise<Array<{ from: string; path: string }>> {
  // Walk NOTES_ROOT
  const result: Array<{ from: string; path: string }> = [];
  async function walk(dir: string) {
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile() && e.name.endsWith('.md')) {
        const content = await fs.readFile(full, 'utf8');
        const links = extractWikiLinks(content);
        if (links.some((l) => l.toLowerCase() === targetSlug.toLowerCase())) {
          result.push({ from: e.name.replace(/\.md$/, ''), path: path.relative(NOTES_ROOT, full) });
        }
      }
    }
  }
  await walk(NOTES_ROOT);
  return result;
}
