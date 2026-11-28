# Design rules for nazare.io

Applies to every page in this repo: the home page, /writing/, /thesis/, /news/, /compute/, /compute/news/ and /compute/epilogue/.
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
- Hype copy and closing slogans. State the fact.
- Arrows or symbols in front of or after links (↗, ✉, →).
- Rows of badge pills that restate a bio or a list.
- Frosted-glass (backdrop blur) bars. Bars are solid.
- Full stops at the end of headings.
- A pill on every list item. Mark only the exception (for example "Checked"), not the default.
- Bordered boxes inside bordered boxes. Stat tiles inside a card have no border.
- Dashed outlines as decoration. Map frames are thin solid lines.
- Subtitles that repeat the heading or describe the page's obvious behavior.

## Always

- Color tokens only. Surfaces stay neutral: plane #05070a, surface #0c111c, line #18202e, ink #e8ecf0, secondary ink #9aa3ae.
- One accent, #3b9eda, used only for links, the selected tab or filter, and the primary button.
- Chart series colors are data, not decoration: #1a9cf0, #e76624, #00a888, #d28e05, in that fixed order.
- Type: Playfair Display 500 for page titles (h1) and home-page section titles only. Manrope 400 for body, Manrope 500 for emphasis, numbers and subheads. Never Inter, Roboto, Arial, Open Sans or Helvetica as the chosen face (they stay only as system fallbacks).
- Type scale: 12, 13, 15, 17, 22 px, and the page title at 30 to 46 px (home hero up to 72 px).
- Corner radius 8 px on cards, 999 px on filter chips. Borders 1 px in the line color.
- Motion: color and border transitions of 150 ms. Buttons press to 0.97 scale. Keyboard focus shows at once.
- Brand marks kept (Steven, 27 Nov 2026): the nazaré wordmark in the top bar, the large nazaré logo mark behind the hero or header, the wave background (the home page canvas and wave shape, the report's wave line and desktop canvas), and the Playfair page title.

## Accessibility and behavior

- The page header is a plain block, not a <header> inside <main>.
- Every animation stops under prefers-reduced-motion. The home page wave draws one still frame in that case, and pauses when the tab is hidden.
- Full-height blocks use 100dvh (with 100vh as fallback), never 100vh alone.
- No window scroll listeners. Use IntersectionObserver for reveals.
- Headings use text-wrap: balance; paragraphs and list items use text-wrap: pretty. No manual <br> in headings.

## Decisions kept on purpose

- The blue accent stays. It comes from the brand: Nazaré is named for the surf town and its wave, and the wordmark, logo mark and wave background are blue on near-black. This is a brand choice, not the default startup palette.
- The wave background animates on desktop. It is the brand element Steven asked to keep (27 Nov 2026).

## Structure

- Report navigation has at most 7 top-level tabs. A tab that holds several sections shows them as a second row of plain text links.

## Checks before shipping a page

1. Screenshot at 375 px and 1280 px wide, dark theme.
2. No clipped text, no gradient or glow, no all-caps label, no weight above 500.
3. Copy keeps its meaning. Only casing and decoration change in a design pass.
