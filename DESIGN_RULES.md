# Design rules for nazare.io

Applies to every page in this repo: the home page, /news/, /compute/, /compute/news/ and /compute/epilogue/.
Set on 27 Nov 2026 by an unslop pass. Each page carries an "Unslop layer" block at the end of its CSS that applies these rules.

## Never

- Gradients on text, buttons, cards or backgrounds.
- Glows and radial light behind headers.
- All-caps labels, letter-spaced small caps, and eyebrow labels with a leading rule line. A section heading names the section; no label above it.
- Italic or colored accent words inside headings.
- Font weights other than 400 and 500.
- Icons or symbols inside boxes or circles, and emoji in interface copy.
- Hover lifts (translateY), drop shadows on anything that does not float, and colored side bars that only decorate.
- Motion longer than 300 ms, bounce easing, and staggered fade-in entrances.
- Title Case in buttons and labels. Use sentence case ("View fund deck", "Get in touch").
- Hype copy. State the fact.

## Always

- Color tokens only. Surfaces stay neutral: plane #05070a, surface #0c111c, line #18202e, ink #e8ecf0, secondary ink #9aa3ae.
- One accent, #3b9eda, used only for links, the selected tab or filter, and the primary button.
- Chart series colors are data, not decoration: #1a9cf0, #e76624, #00a888, #d28e05, in that fixed order.
- Type: Playfair Display 500 for page titles (h1) and home-page section titles only. Inter 400 for body, Inter 500 for emphasis, numbers and subheads.
- Type scale: 12, 13, 15, 17, 22 px, and the page title at 30 to 46 px (home hero up to 72 px).
- Corner radius 8 px on cards, 999 px on filter chips. Borders 1 px in the line color.
- Motion: color and border transitions of 150 ms. Buttons press to 0.97 scale. Keyboard focus shows at once.
- Brand marks kept (Steven, 27 Nov 2026): the nazaré wordmark in the top bar, the large nazaré logo mark behind the hero or header, the wave background (the home page canvas and wave shape, the report's wave line and desktop canvas), and the Playfair page title.

## Checks before shipping a page

1. Screenshot at 375 px and 1280 px wide, dark theme.
2. No clipped text, no gradient or glow, no all-caps label, no weight above 500.
3. Copy keeps its meaning. Only casing and decoration change in a design pass.
