import { db } from "@/db/client";
import { courses, sessions, items } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
	parseCourse,
	findCourseDirs,
	defaultLectureMinutes,
	defaultAssignmentMinutes,
	type ParsedCourse,
} from "./importer";

type ParsedLecture = ParsedCourse["lectures"][number];
type ParsedAssignment = ParsedCourse["assignments"][number];

// Insert (or update) parsed course data. Idempotent on course.slug.
// Re-import preserves completion status of items (matched by sourceKey).
export async function importCourse(parsed: ParsedCourse) {
	const {
		course,
		sessions: parsedSessions,
		lectures,
		assignments,
		courseRelPath,
	} = parsed;

	// Upsert course
	const existing = await db
		.select()
		.from(courses)
		.where(eq(courses.slug, course.slug))
		.limit(1);
	const now = new Date();
	let courseId: string;
	if (existing.length === 0) {
		const [inserted] = await db
			.insert(courses)
			.values({ ...course, status: "active", orderIndex: 0, updatedAt: now })
			.returning({ id: courses.id });
		courseId = inserted.id;
	} else {
		courseId = existing[0].id;
		await db
			.update(courses)
			.set({ ...course, updatedAt: now })
			.where(eq(courses.id, courseId));
	}

	// Snapshot prior completion by sourceKey (used in both update + fresh paths)
	const oldItems = await db
		.select()
		.from(items)
		.where(eq(items.courseId, courseId));
	const completionByKey = new Map<
		string,
		{ status: ItemStatus; startedAt: Date | null; completedAt: Date | null }
	>(
		oldItems
			.filter((i) => i.sourceKey)
			.map((i) => [
				i.sourceKey as string,
				{
					status: i.status,
					startedAt: i.startedAt,
					completedAt: i.completedAt,
				},
			]),
	);

	// Wipe children (sessions set-null, items cascade manually)
	await db.delete(sessions).where(eq(sessions.courseId, courseId));
	await db.delete(items).where(eq(items.courseId, courseId));

	await insertItems(
		courseId,
		lectures,
		assignments,
		parsedSessions,
		completionByKey,
		courseRelPath,
	);
	return { courseId, updated: existing.length > 0 };
}

type ItemStatus = (typeof items.$inferSelect)["status"];
type CompletionMap = Map<
	string,
	{ status: ItemStatus; startedAt: Date | null; completedAt: Date | null }
>;

async function insertItems(
	courseId: string,
	lectures: ParsedLecture[],
	assignments: ParsedAssignment[],
	parsedSessions: ParsedCourse["sessions"],
	completionByKey: CompletionMap,
	_courseRelPath: string,
) {
	type SessionRow = {
		orderIndex: number;
		number: string | null;
		title: string;
	};
	const sessionRows: SessionRow[] = [];

	if (parsedSessions.length > 0) {
		parsedSessions.forEach((s, i) =>
			sessionRows.push({
				orderIndex: i,
				number: s.sessionNumber,
				title: s.title,
			}),
		);
	} else {
		lectures.forEach((l, i) =>
			sessionRows.push({
				orderIndex: i,
				number: l.sessionNumber?.toString() ?? null,
				title: l.resource.title ?? `Lecture ${i + 1}`,
			}),
		);
		if (sessionRows.length === 0)
			sessionRows.push({ orderIndex: 0, number: null, title: "General" });
	}

	const sessionIds: (string | null)[] = [];
	for (const s of sessionRows) {
		const [row] = await db
			.insert(sessions)
			.values({
				courseId,
				orderIndex: s.orderIndex,
				sessionNumber: s.number,
				title: s.title,
			})
			.returning({ id: sessions.id });
		sessionIds.push(row.id);
	}

	const sessionByNumber = new Map<string, string>();
	sessionRows.forEach((s, i) => {
		if (s.number && sessionIds[i])
			sessionByNumber.set(s.number, sessionIds[i]!);
	});
	const firstSessionId = sessionIds[0] ?? null;

	// Lectures
	let itemOrder = 0;
	for (const lec of lectures) {
		const num = lec.sessionNumber?.toString() ?? null;
		const sessionId = (num && sessionByNumber.get(num)) || firstSessionId;
		const sourceKey = lec.sourceKey;
		const preserved = sourceKey ? completionByKey.get(sourceKey) : undefined;

		await db.insert(items).values({
			courseId,
			sessionId,
			type: "lecture",
			orderIndex: itemOrder++,
			title: lec.resource.title ?? `Lecture ${lec.sessionNumber ?? itemOrder}`,
			description: lec.resource.description ?? null,
			estimatedMinutes: defaultLectureMinutes(lec.resource),
			status: preserved?.status ?? "not_started",
			startedAt: preserved?.startedAt ?? null,
			completedAt: preserved?.completedAt ?? null,
			youtubeKey: lec.resource.youtube_key ?? null,
			archiveUrl: lec.resource.archive_url ?? null,
			thumbnailUrl: lec.resolved.thumbnailUrl ?? null,
			pdfPath: lec.resolved.pdfUrl,
			transcriptPath: lec.resolved.transcriptUrl,
			sourceKey,
			resourceType: lec.resource.resource_type ?? null,
			learningResourceTypes: lec.resource.learning_resource_types ?? null,
		});
	}

	// Assignment due-session map (from calendar markers like "1 due")
	const hwDueSession = new Map<number, string>();
	parsedSessions.forEach((s, i) => {
		const sid = sessionIds[i];
		if (!sid) return;
		for (const marker of s.assignmentMarkers) {
			const m = marker.match(/^(\d+)\s+(due|out)$/);
			if (!m) continue;
			const n = parseInt(m[1], 10);
			if (m[2] === "due") hwDueSession.set(n, sid);
		}
	});

	for (const hw of assignments) {
		const dueSid =
			hw.hwNumber !== null ? (hwDueSession.get(hw.hwNumber) ?? null) : null;
		const preserved = hw.sourceKey
			? completionByKey.get(hw.sourceKey)
			: undefined;

		await db.insert(items).values({
			courseId,
			sessionId: null,
			dueSessionId: dueSid,
			type: "assignment",
			orderIndex: itemOrder++,
			title: hw.resource.title ?? `Assignment ${hw.hwNumber ?? ""}`.trim(),
			description: hw.resource.description ?? null,
			estimatedMinutes: defaultAssignmentMinutes(hw.resource),
			status: preserved?.status ?? "not_started",
			startedAt: preserved?.startedAt ?? null,
			completedAt: preserved?.completedAt ?? null,
			pdfPath: hw.resolved.pdfUrl,
			sourceKey: hw.sourceKey,
			resourceType: hw.resource.resource_type ?? null,
			learningResourceTypes: hw.resource.learning_resource_types ?? null,
		});
	}
}

export async function importAll(root: string) {
	const courseDirs = await findCourseDirs(root);
	const results = [];
	for (const dir of courseDirs) {
		const parsed = await parseCourse(dir, root);
		if (!parsed) continue;
		try {
			const r = await importCourse(parsed);
			results.push({
				slug: parsed.course.slug,
				title: parsed.course.title,
				updated: r.updated,
				ok: true,
			});
		} catch (e: any) {
			results.push({
				slug: parsed.course.slug,
				title: parsed.course.title,
				ok: false,
				error: e.message,
			});
		}
	}
	return results;
}
