# Editorial illustrations

Twelve artworks, one per slot. The loader resolves a *base name* against this
folder and tries `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif` in turn — so the
extension does not have to match anything, only the base name does.

| Base name | Artwork | Used by |
|---|---|---|
| `migration-journey` | Figures walking in a line with bags and bundles | index band 1 · themes card *Migration* |
| `ageing-cohort` | Older adults with frames, wheelchairs, mobility aids | index band 2 · themes card + detail *Ageing* |
| `fertility-motherland` | Expectant mother rendered as a printed road map | index band 3 |
| `population-aerial` | Aerial crowd casting long shadows | themes card *Demography* |
| `density-crowd` | Tangled ball of figures | theme detail *Demography* |
| `health-infrastructure` | IV stand hung with hospital buildings | themes card *Health* |
| `nutrition-strength` | Flexed arm made of fruit and vegetables | theme detail *Health* |
| `education-classroom` | Teacher at a window, pupils at desks | themes card + detail *Education* |
| `employment-cycle` | Figure running inside a clock-faced wheel | themes card + detail *Employment* |
| `urbanization-build` | Hands, a crane and a city plan in blue | theme detail *Migration & Urbanization* |
| `fertility-conception` | Overlapping discs with a single sperm | spare |
| `data-collective` | People assembling charts and bars | spare |

To swap any artwork, drop a replacement in with the same base name — any of the
five extensions works. Delete the old file if the extension differs, or both
will sit here and the first in the list above wins.

## Behaviour when a file is absent

Nothing breaks, by design:

- **Theme cards** fall back to the original animated GIF in `icons/`.
- **Index bands** stay one column and keep their copy — they only widen to two
  columns once a picture has actually decoded (`.has-art`).
- **Theme detail hero** removes itself.

## Treatment

Artwork sits at `saturate(0.82)` at rest and returns to full colour on hover.
That is deliberate: these twelve come from different visual languages
(silhouette, photo-collage, flat vector, painted texture) and the shared
desaturation is what makes them read as one set. Sizing is `object-fit: contain`
on a tinted panel, so any aspect ratio is safe — nothing is ever cropped.

## Note on weight

`migration-journey.png` (1.0 MB) and `density-crowd.png` (0.9 MB) are heavy for
the web. Re-saving them as JPEG or WebP around 150–200 KB would cut most of that
with no visible loss; the loader will pick up the new extension automatically.
