/* Vice Cover Studio — a poster cover maker that runs fully offline.
 *
 * The user loads their own photos, arranges them in panels, writes a
 * caption, picks a colour grade, and exports a PNG poster. Nothing is
 * uploaded anywhere: photos are read on this machine and drawn on canvas.
 */

const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
const statusLine = document.getElementById("statusLine");
const exportButton = document.getElementById("exportButton");
const photoInput = document.getElementById("photoInput");
const photoDrop = document.getElementById("photoDrop");
const photoList = document.getElementById("photoList");
const panelList = document.getElementById("panelList");
const titleInput = document.getElementById("titleInput");
const taglineInput = document.getElementById("taglineInput");
const footerInput = document.getElementById("footerInput");
const captionSpot = document.getElementById("captionSpot");
const titleSize = document.getElementById("titleSize");

/* ------------------------------------------------------------------ */
/* Colour grades: each one tints the photos and colours the caption.  */
/* ------------------------------------------------------------------ */

const GRADES = {
  sunset: {
    label: "Sunset",
    tintTop: "rgba(255, 94, 126, 0.20)",
    tintBottom: "rgba(122, 46, 166, 0.30)",
    glow: "rgba(255, 190, 90, 0.55)",
    glowX: 0.72, glowY: 0.16,
    band: ["rgba(20, 8, 32, 0.88)", "rgba(20, 8, 32, 0.10)"],
    title: "#fff6e8", tagline: "#ffd76a", footer: "#ffb3c6",
    accent: "#ff5e7e",
  },
  neon: {
    label: "Neon night",
    tintTop: "rgba(25, 211, 218, 0.16)",
    tintBottom: "rgba(255, 46, 149, 0.30)",
    glow: "rgba(25, 211, 218, 0.45)",
    glowX: 0.22, glowY: 0.14,
    band: ["rgba(8, 6, 28, 0.90)", "rgba(8, 6, 28, 0.08)"],
    title: "#eafcff", tagline: "#19d3da", footer: "#ff7ec2",
    accent: "#19d3da",
  },
  gold: {
    label: "Gold hour",
    tintTop: "rgba(255, 176, 66, 0.20)",
    tintBottom: "rgba(179, 84, 30, 0.30)",
    glow: "rgba(255, 224, 138, 0.60)",
    glowX: 0.5, glowY: 0.12,
    band: ["rgba(32, 16, 4, 0.88)", "rgba(32, 16, 4, 0.10)"],
    title: "#fff8e0", tagline: "#ffd76a", footer: "#ffb347",
    accent: "#ff9a3c",
  },
  noir: {
    label: "Noir",
    tintTop: "rgba(255, 255, 255, 0.05)",
    tintBottom: "rgba(0, 0, 0, 0.42)",
    glow: "rgba(255, 255, 255, 0.28)",
    glowX: 0.5, glowY: 0.1,
    band: ["rgba(0, 0, 0, 0.92)", "rgba(0, 0, 0, 0.12)"],
    title: "#ffffff", tagline: "#e8e8e8", footer: "#bdbdbd",
    accent: "#ffffff",
  },
};

/* --------------------------------------------------------------- */
/* Layouts: panel rectangles in unit space, with a thin gap between */
/* them. x, y, w, h are fractions of the cover width / height.     */
/* --------------------------------------------------------------- */

const GAP = 0.008;

function layoutRects(name) {
  const g = GAP;
  if (name === "split3") {
    const w = (1 - 2 * g) / 3;
    return [
      { x: 0, y: 0, w, h: 1 },
      { x: w + g, y: 0, w, h: 1 },
      { x: 2 * (w + g), y: 0, w, h: 1 },
    ];
  }
  if (name === "heroStrip") {
    const smallH = 0.3 - g / 2;
    return [
      { x: 0, y: 0, w: 1, h: 0.7 - g / 2 },
      { x: 0, y: 0.7 + g / 2, w: 0.5 - g / 2, h: smallH },
      { x: 0.5 + g / 2, y: 0.7 + g / 2, w: 0.5 - g / 2, h: smallH },
    ];
  }
  if (name === "grid") {
    const w = 0.5 - g / 2;
    const h = 0.5 - g / 2;
    return [
      { x: 0, y: 0, w, h },
      { x: 0.5 + g / 2, y: 0, w, h },
      { x: 0, y: 0.5 + g / 2, w, h },
      { x: 0.5 + g / 2, y: 0.5 + g / 2, w, h },
    ];
  }
  return [{ x: 0, y: 0, w: 1, h: 1 }]; // hero
}

