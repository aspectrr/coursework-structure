import { type NextRequest, NextResponse } from 'next/server';
import { writeNote, notePath } from '@/lib/notes';
import { slugify } from '@/lib/slug';

export const dynamic = 'force-dynamic';

// POST /api/notes
// body: { courseSlug, type, order, titleSlug, content }
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { courseSlug, type, order, titleSlug, content } = body as {
    courseSlug?: string;
    type?: 'course' | 'lecture' | 'assignment';
    order?: number | null;
    titleSlug?: string;
    content?: string;
  };

  if (!courseSlug || !type || !titleSlug || typeof content !== 'string') {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  const rel = notePath(courseSlug, type, order ?? null, slugify(titleSlug));
  await writeNote(rel, content);
  return NextResponse.json({ ok: true, path: rel });
}
