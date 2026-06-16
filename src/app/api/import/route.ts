import { NextResponse } from "next/server";
import { importAll } from "@/lib/importRunner";

export const dynamic = "force-dynamic";

// POST /api/import — scan /courses volume, import/update all MIT OCW folders
export async function POST() {
	const root = process.env.COURSES_DIR ?? "/courses";
	try {
		const results = await importAll(root);
		return NextResponse.json({ ok: true, results });
	} catch (e: any) {
		return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
	}
}
