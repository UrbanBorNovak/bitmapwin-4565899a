# Empty Boxes, Flight Gear, and Inventory Icons

## Build
- Scatter a restrained number of the supplied on-chain empty-box model across the Oasis, using the existing streamed prop pattern and no path-blocking collision.
- Rework the jetpack and helmet as a single player-relative flight rig so both stay attached through yaw, climb, dive, and forward lean; retune their size and anchor points to the avatar.
- Replace inscription thumbnails inside the character equipment slots with distinct monochrome SVG symbols for helmet, goggles, necklace, watch, toy, ring, shoes, and comic book. Keep the central avatar preview unchanged.

## Technical details
- Clone and normalize each on-chain GLB instance before placement.
- Compose flight yaw and pitch around one shared body anchor rather than independently rotating world-positioned accessories.
- Use Lucide SVG components with the existing Bitcoin-orange active state and accessible slot labels.
- Verify type safety, preview build health, and the relevant HUD in the browser.
