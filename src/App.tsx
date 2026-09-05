import type { RouteSectionProps } from '@solidjs/router';
import { A, useLocation } from '@solidjs/router';
import { For, Show } from 'solid-js';
import { FeedbackWidget } from '@aspectrr/feedback-widget';
import { cn } from '@/lib/utils';

// Two-zone rhythm from the style system: forest-stage nav bar (ZONE A) over
// cream-paper content (ZONE B). Lime is the only interactive fill; coral is
// decorative-only and never appears as a fill.
export default function App(props: RouteSectionProps) {
  const pathname = () => useLocation().pathname;

  const pill = (path: string, label: string) => (
    <A
      href={path}
      class={cn(
        'rounded-pill px-3 py-1 text-body-sm transition-colors',
        pathname() === path
          ? 'bg-lime-sprout font-medium text-midnight-ink'
          : 'text-cream-paper/80 hover:text-pure-white',
      )}
    >
      {label}
    </A>
  );

  return (
    <div class="min-h-screen font-sans antialiased">
      <header class="sticky top-0 z-10 border-b border-midnight-ink/40 bg-forest-stage">
        <div class="mx-auto flex max-w-page items-center gap-6 px-6 py-3">
          <nav class="flex items-center gap-1">
            {pill('/', 'Today')}
            {pill('/calendar', 'Calendar')}
          </nav>
          <div class="ml-auto">
            <A
              href="/admin"
              class={cn(
                'rounded-lg border-[1.5px] px-5 py-2 text-body-sm transition-colors',
                pathname() === '/admin'
                  ? 'border-lime-sprout text-lime-sprout'
                  : 'border-pure-white/90 text-pure-white hover:bg-pure-white hover:text-forest-stage',
              )}
            >
              admin
            </A>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-page px-6 py-8">
        {props.children}
      </main>

      <FeedbackWidget source="coursework" server="https://aspectrr-feedback.fly.dev" />
    </div>
  );
}
