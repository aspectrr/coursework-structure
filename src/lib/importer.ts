import { promises as fs } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

// ---------- types from MIT OCW data.json files ----------
type CourseData = {
	course_title?: string;
	course_description?: string;
	site_uid?: string;
	legacy_uid?: string;
	instructors?: Array<{
		first_name?: string;
		last_name?: string;
		middle_initial?: string;
		salutation?: string;
		title?: string;
	}>;
	department_numbers?: string[];
	learning_resource_types?: string[];
	topics?: string[][];
	mit_learn_topics?: string[] | null;
	primary_course_number?: string;
	extra_course_numbers?: string;
	term?: string;
	year?: string;
	level?: string[];
	image_src?: string | null;
	course_image_metadata?: {
		file?: string;
		image_metadata?: { caption?: string };
	};
};

type ResourceData = {
	title?: string;
	description?: string;
	file?: string | null;
	learning_resource_types?: string[];
	resource_type?: string;
	file_type?: string | null;
	youtube_key?: string;
	captions_file?: string;
	transcript_file?: string;
	thumbnail_file?: string;
	archive_url?: string;
};

type PageData = {
	title?: string;
	content?: string;
	description?: string;
	files?: Array<{
		file?: string;
		title?: string;
		description?: string;
		file_type?: string;
	}>;
};

// Resource enriched with resolved disk-backed URLs
type Resolved = {
	pdfUrl: string | null; // /courses/<rel>/static_resources/<basename>
	transcriptUrl: string | null;
	thumbnailUrl: string | null; // could be youtube CDN (http) or local
};

// ---------- session parsing ----------
type ParsedSession = {
	sessionNumber: string | null;
	title: string;
	assignmentMarkers: string[]; // raw strings: "Assignment 1 out", "Assignment 2 due"
};

const ASSIGNMENT_RE = /Assignment\s+(\d+|\w+)\s+(out|due)/gi;

function parseCalendarContent(raw: string): ParsedSession[] {
	if (!raw) return [];
	const lines = raw
		.replace(/\r/g, "")
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);

	while (
		lines.length &&
		/^(SES|#|session|topics|key\s+dates)/i.test(lines[0])
	) {
		lines.shift();
	}

	const sessions: ParsedSession[] = [];
	for (const line of lines) {
		const m = line.match(
			/^([A-Za-z]?\s*\d+\s*[-–~]\s*\d+|[A-Za-z]?\s*\d+)\s+(.*)$/,
		);
		if (!m) continue;
		const sessionNumber = m[1].replace(/\s+/g, "").trim();
		const rest = m[2].trim();

		const assignmentMarkers: string[] = [];
		let am: RegExpExecArray | null;
		ASSIGNMENT_RE.lastIndex = 0;
		while ((am = ASSIGNMENT_RE.exec(rest)) !== null) {
			assignmentMarkers.push(`${am[1]} ${am[2]}`.toLowerCase());
		}

		const title = rest
			.replace(ASSIGNMENT_RE, "")
			.replace(/\s{2,}/g, " ")
			.trim();
		sessions.push({ sessionNumber, title, assignmentMarkers });
	}
	return sessions;
}

// ---------- helpers ----------
async function readJson<T = any>(p: string): Promise<T | null> {
	try {
		const buf = await fs.readFile(p, "utf8");
		return JSON.parse(buf) as T;
	} catch {
		return null;
	}
}

async function listSubdirs(dir: string): Promise<string[]> {
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		return entries
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.filter((n) => !n.startsWith("."));
	} catch {
		return [];
	}
}

function sessionNumberFromFolder(name: string): number | null {
	const m = name.match(/^lecture[-_ ]?(\d+)/i);
	if (m) return parseInt(m[1], 10);
	const m2 = name.match(/[_-]?lec(\d+)/i);
	if (m2) return parseInt(m2[1], 10);
	return null;
}

