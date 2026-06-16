"use client";

import { useState } from "react";

export default function ImportButton() {
	const [state, setState] = useState<"idle" | "running" | "done" | "error">(
		"idle",
	);
	const [summary, setSummary] = useState<string>("");

	async function run() {
		setState("running");
		setSummary("");
		try {
			const res = await fetch("/api/import", { method: "POST" });
			const json = await res.json();
			if (!json.ok) throw new Error(json.error || "failed");
			const r = json.results ?? [];
			const lines = r.map(
				(x: any) =>
					`${x.ok ? (x.updated ? "↻" : "✓") : "✗"} ${x.slug} — ${x.title}`,
			);
			setSummary(lines.join("\n") || "no courses found");
			setState("done");
		} catch (e: any) {
			setSummary(e.message);
			setState("error");
		}
	}

	return (
		<div className="mt-4">
			<button
				type="button"
				onClick={run}
				disabled={state === "running"}
				className="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-dim disabled:opacity-50"
			>
				{state === "running" ? "importing…" : "import / re-sync"}
			</button>
			{summary && (
				<pre className="mt-3 text-xs bg-ink-50 border border-ink-200 rounded-md p-3 whitespace-pre-wrap font-mono">
					{summary}
				</pre>
			)}
		</div>
	);
}
