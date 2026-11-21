# 20_dunhuang · Dunhuang murals (Mogao Caves, High Tang)

> Source: migration test A (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/20_dunhuang.js`.

Filename during the experiment: `scenes/04_dunhuang.js` (215 lines). 0.45↔0.9s diff is 6.6%, adjacent-frame median 1.98%.

**Pipeline**
Earth-red render ground (cached): `P.texture #a5452f`, dark `#7a3020`, sparse faded roundel flowers, top scroll-vine border + triangular hanging valance (teal/green/white/red alternating + gold beads) → window = azurite sky: auspicious clouds, apsaras → scroll-vine window frame → lotus brick floor (cached) → hukemen low table, oil lamp → cat → girl (Tang dynasty donor figure) → steam scroll clouds → ceiling → overlay.

**Lines and colors**
- Iron-wire line: uniform 2.6px, color `#5a2414`. The face uses a redder `#8a3a24`.
- Mineral pigments: earth red `#a5452f`, malachite green `#3f8f6e / #6ab08e`, azurite blue `#2f5f8f / #5a86b0`, white `#ecdfc4`, gold `#d8b05a`.

**Tang dress**
- Alternating-color skirt: red ground, slanted trapezoid green stripes every 44px, diverging downward with x.
- Azurite short jacket, white cross collar, high-waist red sash.
- High chignon: two ellipses stacked above headTop, plus gold hairpins and three hair ornaments.
- Face makeup: huadian (four-petal red flower on the forehead), slanted red (one red arc at the temple), lip dot, moth brows.
- The tea cup is Yue ware celadon.

**Shawl `shawl(pts,w)`**
- Traveling-wave point list → ribbon, plus white dashed floral tracing and red dots.
- The section behind: `x = back + 230q + 64q·sin(4.2q − 5.5t)`, last 30% sweeping upward.
- The front section drapes around the arm.
- Pitfall: v1's horizontal swing was only 18–34px, nearly vertical — read as a chair's vertical bar. Horizontal displacement must exceed 200px, plus the end sweeping up, before it reads as a floating silk.

**Apsaras (feitian)**
- Lying horizontal facing left, ×1.35, flying across the window at 300px/s.
- Three streamers as traveling waves, one of them arcing from the shoulder over the head and flicking behind — this big arc is the apsara's most recognizable shape.
- Head halo, hair bun, held flower tray.
- Auspicious clouds are round puffs + tapering tails, drifting 40–76px/s.

**Overlay (aging)**
- Whole-frame `saturation` blend α.3 fading, then multiply a light earth texture α.5.
- Per-pixel flaking: where `fbm(x·.0032)+0.12·noise(x·.03) > 0.3`, expose the white-gray plaster ground `#d8c6a2`; 0.28–0.3 is the dark line at the flake edge.
- Protection zones near both faces — no flaking there.
- 500 random-walk cracks, smoke-gradient over the top 380px.
- Pitfalls:
  - Flaking noise at frequency .006 produced full-screen sesame specks, like stains. Only after dropping to .0032 and raising the threshold does it flake in blocks.
  - Final version set both the cat (380–720, 530–920) and the girl (1070–1530, 240–950) as protection zones; only the background flakes.
  - Slanted red α lowered to .32, otherwise it reads as a scar.
  - The apsara's head halo was v1 a solid green circle — read as a "swim ring"; changed to α.28 translucent with a fine line.
  - With the cat at `#c8843a`, the fade layer turned it brown-yellow; changed to `#e08a3a`; added `look: sin(2.6t)` head turning and breath ×2.5, otherwise the whole segment has only the tail moving.

**Motif animation**
- Ceiling: 30 four-petal flowers, rotating and tumbling down.
- Oil lamp: flame flickering `1+0.12sin(17t)+0.08sin(29t)`, with halo.
- Paint flakes: 10 pieces detaching from flake edges, tumbling down on parabolas.
- The cat's collar bell swinging.
