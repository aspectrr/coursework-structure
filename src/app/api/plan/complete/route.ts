import { type NextRequest, NextResponse } from 'next/server';
import { markItem } from '@/lib/plan';

export const dynamic = 'force-dynamic';

// POST /api/plan/complete  form: itemId, status?, redirect?
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const itemId = String(form.get('itemId') ?? '');
  const status = (form.get('status') as string | null) ?? 'completed';
  const redirect = (form.get('redirect') as string | null) ?? '/';

  if (!itemId) {
    return NextResponse.json({ error: 'itemId required' }, { status: 400 });
  }

  try {
    await markItem(itemId, status as any);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  if (req.headers.get('accept')?.includes('application/json')) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.redirect(new URL(redirect, req.url), 303);
}
