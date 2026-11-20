// Vice Cover Studio — hand-in program for make.fun's gta6-cover-art-01.
//
// The entry is a static web app (app/) plus 3–4 screenshots. This program
// gathers them into the output directory the grader reads and writes the
// dossier the judge sees, using the kit's own library to build it.
//
// It runs on Node with the standard library only:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

// The repository root is the folder this file lives in.
const repoRoot = fileURLToPath(new URL(".", import.meta.url));

// The grader gives us a writable /output; anywhere else, the caller may
// point MAKEFUN_OUTPUT_DIR at a scratch folder instead.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// The gate's own limits, from the competition's RULES.txt: the dossier text
// is capped at 160 KiB, screenshots at 4 files of 256 KiB each, and app/ at
// 993 files / 48 MiB. buildDossier refuses anything over those caps, so a
// bad hand-in fails loudly here instead of silently at the gate.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function handIn() {
  // Start from a clean output folder so a stale file can never leak in.
  // Clear the folder's contents, never the folder itself: the grader mounts
  // /output as its own filesystem, and deleting a mount point fails with
  // EBUSY (as root) or EPERM (as the grader's unprivileged user), which
  // aborts the run with exit code 1 before anything is handed in. That
  // was the previous submission's failure. Removing each entry inside the
  // folder gives the same clean slate without touching the mount itself.
  mkdirSync(outDir, { recursive: true });
  for (const entry of readdirSync(outDir)) {
    // Best effort only: a stale entry owned by someone else may refuse
    // to be removed, and that must never fail the hand-in — the grader
    // always hands us an empty /output, so there is nothing to clear there.
    try {
      rmSync(join(outDir, entry), { recursive: true, force: true });
    } catch {
      // Leave the undeletable entry alone and carry on.
    }
  }

  const appSource = join(repoRoot, "app");
  const shotsSource = join(repoRoot, "screenshots");
  if (!existsSync(appSource)) throw new Error("app/ is missing from the repository");
  if (!existsSync(shotsSource)) throw new Error("screenshots/ is missing from the repository");

  cpSync(appSource, join(outDir, "app"), { recursive: true });
  cpSync(shotsSource, join(outDir, "screenshots"), { recursive: true });

  const dossier = buildDossier(outDir, dossierCaps);
  writeFileSync(join(outDir, "dossier.json"), dossier);
  console.log(`handed in ${outDir} (${dossier.length} byte dossier)`);
}

handIn();