const LAYOUT_NAMES = { hero: "Hero", split3: "Triple split", heroStrip: "Hero + strip", grid: "Four-way grid" };

/* --------------------------------------------------------------- */
/* State                                                             */
/* --------------------------------------------------------------- */

const state = {
  photos: [],          // { id, name, img, thumb }
  panels: [],          // { photoId, zoom, panX, panY } — one per layout rect
  layout: "split3",
  grade: "sunset",
  title: "SUNSET HEIST",
  tagline: "One last job under the neon sun",
  footer: "VICE CITY · SUMMER",
  captionSpot: "bottom",
  titleScale: 1.0,
  size: "1080x1080",
  selectedPanel: 0,
};

let photoCounter = 0;

function defaultPanels() {
  return layoutRects(state.layout).map(() => ({
    photoId: state.photos.length ? state.photos[0].id : null,
    zoom: 1,
    panX: 0,
    panY: 0,
  }));
}

function setLayout(name) {
  state.layout = name;
  const old = state.panels;
  state.panels = defaultPanels();
  // Keep each panel's photo where the old layout had one, in order.
  state.panels.forEach((panel, i) => {
    if (old[i]) panel.photoId = old[i].photoId;
  });
  state.selectedPanel = 0;
  document.querySelectorAll("#layoutChoices button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.layout === name)));
  buildPanelList();
  renderPreview();
}

/* --------------------------------------------------------------- */
/* Drawing the cover                                               */
/* --------------------------------------------------------------- */

function drawPhotoInto(ctx, img, rect, zoom, panX, panY, grade) {
  const px = rect.x, py = rect.y, pw = rect.w, ph = rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  if (img) {
    const base = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
    const scale = base * zoom;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = px + (pw - dw) / 2 + panX * pw;
    const dy = py + (ph - dh) / 2 + panY * ph;
    // The noir grade is genuinely black and white, not just a grey tint.
    if (grade === "noir") ctx.filter = "grayscale(1) contrast(1.12) brightness(1.05)";
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = "none";
    if (grade !== "noir") {
      ctx.fillStyle = grade === "sunset" ? "rgba(255, 122, 89, 0.10)" : "rgba(255, 255, 255, 0.05)";
    }
  } else {
    const grad = ctx.createLinearGradient(px, py, px, py + ph);
    grad.addColorStop(0, "#3a2b4d");
    grad.addColorStop(1, "#1c1426");
    ctx.fillStyle = grad;
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = "rgba(244, 238, 247, 0.55)";
    ctx.font = `700 ${Math.max(14, pw * 0.07)}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("ADD A PHOTO", px + pw / 2, py + ph / 2);
  }
  ctx.restore();
}

function fitFont(ctx, text, maxWidth, startSize, family, weight) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const trial = line ? line + " " + word : word;
    if (ctx.measureText(trial).width <= maxWidth || !line) line = trial;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function drawCaption(ctx, W, H, grade) {
  const bandH = H * (state.captionSpot === "top" ? 0.34 : 0.36);
  const bandY = state.captionSpot === "top" ? 0 : H - bandH;
  // The band darkens towards the edge where the footer sits, and is already
  // fairly dark where the tagline sits, so the lettering stays readable
  // over any photo instead of straddling a panel edge.
  const band = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  const dark = grade.band[0].replace(/[\d.]+\)$/, "0.92)");
  const mid = grade.band[0].replace(/[\d.]+\)$/, "0.62)");
  const faint = grade.band[0].replace(/[\d.]+\)$/, "0.18)");
  if (state.captionSpot === "top") {
    band.addColorStop(0, dark);
    band.addColorStop(0.6, mid);
    band.addColorStop(1, faint);
  } else {
    band.addColorStop(0, faint);
    band.addColorStop(0.4, mid);
    band.addColorStop(1, dark);
  }
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, W, bandH);

  const pad = W * 0.045;
  const maxText = W - pad * 2;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Title first, so the other lines can be laid out around it.
  const startSize = W * 0.115 * state.titleScale;
  ctx.font = `400 ${startSize}px Anton, sans-serif`;
  const title = (state.title.trim() || "UNTITLED").toUpperCase();
  const lines = wrapLines(ctx, title, maxText);
  const longest = lines.reduce((a, b) => (a.length > b.length ? a : b), "");
  const titleSizePx = fitFont(ctx, longest, maxText, startSize, "Anton, sans-serif", 400);
  const lineH = titleSizePx * 1.02;
  const tagSize = Math.max(15, W * 0.030);
  const footerSize = Math.max(13, W * 0.021);

  let taglineBaseline, firstTitleBaseline, footerBaseline;
  if (state.captionSpot === "top") {
    // Top down: tagline, title, then footer at the band's bottom edge.
    taglineBaseline = bandY + H * 0.055 + tagSize;
    firstTitleBaseline = taglineBaseline + H * 0.018 + lineH;
    footerBaseline = bandY + bandH - H * 0.028;
  } else {
    // Bottom up: footer, title, then tagline above the title.
    footerBaseline = bandY + bandH - H * 0.028;
    const titleBottom = footerBaseline - H * 0.048;
    firstTitleBaseline = titleBottom - lineH * (lines.length - 1);
    // The tagline sits above the title's cap height, not above its
    // baseline: a baseline only 0.34 line-heights up lands inside the
    // title glyphs and hides behind them. Anton's caps run tall
    // (about 0.87 em including the outline), so clear a full 0.87
    // line-heights plus a small gap.
    taglineBaseline = firstTitleBaseline - lineH * 0.87 - H * 0.02;
  }

  // Tagline above the title, with a soft shadow so it reads over photos.
  const tagline = state.tagline.trim();
  if (tagline) {
    ctx.font = `600 ${tagSize}px "Barlow Condensed", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(W * 0.004)}px`; } catch (e) { /* older canvas */ }
    ctx.fillStyle = grade.tagline;
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = Math.max(4, tagSize * 0.25);
    ctx.shadowOffsetY = 2;
    ctx.fillText(tagline, pad, taglineBaseline);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  // Title: big condensed Anton, up to two lines, outlined and shadowed.
  ctx.font = `400 ${titleSizePx}px Anton, sans-serif`;
  try { ctx.letterSpacing = "0px"; } catch (e) { /* older canvas */ }
  ctx.fillStyle = grade.title;
  ctx.strokeStyle = "rgba(16, 6, 28, 0.85)";
  ctx.lineWidth = Math.max(3, titleSizePx * 0.07);
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = titleSizePx * 0.12;
  ctx.shadowOffsetY = titleSizePx * 0.05;
  lines.forEach((line, i) => {
    const y = firstTitleBaseline + i * lineH;
    ctx.strokeText(line, pad, y);
    ctx.fillText(line, pad, y);
  });
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Footer strip: small caps centred between two accent rules.
  const footerText = state.footer.trim().toUpperCase();
  if (footerText) {
    ctx.font = `600 ${footerSize}px "Barlow Condensed", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(W * 0.004)}px`; } catch (e) { /* older canvas */ }
    ctx.fillStyle = grade.footer;
    const fw = ctx.measureText(footerText).width;
    const ruleY = footerBaseline - footerSize * 0.32;
    const ruleGap = W * 0.02;
    ctx.strokeStyle = grade.accent;
    ctx.lineWidth = Math.max(2, W * 0.002);
    ctx.beginPath();
    ctx.moveTo(pad, ruleY);
    ctx.lineTo(pad + (maxText - fw) / 2 - ruleGap, ruleY);
    ctx.moveTo(pad + (maxText - fw) / 2 + fw + ruleGap, ruleY);
    ctx.lineTo(pad + maxText, ruleY);
    ctx.stroke();
    ctx.fillText(footerText, pad + (maxText - fw) / 2, footerBaseline);
    try { ctx.letterSpacing = "0px"; } catch (e) { /* older canvas */ }
  }
}

function renderCover(ctx, W, H) {
  const grade = GRADES[state.grade];
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#140a20";
  ctx.fillRect(0, 0, W, H);

  const rects = layoutRects(state.layout);
  rects.forEach((unit, i) => {
    const rect = { x: unit.x * W, y: unit.y * H, w: unit.w * W, h: unit.h * H };
    const panel = state.panels[i] || { photoId: null, zoom: 1, panX: 0, panY: 0 };
    const photo = state.photos.find((p) => p.id === panel.photoId);
    drawPhotoInto(ctx, photo ? photo.img : null, rect, panel.zoom, panel.panX, panel.panY, state.grade);
    // Thin keyline around each panel.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = Math.max(1.5, W * 0.002);
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  });

  // Grade wash + sun glow over the whole poster.
  const wash = ctx.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0, grade.tintTop);
  wash.addColorStop(0.55, "rgba(0, 0, 0, 0)");
  wash.addColorStop(1, grade.tintBottom);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(
    grade.glowX * W, grade.glowY * H, 0,
    grade.glowX * W, grade.glowY * H, W * 0.42);
  glow.addColorStop(0, grade.glow);
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Vignette to pull the eye to the middle.
  const vig = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, "rgba(0, 0, 0, 0)");
  vig.addColorStop(1, "rgba(10, 4, 20, 0.38)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  drawCaption(ctx, W, H, grade);

  // Poster keyline frame.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = Math.max(2, W * 0.003);
  ctx.strokeRect(W * 0.012, H * 0.012, W * 0.976, H * 0.976);
}

/* --------------------------------------------------------------- */
/* Preview                                                         */
/* --------------------------------------------------------------- */

function sizeDims() {
  const [w, h] = state.size.split("x").map(Number);
  return { w, h };
}

function renderPreview() {
  const { w, h } = sizeDims();
  const scale = 900 / w;
  previewCanvas.width = 900;
  previewCanvas.height = Math.round(h * scale);
  renderCover(previewCtx, previewCanvas.width, previewCanvas.height);
  const count = state.photos.length;
  statusLine.textContent = count
    ? `${count} photo${count > 1 ? "s" : ""} loaded · ${LAYOUT_NAMES[state.layout]} · ${GRADES[state.grade].label} · exporting ${state.size}`
    : "Load a photo to begin — or try a sample below.";
  exportButton.disabled = count === 0;
  document.querySelectorAll(".panel-card").forEach((card, i) =>
    card.classList.toggle("selected", i === state.selectedPanel));
}

/* --------------------------------------------------------------- */
/* Photos                                                          */
/* --------------------------------------------------------------- */

function addPhoto(name, img) {
  const id = ++photoCounter;
  const thumb = document.createElement("canvas");
  thumb.width = 104; thumb.height = 104;
  const tctx = thumb.getContext("2d");
  const s = Math.max(104 / img.naturalWidth, 104 / img.naturalHeight);
  tctx.drawImage(img,
    (104 - img.naturalWidth * s) / 2, (104 - img.naturalHeight * s) / 2,
    img.naturalWidth * s, img.naturalHeight * s);
  state.photos.push({ id, name, img, thumb: thumb.toDataURL("image/jpeg", 0.8) });
  // Panels with no photo yet take the first photo.
  state.panels.forEach((p) => { if (!p.photoId) p.photoId = id; });
  buildPhotoList();
  buildPanelList();
  renderPreview();
}

function loadPhotoFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => addPhoto(file.name, img);
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);
}

function loadSample(path) {
  const img = new Image();
  img.onload = () => addPhoto(path.split("/").pop(), img);
  img.onerror = () => { statusLine.textContent = "Could not load the sample picture."; };
  img.src = path;
}

function removePhoto(id) {
  state.photos = state.photos.filter((p) => p.id !== id);
  state.panels.forEach((p) => {
    if (p.photoId === id) p.photoId = state.photos.length ? state.photos[0].id : null;
  });
  buildPhotoList();
  buildPanelList();
  renderPreview();
}

function buildPhotoList() {
  photoList.innerHTML = "";
  state.photos.forEach((photo) => {
    const li = document.createElement("li");
    const thumb = document.createElement("img");
    thumb.src = photo.thumb;
    thumb.alt = "";
    const name = document.createElement("span");
    name.className = "photo-name";
    name.textContent = photo.name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removePhoto(photo.id));
    li.append(thumb, name, remove);
    photoList.append(li);
  });
}

/* --------------------------------------------------------------- */
/* Panel controls                                                  */
/* --------------------------------------------------------------- */

function buildPanelList() {
  panelList.innerHTML = "";
  const rects = layoutRects(state.layout);
  rects.forEach((_, i) => {
    const panel = state.panels[i];
    const card = document.createElement("div");
    card.className = "panel-card";
    if (i === state.selectedPanel) card.classList.add("selected");
    card.addEventListener("click", () => { state.selectedPanel = i; renderPreview(); });

    const head = document.createElement("h3");
    head.textContent = `Panel ${i + 1}`;
    const useFirst = document.createElement("button");
    useFirst.type = "button";
    useFirst.textContent = "Same as panel 1";
    useFirst.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.panels[0]) { panel.photoId = state.panels[0].photoId; buildPanelList(); renderPreview(); }
    });
    head.append(useFirst);
    card.append(head);

    const photoRow = document.createElement("div");
    photoRow.className = "panel-row";
    const photoLabel = document.createElement("label");
    photoLabel.textContent = "Photo";
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Photo for panel ${i + 1}`);
    state.photos.forEach((photo) => {
      const opt = document.createElement("option");
      opt.value = String(photo.id);
      opt.textContent = photo.name;
      if (photo.id === panel.photoId) opt.selected = true;
      select.append(opt);
    });
    if (!state.photos.length) {
      const opt = document.createElement("option");
      opt.textContent = "No photos yet";
      select.append(opt);
    }
    select.addEventListener("change", () => {
      panel.photoId = Number(select.value);
      state.selectedPanel = i;
      renderPreview();
    });
    select.addEventListener("click", (e) => e.stopPropagation());
    photoRow.append(photoLabel, select);
    card.append(photoRow);

    [["Zoom", "zoom", 1, 2.5, 0.05], ["Pan X", "panX", -0.5, 0.5, 0.01], ["Pan Y", "panY", -0.5, 0.5, 0.01]]
      .forEach(([labelText, key, min, max, step]) => {
        const row = document.createElement("div");
        row.className = "panel-row";
        const label = document.createElement("label");
        label.textContent = labelText;
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = String(min); slider.max = String(max); slider.step = String(step);
        slider.value = String(panel[key]);
        slider.setAttribute("aria-label", `${labelText} for panel ${i + 1}`);
        slider.addEventListener("input", () => {
          panel[key] = Number(slider.value);
          state.selectedPanel = i;
          renderPreview();
        });
        slider.addEventListener("click", (e) => e.stopPropagation());
        row.append(label, slider);
        card.append(row);
      });

    panelList.append(card);
  });
}

