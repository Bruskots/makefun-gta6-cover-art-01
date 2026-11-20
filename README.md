# makefun-gta6-cover-art-01

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Bruskots/makefun-gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Bruskots/makefun-gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Vice Cover Studio** — a web app that turns your own photo and a caption into poster-style cover art: multi-panel layouts, a Vice City sunset or neon colour grade, bold condensed lettering, and PNG export in the common post sizes (1080×1080, 1080×1350, 1920×1080). It runs entirely offline from static files: photos are read on your machine and never uploaded. The design is original — no Rockstar Games logo, artwork, or font. Lettering uses Anton and Barlow Condensed under the SIL Open Font License, and the two sample pictures are original illustrations drawn for this app.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080, load a photo (or try a sample), pick a layout and grade, write your caption, and hit **Export PNG**.

You can also serve `app/` with any static file server and open `index.html` directly — there is no build step, and the app makes no network requests.

Shareable presets work through the address bar, for example:
`http://localhost:8080/?sample=sunset-rider.jpg&layout=split3&grade=sunset&size=1080x1350&title=SUNSET%20HEIST`

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
