# Mataresit — logo notes

## Files

| File | Use |
| --- | --- |
| `index.html` | Logo sheet: lockup, one-ink test, size ladder, construction, clear space, colour. Open directly in a browser. |
| `assets/mataresit-mark.svg` | The mark alone. One path, even-odd fill, `currentColor`, 24 × 24. |

The wordmark is live text in Instrument Sans SemiBold — the family the product already loads. Not outlined, so keep the font available, or convert to outlines for print.

## Concept

**A receipt read back as data.**

- The **top edge is a rip** — six teeth torn off the roll.
- The **bottom is dead flat** — that is the edge the till cut. The contrast between torn and cut is what makes it read as paper rather than a shape.
- Inside, **four lines**, each ending on a different right margin. Even margins would read as a paragraph; ragged ones read as fields the system found.

This is what the product does: it takes the paper you are holding and turns it into aligned records.

## Why not a monogram

Three earlier versions tried to make the letter **M** carry the idea. All three failed, and the reason is structural rather than cosmetic:

1. **v1** put the weight at the top with points hanging below — a W silhouette.
2. **v2** gave it a straight top edge and legs stopping short of the baseline, with the notch pointing up — still a W.
3. **v3** was a correct M at last — and therefore a plain one. A bold letter anyone could set in a font is not a mark. Legible and distinctive are different jobs.

A monogram is the lowest-information option available to a named brand: it says nothing the wordmark doesn't already say, twice. The receipt does the work instead.

## Construction

- Artboard 24 × 24, feet outside the visible area is not used — the mark fills 2.4–21.6 horizontally.
- Tear peaks at **y = 5.15**, valleys at **y = 7.05**, six peaks across the width.
- Body from y = 7.05 down to a **flat base at y = 21**.
- Four cut rows, all starting at **x = 5.2**, ending at **16.8 / 20.2 / 13.6 / 18.4**.
- Row heights 1.5 (the last is 1.5), so each is at least one device pixel at 16 px.

The lines are **true holes** — an even-odd subpath, not white strokes. That means the mark has no background plate of its own and sits correctly on paper, panel, brand colour, or a photograph.

## Colour

| Name | Hex | Notes |
| --- | --- | --- |
| Ember green | `#0B6B4D` | `--ledger-accent`, the product's light-mode primary |
| Ledger mint | `#3FBF8E` | `--ledger-accent` in dark mode |
| Ledger paper | `#F1F2EE` | Knockout on photography |
| Panel ink | `#101614` | `--ledger-panel`; mono reproduction |

Flat only — no gradients, strokes or shadows. Survives embossing and single-ink print.

## Clear space

Keep `x` clear on all sides, where `x` is one quarter of the mark height — 6 px on a 24 px canvas. Nothing enters that ring.

## Size floor

16 px. The tear is the first thing to fail below that; the rows survive longer. If the mark must appear smaller than 16 px, use the solid tile instead.

## Motion

One interaction: a single **scan pass** down the receipt on hover or keyboard focus — a bar clipped to the mark, 620 ms, one pass, then gone. It reads as the document being read, which is the product's core action, and it is disabled entirely under `prefers-reduced-motion`.

## Known risk

At 16 px the four rows compress to roughly one pixel each and the mark reads as a striped block rather than a receipt. That is a graceful failure — the silhouette still holds — but the metaphor only fully appears at 24 px and above. If favicon presence matters more than the detail, reducing to three rows would buy back clarity at small sizes.
