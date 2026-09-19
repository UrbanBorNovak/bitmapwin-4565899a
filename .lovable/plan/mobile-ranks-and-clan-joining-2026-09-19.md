# Mobile ranks and clan joining

## Changes
- Make ranking tables denser on phones with smaller minimum widths, tighter cells, and mobile-priority columns while retaining full desktop data.
- Enlarge clan tags and crests in rank rows and player-name cells so clan identity is easier to scan.
- Add a phone-friendly clan action area with a full-width Join button, clear wallet/full/member states, and touch-sized controls.
- Back Join with an authenticated membership action that validates capacity and prevents joining multiple clans.

## Technical details
- Keep the existing terminal-oasis styling and desktop layout.
- Add a secure server function and database write policy path through server-side authorization.
- Refresh clan roster and rank data after joining.
- Verify mobile layouts and interaction at phone width, then confirm the current build is clean.