function hwNumberFromFolder(name: string): number | null {
	const m = name.match(/[_-]?hw\s*(\d+)/i);
	return m ? parseInt(m[1], 10) : null;
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

// The data.json `file` field looks like:
//   /courses/1-258j-public-transportation-systems-spring-2017/3385fcada36ca48999bf5637bdad70f5_MIT1_258JS17_lec01.pdf
// The actual file lives at {coursePath}/static_resources/{basename}. Verify on disk.
function basenameOf(fileUrl: string | null | undefined): string | null {
	if (!fileUrl) return null;
	const clean = fileUrl.split("?")[0].split("#")[0];
	const base = path.posix.basename(clean);
	return base || null;
}

async function resolveStatic(
	coursePath: string,
	courseRelPath: string,
	fileUrl: string | null | undefined,
): Promise<string | null> {
	const base = basenameOf(fileUrl);
	if (!base) return null;
	const absDisk = path.join(coursePath, "static_resources", base);
	try {
		const s = await stat(absDisk);
		if (!s.isFile()) return null;
	} catch {
		return null;
	}
	return `/courses/${courseRelPath}/static_resources/${base}`;
}

// ---------- main entry ----------
export type ImportResult = {
	courseSlug: string;
	courseTitle: string;
	sessions: number;
	items: number;
	assignments: number;
	warnings: string[];
};

export type ParsedLecture = {
	sessionNumber: number | null;
	sourceKey: string;
	resource: ResourceData;
	resolved: Resolved;
	folderName: string;
};

export type ParsedAssignment = {
	hwNumber: number | null;
	sourceKey: string;
	resource: ResourceData;
	resolved: Resolved;
	folderName: string;
};

export type ParsedCourse = {
	course: {
		slug: string;
		title: string;
		description: string | null;
		courseNumber: string | null;
		extraCourseNumbers: string | null;
		term: string | null;
		year: string | null;
		level: string | null;
		departmentNumbers: string[] | null;
		instructors: CourseData["instructors"];
		topics: string[][] | null;
		imageUrl: string | null;
		sourcePath: string;
		sourceUid: string | null;
	};
	sessions: ParsedSession[];
	lectures: ParsedLecture[];
	assignments: ParsedAssignment[];
	otherItems: Array<{
		sourceKey: string;
		resource: ResourceData;
		resolved: Resolved;
		folderName: string;
		type: string;
	}>;
	assignmentsPageContent: string | null;
	warnings: string[];
	coursePath: string;
	courseRelPath: string;
	folderName: string;
};

export async function findCourseDirs(root: string): Promise<string[]> {
	// BFS one level deep for nested (mit opencourseware/<course>)
	const subdirs = await listSubdirs(root);
	const courses: string[] = [];
	for (const sub of subdirs) {
		const subPath = path.join(root, sub);
		if (await readJson(path.join(subPath, "data.json"))) {
			courses.push(subPath);
			continue;
		}
		const nested = await listSubdirs(subPath);
		for (const n of nested) {
			const np = path.join(subPath, n);
			if (await readJson(path.join(np, "data.json"))) courses.push(np);
		}
	}
	return courses;
}

export async function parseCourse(
	coursePath: string,
	root: string,
): Promise<ParsedCourse | null> {
	const warnings: string[] = [];
	const data = await readJson<CourseData>(path.join(coursePath, "data.json"));
	if (!data) {
		warnings.push(`No data.json at ${coursePath}`);
		return null;
	}

	const folderName = path.basename(coursePath);
	const courseRelPath = path
		.relative(root, coursePath)
		.split(path.sep)
		.join("/");
	const slug = slugify(
		`${data.primary_course_number ?? folderName}-${data.term ?? ""}-${data.year ?? ""}`,
	);

	// Course image — image_src is "./static_resources/foo.jpg" relative to coursePath
	let imageUrl: string | null = null;
	if (data.image_src && /^https?:\/\//.test(data.image_src)) {
		imageUrl = data.image_src;
	} else if (data.image_src) {
		const rel = data.image_src.replace(/^\.?\//, "");
		const absDisk = path.join(coursePath, rel);
		try {
			const s = await stat(absDisk);
			if (s.isFile())
				imageUrl = `/courses/${courseRelPath}/${rel.split(path.sep).join("/")}`;
		} catch {
			/* leave null */
		}
	}

	const course = {
		slug,
		title: data.course_title ?? folderName,
		description: data.course_description ?? null,
		courseNumber: data.primary_course_number ?? null,
		extraCourseNumbers: data.extra_course_numbers ?? null,
		term: data.term ?? null,
		year: data.year ?? null,
		level: data.level?.[0] ?? null,
		departmentNumbers: data.department_numbers ?? null,
		instructors: data.instructors ?? [],
		topics: data.topics ?? null,
		imageUrl,
		sourcePath: courseRelPath,
		sourceUid: data.site_uid ?? null,
	};

	// Calendar
	const calendarData = await readJson<PageData>(
		path.join(coursePath, "pages", "calendar", "data.json"),
	);
	const sessions: ParsedSession[] = calendarData?.content
		? parseCalendarContent(calendarData.content)
		: [];
	const assignmentsData = await readJson<PageData>(
		path.join(coursePath, "pages", "assignments", "data.json"),
	);

	async function resolve(r: ResourceData): Promise<Resolved> {
		const [pdfUrl, transcriptUrl] = await Promise.all([
			resolveStatic(coursePath, courseRelPath, r.file),
			resolveStatic(coursePath, courseRelPath, r.transcript_file),
		]);
		let thumbnailUrl: string | null = null;
		if (r.thumbnail_file && /^https?:\/\//.test(r.thumbnail_file)) {
			thumbnailUrl = r.thumbnail_file;
		} else if (r.thumbnail_file) {
			thumbnailUrl = await resolveStatic(
				coursePath,
				courseRelPath,
				r.thumbnail_file,
			);
		}
		return { pdfUrl, transcriptUrl, thumbnailUrl };
	}

	// Resources
	const resourcesDir = path.join(coursePath, "resources");
	const resourceFolders = await listSubdirs(resourcesDir);

	const lectures: ParsedLecture[] = [];
	const assignments: ParsedAssignment[] = [];
	const otherItems: ParsedCourse["otherItems"] = [];

	// First pass: collect lec-numbered PDFs separately
	const pdfOnlyByLecN = new Map<
		number,
		{ folder: string; r: ResourceData; resolved: Resolved }
	>();

	for (const folder of resourceFolders) {
		const fp = path.join(resourcesDir, folder);
		const r = await readJson<ResourceData>(path.join(fp, "data.json"));
		if (!r) continue;
		const resolved = await resolve(r);
		const lecN = sessionNumberFromFolder(folder);
		const hwN = hwNumberFromFolder(folder);

		const isPdf =
			r.file_type === "application/pdf" || r.resource_type === "Document";

		if (lecN !== null && isPdf) {
			pdfOnlyByLecN.set(lecN, { folder, r, resolved });
			continue;
		}
		if (hwN !== null && isPdf) {
			assignments.push({
				hwNumber: hwN,
				sourceKey: folder,
				resource: r,
				resolved,
				folderName: folder,
			});
			continue;
		}
		if (lecN !== null) {
			lectures.push({
				sessionNumber: lecN,
				sourceKey: folder,
				resource: r,
				resolved,
				folderName: folder,
			});
		} else if (r.youtube_key) {
			lectures.push({
				sessionNumber: null,
				sourceKey: folder,
				resource: r,
				resolved,
				folderName: folder,
			});
		} else if (hwN !== null) {
			assignments.push({
				hwNumber: hwN,
				sourceKey: folder,
				resource: r,
				resolved,
				folderName: folder,
			});
		} else {
			otherItems.push({
				sourceKey: folder,
				resource: r,
				resolved,
				folderName: folder,
				type: r.resource_type ?? "other",
			});
		}
	}

	// Attach lec PDFs to video lectures
	for (const lec of lectures) {
		if (lec.sessionNumber !== null && pdfOnlyByLecN.has(lec.sessionNumber)) {
			const pdf = pdfOnlyByLecN.get(lec.sessionNumber)!;
			// Merge: prefer the video's metadata, but attach the PDF URL
			lec.resolved = {
				pdfUrl: pdf.resolved.pdfUrl ?? lec.resolved.pdfUrl,
				transcriptUrl: pdf.resolved.transcriptUrl ?? lec.resolved.transcriptUrl,
				thumbnailUrl: lec.resolved.thumbnailUrl,
			};
			pdfOnlyByLecN.delete(lec.sessionNumber);
		}
	}
	// Any leftover PDFs without matching video → synthesize lecture entries
	for (const [n, { folder, r, resolved }] of pdfOnlyByLecN) {
		lectures.push({
			sessionNumber: n,
			sourceKey: r.title ?? folder,
			resource: {
				title: r.title ?? `Lecture ${n}`,
				resource_type: "Document",
				file_type: "application/pdf",
			},
			resolved,
			folderName: folder,
		});
	}

	// Sort lectures by sessionNumber; nulls to end
	lectures.sort((a, b) => {
		if (a.sessionNumber === null) return 1;
		if (b.sessionNumber === null) return -1;
		return a.sessionNumber - b.sessionNumber;
	});

	return {
		course,
		sessions,
		lectures,
		assignments,
		otherItems,
		assignmentsPageContent: assignmentsData?.content ?? null,
		warnings,
		coursePath,
		courseRelPath,
		folderName,
	};
}

// ---------- duration heuristics ----------
export function defaultLectureMinutes(r: ResourceData): number {
	if (r.youtube_key || r.archive_url) return 45;
	if (r.file_type === "application/pdf") return 30;
	return 30;
}

export function defaultAssignmentMinutes(_r: ResourceData): number {
	return 60;
}
