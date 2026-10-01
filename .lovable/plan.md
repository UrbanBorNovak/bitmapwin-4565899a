# Compact BITMAP tabs

## Goal
Keep each BITMAP page short by showing one focused section at a time.

## What will change
- Keep the BITMAP identity, owner, price, actions, and badges visible above the content.
- Add five tabs in this order: World, Market, Facts, Chronicle, Community.
- Show only the selected tab’s content, preserving all existing information and actions.
- Keep direct links such as `#market` and `#chronicle` working and make the tab row usable on smaller screens.

## Verification
- Open a BITMAP directly on each tab and switch between all five.
- Confirm hidden sections do not lengthen the page.
- Check desktop and mobile layouts and confirm the preview remains error-free.

## Technical details
- Use the existing `/bitmap/$block` route and its current content components.
- Store the selected tab in the URL hash without creating additional routes.
- Preserve the required content order and existing on-chain data sources.
