# Huashu's Super Mario playthrough · GIF clips

Cut directly from the 65.02-second finished film *Huashu's Super Mario Playthrough*, keeping the CRT-screen look. This file collects only the showcase GIFs; it does not include the level's project or the full video.

- `mario-claude.gif`: 00:06.30–00:11.80, 5.5s, 800×450. Subscription choice → Claude starburst → grow big.
- `mario-combo.gif`: 00:28.60–00:32.60, 4s, 640×360. Stomp enemy → kick the ball enemy away → smash bricks.
- `mario-pipe.gif`: 00:17.00–00:24.70, 7.7s, 640×360. Down the pipe → coin chamber → whip pan back to the ground.

All three run at original speed, 20fps, silent, looping forever; each generated its own 192-color palette, controlled size with Bayer dithering, then losslessly optimized with `gifsicle -O3`. The loop restarts after the clip ends — it is not a seamless loop.

Export example (requires ffmpeg; supply your own source film):

```sh
ffmpeg -ss 6.3 -t 5.5 -i input.mp4 -filter_complex "fps=20,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:max_colors=192[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" -loop 0 mario-claude.gif
```

The Huashu likeness in these GIFs follows the demo-use restrictions in the repository README.