/* --------------------------------------------------------------- */
/* Export                                                          */
/* --------------------------------------------------------------- */

function exportCoverPNG(size) {
  const [w, h] = (size || state.size).split("x").map(Number);
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  renderCover(off.getContext("2d"), w, h);
  return new Promise((resolve) => off.toBlob((blob) => resolve(blob), "image/png"));
}

async function downloadExport() {
  if (!state.photos.length) return;
  exportButton.disabled = true;
  exportButton.textContent = "Exporting…";
  try {
    const blob = await exportCoverPNG(state.size);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vice-cover-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    statusLine.textContent = `Exported vice-cover-${state.size}.png — share it anywhere.`;
  } finally {
    exportButton.disabled = false;
    exportButton.textContent = "Export PNG";
  }
}

/* --------------------------------------------------------------- */
/* Shuffle + reset                                                 */
/* --------------------------------------------------------------- */

function shuffleLook() {
  const layouts = Object.keys(LAYOUT_NAMES);
  const grades = Object.keys(GRADES);
  setLayout(layouts[Math.floor(Math.random() * layouts.length)]);
  const grade = grades[Math.floor(Math.random() * grades.length)];
  state.grade = grade;
  document.querySelectorAll("#gradeChoices button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.grade === grade)));
  renderPreview();
}

function resetAll() {
  state.photos = [];
  state.panels = defaultPanels();
  state.layout = "split3";
  state.grade = "sunset";
  state.title = "SUNSET HEIST";
  state.tagline = "One last job under the neon sun";
  state.footer = "VICE CITY · SUMMER";
  state.captionSpot = "bottom";
  state.titleScale = 1;
  titleInput.value = state.title;
  taglineInput.value = state.tagline;
  footerInput.value = state.footer;
  captionSpot.value = "bottom";
  titleSize.value = "100";
  document.querySelectorAll("#layoutChoices button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.layout === "split3")));
  document.querySelectorAll("#gradeChoices button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.grade === "sunset")));
  buildPhotoList();
  buildPanelList();
  renderPreview();
}

/* --------------------------------------------------------------- */
/* Drag to pan on the preview                                      */
/* --------------------------------------------------------------- */

let drag = null;

function panelAtPoint(clientX, clientY) {
  const box = previewCanvas.getBoundingClientRect();
  const x = (clientX - box.left) / box.width;
  const y = (clientY - box.top) / box.height;
  const rects = layoutRects(state.layout);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { index: i, x, y, rect: r };
  }
  return null;
}

previewCanvas.addEventListener("pointerdown", (e) => {
  const hit = panelAtPoint(e.clientX, e.clientY);
  if (!hit) return;
  state.selectedPanel = hit.index;
  const panel = state.panels[hit.index];
  drag = { index: hit.index, startX: hit.x, startY: hit.y, panX: panel.panX, panY: panel.panY, rect: hit.rect };
  previewCanvas.setPointerCapture(e.pointerId);
  renderPreview();
});

previewCanvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const hit = panelAtPoint(e.clientX, e.clientY);
  if (!hit) return;
  const panel = state.panels[drag.index];
  panel.panX = Math.max(-0.5, Math.min(0.5, drag.panX + (hit.x - drag.startX) / drag.rect.w));
  panel.panY = Math.max(-0.5, Math.min(0.5, drag.panY + (hit.y - drag.startY) / drag.rect.h));
  renderPreview();
});

