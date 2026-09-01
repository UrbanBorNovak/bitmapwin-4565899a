# Scalable Builds Feed

## Goal
Make `/builds` easier to scan and attractive when the catalog grows from dozens to thousands of builds, while keeping the existing monochrome/Bitcoin-orange identity and real data only.

## What will change
- Replace the long page flow with a discovery-first feed: compact page header, live totals, prominent search, build-type filter, and sort/following tabs.
- Redesign build cards for clearer image, title, bitmap, builder, build type, visits, and recency hierarchy, with responsive density from mobile through wide desktop.
- Move builder rankings and districts into compact secondary discovery sections so they do not push the build feed below the fold.
- Add client-side progressive pagination with an explicit result count and “load more” control, preventing a huge catalog from rendering at once.
- Add clear loading, no-results, signed-out following, and reset-filter states.

## Technical details
- Update `src/routes/builds.tsx` using existing build/profile/follow/district queries and existing design-system controls.
- Keep filtering and paging deterministic with memoized derived data; reset the visible page when search, type, or tab changes.
- Preserve current routes, follow behavior, real visitor counts, and existing backend schema.
- Verify the page at desktop and mobile widths, then check the current preview build diagnostics.
