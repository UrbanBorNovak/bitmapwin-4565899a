# Bitmap Unhinged

Build a web application called BITMAP MARKETPLACE.

CORE IDEA

A minimalist marketplace and explorer for Bitcoin Bitmap digital land.

The visual identity must be strictly black and white, inspired by:

Early Bitcoin / cypherpunk aesthetics

Terminal interfaces

Pixel art

Retro computer systems

Minimalist architecture

On-chain digital land

The website should feel like a combination of:

mempool.space × a retro terminal × a digital land registry

Do NOT use gradients.
Do NOT use colorful UI elements.
Use only black, white, and shades of gray.

TECH STACK

Build using:

React

TypeScript

Tailwind CSS

Supabase for database and authentication

Responsive design

Prepare the architecture so real Bitcoin Ordinals/Bitmap APIs can be connected later.

For now, use mock/demo data.

MAIN PAGE

Create a landing page with:

HEADER

Left:

BITMAP MARKETPLACE

Small subtitle:

BITCOIN DIGITAL LAND

Center navigation:

EXPLORE

MARKETPLACE

MAP

ACTIVITY

Right:

SEARCH icon

CONNECT WALLET button

The wallet connection should initially be a UI placeholder.

HERO

Large centered text:

OWN A PIECE OF BITCOIN

Subtitle:

Explore, discover and trade Bitcoin Bitmap digital land.

Below:

[ EXPLORE BITMAPS ]

[ VIEW MAP ]

Background should be mostly black with a subtle pixel/grid pattern.

MARKETPLACE SECTION

Title:

FEATURED BITMAPS

Create a responsive grid of Bitmap cards.

Each card represents a Bitcoin block / Bitmap.

Example:

BITMAP #840000

Information:

Block: 840000
Owner: bc1q...9x42
Status: FOR SALE
Price: 0.025 BTC

Each card should contain a minimalist pixel visualization.

Example visual:

A square made from a small black-and-white pixel grid.

Hover effect:

Card border becomes white

Slight scale animation

Pixel visualization animates subtly

Buttons:

[ VIEW ]

[ BUY ]

EXPLORE PAGE

Create a searchable Bitmap explorer.

Top:

EXPLORE BITMAPS

Search input:

Search block number, inscription or owner...

Filters:

ALL

FOR SALE

OWNED

UNCLAIMED

Sort:

NEWEST

LOWEST PRICE

HIGHEST PRICE

BLOCK NUMBER

Display Bitmap cards in a dense terminal-like grid.

BITMAP DETAIL PAGE

Example route:

/bitmap/840000

Layout:

BITMAP #840000

Left side:

Large black-and-white pixel visualization of the Bitmap.

Right side:

BITMAP DATA

Block Height
840000

Bitcoin Network
MAINNET

Owner
bc1q...9x42

Status
FOR SALE

Price
0.025 BTC

Inscription ID
demo-inscription-id

Below:

[ BUY BITMAP ]

[ VIEW ON EXPLORER ]

[ VIEW TRANSACTION ]

MAP PAGE

Create a conceptual interactive Bitmap universe.

Do NOT attempt to build a real geographic map.

Instead, create a large infinite-looking grid.

Each square represents a Bitmap/block.

Example:

[840000] [840001] [840002]

[839999] [839998] [839997]

Allow:

Zoom in/out

Pan around

Click a Bitmap

When clicked, show a right sidebar:

BITMAP #840000

OWNER: bc1q...9x42

STATUS: FOR SALE

PRICE: 0.025 BTC

[ VIEW BITMAP ]

Use mock Bitmap data.

ACTIVITY PAGE

Terminal-style activity feed.

Example:

> BITMAP #840000 LISTED
  PRICE: 0.025 BTC
  TIME: 2 MINUTES AGO

> BITMAP #839721 SOLD
  PRICE: 0.018 BTC
  BUYER: bc1q...72ac

> NEW BITMAP DISCOVERED
  BLOCK: 841002


Make this visually resemble a blockchain terminal.

DATABASE STRUCTURE

Create Supabase tables.

bitmaps

id

block_height

inscription_id

owner_address

status

price_btc

image_url

created_at

updated_at

listings

id

bitmap_id

seller_address

price_btc

status

created_at

activity

id

type

bitmap_id

wallet_address

metadata

created_at

BITMAP VISUAL GENERATOR

Create a component:

BitmapPixelMap

It should generate a unique black-and-white pixel pattern based on the Bitmap block number.

Requirements:

Deterministic

Same block number always produces same pattern

Grid sizes between 8×8 and 16×16

Pure black and white

Pixelated aesthetic

This will become the visual identity of each Bitmap.

DESIGN SYSTEM

Fonts:

Use a monospace font for technical information.

Use a bold modern sans-serif font for large titles.

Colors:

Background:

#000000

Primary text:

#FFFFFF

Secondary text:

#888888

Borders:

#333333

Hover borders:

#FFFFFF

Buttons:

Black background with white border.

Hover:

White background with black text.

IMPORTANT UX

The application should feel like an actual product prototype, not a generic landing page.

Prioritize:

Bitmap discovery

Bitmap identity

Marketplace browsing

Future wallet integration

Future Ordinals integration

For now:

Use realistic mock data

Do NOT implement real Bitcoin transactions

Do NOT implement payment processing

Do NOT claim ownership verification

Instead, build the product architecture so these systems can be integrated later.

BRAND LANGUAGE

Use short, confident technical language.

Examples:

BITMAP #840000

DIGITAL LAND ON BITCOIN

OWNERSHIP

ON-CHAIN

DISCOVER

EXPLORE THE BLOCKCHAIN

THE LAND LAYER OF BITCOIN

Avoid corporate SaaS language.

Avoid excessive explanations.

The final result should look like a real underground Bitcoin infrastructure product launched in 2013 but designed with modern UI quality.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bitmapwin.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a574eb67-7bf4-469e-93d8-dd8d12c6559a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