previewCanvas.addEventListener("pointerup", () => { drag = null; buildPanelList(); });
previewCanvas.addEventListener("pointercancel", () => { drag = null; });

/* --------------------------------------------------------------- */
/* Wiring                                                          */
/* --------------------------------------------------------------- */

photoInput.addEventListener("change", () => {
  [...photoInput.files].forEach(loadPhotoFile);
  photoInput.value = "";
});

photoDrop.addEventListener("click", () => photoInput.click());
photoDrop.addEventListener("dragover", (e) => { e.preventDefault(); photoDrop.classList.add("dragging"); });
photoDrop.addEventListener("dragleave", () => photoDrop.classList.remove("dragging"));
photoDrop.addEventListener("drop", (e) => {
  e.preventDefault();
  photoDrop.classList.remove("dragging");
  [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")).forEach(loadPhotoFile);
});

document.querySelectorAll(".sample-button").forEach((b) =>
  b.addEventListener("click", () => loadSample(b.dataset.sample)));

document.querySelectorAll("#layoutChoices button").forEach((b) =>
  b.addEventListener("click", () => setLayout(b.dataset.layout)));

document.querySelectorAll("#gradeChoices button").forEach((b) =>
  b.addEventListener("click", () => {
    state.grade = b.dataset.grade;
    document.querySelectorAll("#gradeChoices button").forEach((x) =>
      x.setAttribute("aria-pressed", String(x === b)));
    renderPreview();
  }));

document.querySelectorAll('input[name="exportSize"]').forEach((r) =>
  r.addEventListener("change", () => { state.size = r.value; renderPreview(); }));

titleInput.addEventListener("input", () => { state.title = titleInput.value; renderPreview(); });
taglineInput.addEventListener("input", () => { state.tagline = taglineInput.value; renderPreview(); });
footerInput.addEventListener("input", () => { state.footer = footerInput.value; renderPreview(); });
captionSpot.addEventListener("change", () => { state.captionSpot = captionSpot.value; renderPreview(); });
titleSize.addEventListener("input", () => { state.titleScale = Number(titleSize.value) / 100; renderPreview(); });

exportButton.addEventListener("click", downloadExport);
document.getElementById("shuffleButton").addEventListener("click", shuffleLook);
document.getElementById("resetButton").addEventListener("click", resetAll);

/* --------------------------------------------------------------- */
/* Shareable presets via the address bar, e.g.                     */
/* ?sample=sunset-rider.jpg&layout=grid&grade=neon&size=1080x1350  */
/* &title=NEON%20NIGHTS — also used to take the entry screenshots. */
/* --------------------------------------------------------------- */

function applyPresetFromURL() {
  const q = new URLSearchParams(location.search);
  const layout = q.get("layout");
  if (layout && LAYOUT_NAMES[layout]) state.layout = layout;
  const grade = q.get("grade");
  if (grade && GRADES[grade]) state.grade = grade;
  const size = q.get("size");
  if (size && /^\d+x\d+$/.test(size)) {
    state.size = size;
    document.querySelectorAll('input[name="exportSize"]').forEach((r) => { r.checked = r.value === size; });
  }
  if (q.get("title") !== null) { state.title = q.get("title"); titleInput.value = state.title; }
  if (q.get("tagline") !== null) { state.tagline = q.get("tagline"); taglineInput.value = state.tagline; }
  if (q.get("footer") !== null) { state.footer = q.get("footer"); footerInput.value = state.footer; }
  if (q.get("spot") === "top" || q.get("spot") === "bottom") {
    state.captionSpot = q.get("spot");
    captionSpot.value = state.captionSpot;
  }
  document.querySelectorAll("#layoutChoices button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.layout === state.layout)));
  document.querySelectorAll("#gradeChoices button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.grade === state.grade)));
  state.panels = defaultPanels();
  // Crop preset for the panels: zoom and pan apply to every panel, so a
  // shared link can frame the subject the way its maker framed it.
  const zoom = Number(q.get("zoom"));
  const panX = Number(q.get("panX"));
  const panY = Number(q.get("panY"));
  state.panels.forEach((panel) => {
    if (Number.isFinite(zoom) && zoom >= 1 && zoom <= 2.5) panel.zoom = zoom;
    if (Number.isFinite(panX)) panel.panX = Math.max(-0.5, Math.min(0.5, panX));
    if (Number.isFinite(panY)) panel.panY = Math.max(-0.5, Math.min(0.5, panY));
  });
  const sample = q.get("sample");
  if (sample) loadSample(`samples/${sample}`);
}

/* Small automation hook for the entry's own screenshots: the maker
 * (not the user) can ask the page for an exported PNG directly. */
window.__viceCover = {
  state,
  exportPNG: (size) => exportCoverPNG(size).then((blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  })),
  photoCount: () => state.photos.length,
  ready: () => document.fonts ? document.fonts.ready.then(() => true) : Promise.resolve(true),
};

/* Boot. */
state.panels = defaultPanels();
buildPanelList();
applyPresetFromURL();
renderPreview();
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => renderPreview());
}
