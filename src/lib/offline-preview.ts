/**
 * Preview-only prelude for on-chain HTML shown in a srcdoc iframe. Such a frame has no ord
 * server, so its relative chain lookups (/r/…, /content/…) would hit this site and fail CORS.
 * The prelude answers them locally with 404 so the page falls back quietly. Never inscribed.
 */
const OFFLINE_PREVIEW = `<script>(function(){var of=window.fetch.bind(window);window.fetch=function(u){var s=String(u&&u.url||u);if(/^\\/(r|content)\\//.test(s))return Promise.resolve(new Response("",{status:404}));return of.apply(window,arguments)}})()</script>`;

export const offlinePreview = (html: string): string => OFFLINE_PREVIEW + html;
