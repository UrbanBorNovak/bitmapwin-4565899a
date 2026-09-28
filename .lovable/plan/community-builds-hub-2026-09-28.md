# Community Builds Hub

## What will change
- Rework `/builds` into the dedicated **Community Builds** hub and link it clearly from Discover/Create navigation.
- Include every publicly readable BITMAP build, including active Extender deployments that do not yet have a custom BITMAP page.
- Replace the preview-only card grid with a focused live 3D stage plus a fast, searchable directory. Selecting a build opens its real interactive preview without creating dozens of WebGL scenes at once.
- Give each selected build direct **Enter Build** and **Open BITMAP** actions; Enter Build drops the visitor into the Oasis at that BITMAP.
- Keep search, build-type filters, newest/popular sorting, builder identity, verified view counts, and progressive browsing.

## Experience
- A large live 3D viewer shows the currently selected community build, its title, builder, activity, and deployed Extender status.
- Directory cards remain lightweight and scan-friendly; **Preview** changes the live stage, while **Enter** launches that exact territory.
- Phone layouts stack the viewer and controls without horizontal overflow.

## Technical details
- Paginate public build reads rather than stopping at a fixed 500-row cap.
- Union public BITMAP pages with active executable deployments, deduplicated by BITMAP height.
- Reuse the existing sandboxed `PublicBuildViewer`; mount only one live canvas at a time for performance and WebGL stability.
- Use `/oasis?height=<BITMAP>` for direct world entry and `/bitmap/<BITMAP>` for the full territory record.
- Preserve real persisted visitor totals and public ownership/profile data; no generated builds or fake activity.

## Verification
- Confirm every fetched public record can be selected and previewed.
- Test search, filtering, sorting, Preview, Enter Build, and Open BITMAP.
- Check desktop and phone layouts, console errors, and final build health.
