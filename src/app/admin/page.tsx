import { db } from "@/db/client";
import { courses } from "@/db/schema";
import { asc } from "drizzle-orm";
import ImportButton from "@/components/ImportButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
	const allCourses = await db
		.select()
		.from(courses)
		.orderBy(asc(courses.title));

	return (
		<div className="space-y-8">
			<h1 className="font-serif text-3xl">admin</h1>

			<section className="bg-white border border-ink-200 rounded-xl p-5">
				<div className="flex items-baseline justify-between">
					<h2 className="font-serif text-xl">Import courses</h2>
					<code className="text-xs bg-ink-100 px-2 py-1 rounded">
						{process.env.COURSES_DIR ?? "/courses"}
					</code>
				</div>
				<p className="text-sm text-ink-600 mt-2">
					Scans mounted{" "}
					<code className="bg-ink-100 px-1 rounded">/courses</code> volume
					recursively for MIT OCW folders (any folder containing{" "}
					<code className="bg-ink-100 px-1 rounded">data.json</code>). Re-import
					preserves completion status.
				</p>
				<ImportButton />
			</section>

			<section>
				<h2 className="font-serif text-xl mb-3">
					Database ({allCourses.length})
				</h2>
				<ul className="bg-white border border-ink-200 rounded-xl divide-y divide-ink-100">
					{allCourses.map((c) => (
						<li key={c.id} className="px-5 py-3 flex items-center gap-4">
							<div className="flex-1">
								<a
									href={`/courses/${c.slug}`}
									className="font-medium hover:text-accent"
								>
									{c.courseNumber} — {c.title}
								</a>
								<div className="text-xs text-ink-500 mt-0.5">
									{c.term} {c.year} · imported{" "}
									{c.importedAt?.toLocaleDateString()}
								</div>
							</div>
							<code className="text-xs text-ink-500">{c.status}</code>
						</li>
					))}
				</ul>
			</section>

			<section className="bg-ink-50 border border-ink-200 rounded-xl p-5 text-sm text-ink-600 space-y-2">
				<div className="font-serif text-ink-900">Volumes</div>
				<div>
					Courses (read-only): <code>/courses</code> → host{" "}
					<code>{process.env.COURSES_HOST_DIR ?? "./courses"}</code>
				</div>
				<div>
					Notes (Obsidian): <code>/notes</code> → host <code>./notes</code>{" "}
					(open this folder in Obsidian)
				</div>
				<div>
					Database: <code>postgres</code>
				</div>
			</section>
		</div>
	);
}
