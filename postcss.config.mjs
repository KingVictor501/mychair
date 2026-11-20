// postcss.config.mjs
// WHAT IT'S FOR: tells Next.js to run Tailwind CSS when it builds the app's styles.
// PostCSS is the step that reads app/globals.css and turns the Tailwind class names
// used in the pages (like "flex" or "p-4") into real CSS.
// WHO USES IT: Next.js reads it automatically during `npm run dev` and `npm run build`.
// WHY THE NAME: "postcss.config" is the filename Next.js looks for. It ends in ".mjs"
// (a JavaScript module) because that is the only form the Next.js and Tailwind docs show;
// it is the one allowed exception to the project's "no .js files" rule.

// The settings object: one plugin, Tailwind's PostCSS plugin, with no extra options.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
