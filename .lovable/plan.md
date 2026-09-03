# Jump and Party System

## What will be built

- Add a grounded jump with gravity, landing, and Space input while preserving smooth predicted walking and multiplayer interpolation.
- Move basic attack to a non-conflicting input and keep its HUD binding visible.
- Broadcast jump height and motion so other visitors see the jump smoothly.
- Add ephemeral three-player parties to the existing realtime world channel:
  - invite a visible online visitor
  - accept or decline incoming invitations
  - show leader and member health in a party HUD
  - allow the leader to expel members
  - leave/disband cleanly when members depart
- Add a party-only chat mode, visually distinct from world chat.

## Interaction design

- Visible visitors appear in an online roster with an invite action.
- Invitations appear as compact accept/decline prompts.
- Party status and member controls stay in a dedicated HUD panel without covering movement/combat controls.
- Chat switches between WORLD and PARTY; party messages are delivered only to current party members.
- Parties are session-based and disappear when players leave the world; no database persistence is added.

## Technical details

- Extend `PlayerState` and pose reports with vertical position/velocity and grounded state.
- Continue client-side prediction for local jumping and interpolate remote vertical movement; clamp incoming reports to safe world bounds.
- Extend the existing realtime presence hook with party invitation, membership, kick/leave, and party-message events.
- Enforce the maximum of three members on both invitation acceptance and membership updates, with leader-only expulsion checks in each client.
- Keep ownership, economy, and other durable game state outside this ephemeral client channel.
- Verify type safety, clean build status, jump controls, invitations, member HUD, and chat mode in the live map.
