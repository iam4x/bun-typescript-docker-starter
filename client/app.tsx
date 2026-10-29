import type { ParentProps } from "solid-js";

import { A, Route, Router } from "@solidjs/router";
import { createSignal } from "solid-js";

function Layout(props: ParentProps) {
  return (
    <main class="grid min-h-screen place-items-center bg-zinc-950 px-6 text-zinc-100">
      <section class="w-full max-w-xl space-y-8 py-16">
        <nav aria-label="Main" class="flex gap-6 text-sm text-zinc-400">
          <A href="/" end activeClass="text-sky-400">
            Home
          </A>
          <A href="/about" activeClass="text-sky-400">
            About
          </A>
        </nav>
        {props.children}
      </section>
    </main>
  );
}

function Home() {
  const [count, setCount] = createSignal(0);

  return (
    <>
      <p class="text-sm font-medium tracking-widest text-sky-400 uppercase">
        Bun + SolidJS
      </p>
      <h1 class="text-5xl font-semibold tracking-tight">Start building.</h1>
      <p class="text-lg leading-relaxed text-zinc-400">
        A client-rendered app with TypeScript and Tailwind CSS. Served by Bun,
        ready for Docker.
      </p>
      <button
        type="button"
        class="rounded-lg bg-sky-400 px-5 py-3 font-medium text-zinc-950 transition hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
        onClick={() => setCount((value) => value + 1)}
      >
        Count is {count()}
      </button>
    </>
  );
}

function About() {
  return (
    <>
      <h1 class="text-4xl font-semibold tracking-tight">About this starter</h1>
      <p class="text-lg leading-relaxed text-zinc-400">
        Solid renders in your browser. Bun serves the app alongside your API.
        Refresh this page to try the SPA fallback.
      </p>
    </>
  );
}

function NotFound() {
  return (
    <>
      <h1 class="text-4xl font-semibold tracking-tight">Page not found</h1>
      <A href="/" class="text-sky-400 underline">
        Back to home
      </A>
    </>
  );
}

export default function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="*" component={NotFound} />
    </Router>
  );
}
