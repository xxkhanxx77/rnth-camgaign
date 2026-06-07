import {
  activityLevel,
  buildHeatmapWeeks,
  monthLabelsForWeeks,
  summarizePostsByYear,
} from "./renaissCalendar";

export type ProofCardInput = {
  name: string;
  handle: string;
  topTag: string;
  rank: number;
  score: number;
  views: number;
  likes: number;
  followers: number | null;
  postsCount: number;
  avatarUrl: string;
  timestamps: number[];
};

const SCALE = 2;
const WIDTH = 1500;
const HEIGHT = 980;
const PAD = 48;

// Palette mirrors the on-screen glass UI (cool near-white + ink + renaiss orange).
const INK = "#211e1b";
const MUTED = "#6f6a62";
const ORANGE = "#ec6a1b";
const PANEL_FILL = "rgba(255, 255, 255, 0.74)";
const PANEL_BORDER = "rgba(255, 255, 255, 0.6)";
const HAIRLINE = "rgba(33, 30, 27, 0.10)";
const CELL_BORDER = "rgba(33, 30, 27, 0.06)";
const HEAT_LEVEL_ALPHA = [0, 0.32, 0.52, 0.74, 0.96];

const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""];

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const scoreFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function compact(value: number) {
  return compactFormatter.format(Math.round(value));
}

function scoreText(value: number) {
  return scoreFormatter.format(Number(value.toFixed(2)));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function ensureFonts() {
  if (!("fonts" in document)) {
    return;
  }

  try {
    await Promise.all([
      document.fonts.load("900 80px Archivo"),
      document.fonts.load("800 46px Archivo"),
      document.fonts.load("700 22px 'Geist Variable'"),
      document.fonts.load("600 22px 'Geist Variable'"),
    ]);
    await document.fonts.ready;
  } catch {
    // Fonts may already be cached or unavailable; drawing continues with fallbacks.
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function getInitials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (letters || name.slice(0, 2) || "RX").toUpperCase();
}

function withLetterSpacing(
  ctx: CanvasRenderingContext2D,
  spacing: string,
  draw: () => void,
) {
  const target = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const previous = target.letterSpacing;
  try {
    target.letterSpacing = spacing;
  } catch {
    // letterSpacing unsupported — render without it.
  }
  draw();
  try {
    target.letterSpacing = previous ?? "0px";
  } catch {
    // ignore
  }
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 18,
) {
  ctx.save();
  ctx.shadowColor = "rgba(20, 20, 20, 0.12)";
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 22;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = PANEL_FILL;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  name: string,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  roundRect(ctx, x, y, size, size, 16);
  ctx.fillStyle = "#dfe6ef";
  ctx.fill();
  ctx.clip();

  if (image) {
    const ratio = Math.max(size / image.width, size / image.height);
    const drawW = image.width * ratio;
    const drawH = image.height * ratio;
    ctx.drawImage(
      image,
      x + (size - drawW) / 2,
      y + (size - drawH) / 2,
      drawW,
      drawH,
    );
  } else {
    ctx.fillStyle = INK;
    ctx.font = "800 40px Archivo, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(getInitials(name), x + size / 2, y + size / 2 + 2);
  }

  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, size, size, 16);
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// --- Tile icons (white glyphs on the orange accent square) -----------------

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.46;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
}

function drawEye(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - s, cy);
  ctx.quadraticCurveTo(cx, cy - s * 0.85, cx + s, cy);
  ctx.quadraticCurveTo(cx, cy + s * 0.85, cx - s, cy);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.34, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  const top = cy - s * 0.55;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.7);
  ctx.bezierCurveTo(cx - s * 1.3, cy - s * 0.2, cx - s * 0.5, top - s * 0.5, cx, cy - s * 0.1);
  ctx.bezierCurveTo(cx + s * 0.5, top - s * 0.5, cx + s * 1.3, cy - s * 0.2, cx, cy + s * 0.7);
  ctx.closePath();
  ctx.fill();
}

function drawUsers(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  const drawPerson = (px: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(px, cy - s * 0.45, s * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px - s * 0.6, cy + s * 0.7);
    ctx.quadraticCurveTo(px - s * 0.6, cy + s * 0.05, px, cy + s * 0.05);
    ctx.quadraticCurveTo(px + s * 0.6, cy + s * 0.05, px + s * 0.6, cy + s * 0.7);
    ctx.closePath();
    ctx.fill();
  };
  drawPerson(cx + s * 0.55, 0.55);
  drawPerson(cx - s * 0.35, 1);
  ctx.globalAlpha = 1;
}

type TileIcon = "score" | "views" | "likes" | "followers";

function drawTileIcon(
  ctx: CanvasRenderingContext2D,
  icon: TileIcon,
  cx: number,
  cy: number,
) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (icon === "score") drawStar(ctx, cx, cy, 11);
  else if (icon === "views") drawEye(ctx, cx, cy, 12);
  else if (icon === "likes") drawHeart(ctx, cx, cy, 9);
  else drawUsers(ctx, cx, cy, 10);
  ctx.restore();
}

function drawStatTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  icon: TileIcon,
) {
  drawPanel(ctx, x, y, w, h, 16);

  const inset = 26;
  ctx.fillStyle = MUTED;
  ctx.font = "700 15px 'Geist Variable', Geist, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  withLetterSpacing(ctx, "2px", () => ctx.fillText(label, x + inset, y + inset + 12));

  // Orange accent square + glyph, top-right.
  const iconSize = 40;
  const iconX = x + w - inset - iconSize;
  const iconY = y + inset - 4;
  roundRect(ctx, iconX, iconY, iconSize, iconSize, 11);
  ctx.fillStyle = ORANGE;
  ctx.fill();
  drawTileIcon(ctx, icon, iconX + iconSize / 2, iconY + iconSize / 2);

  ctx.fillStyle = INK;
  ctx.font = "900 52px Archivo, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(value, x + inset, y + h - inset - 4);
}

function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  timestamps: number[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const summary = summarizePostsByYear(
    timestamps.map((timestamp) => ({ timestamp })),
  );
  const year = summary.years[0] ?? new Date().getFullYear();
  const total = summary.totalsByYear.get(year) ?? 0;
  const weeks = buildHeatmapWeeks(
    year,
    summary.countsByYear.get(year),
    summary.rangesByYear.get(year),
  );
  const monthLabels = monthLabelsForWeeks(weeks);

  // Title row: "{total} posts in {year}" + year pill.
  ctx.fillStyle = INK;
  ctx.font = "800 20px 'Geist Variable', Geist, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${total} ${total === 1 ? "post" : "posts"} in ${year}`, x, y + 16);

  const pillText = String(year);
  ctx.font = "800 16px 'Geist Variable', Geist, sans-serif";
  const pillW = ctx.measureText(pillText).width + 36;
  const pillH = 34;
  roundRect(ctx, x + w - pillW, y - 6, pillW, pillH, pillH / 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(pillText, x + w - pillW / 2, y + 16);

  // Grid geometry.
  const gutter = 40;
  const rowGap = 12;
  const cellGap = 5;
  const gridLeft = x + gutter + rowGap;
  const gridWidth = w - gutter - rowGap;
  const monthsTop = y + 44;
  const gridTop = monthsTop + 22;
  const legendH = 28;
  const gridBottom = y + h - legendH - 14;
  const cellH = (gridBottom - gridTop - cellGap * 6) / 7;
  const colW = (gridWidth - cellGap * (weeks.length - 1)) / weeks.length;
  const colStep = colW + cellGap;

  // Month labels.
  ctx.fillStyle = MUTED;
  ctx.font = "700 14px 'Geist Variable', Geist, sans-serif";
  ctx.textAlign = "left";
  monthLabels.forEach((label, index) => {
    if (label) {
      ctx.fillText(label, gridLeft + index * colStep, monthsTop + 6);
    }
  });

  // Weekday labels.
  ctx.textBaseline = "middle";
  WEEKDAYS.forEach((label, row) => {
    if (label) {
      ctx.fillText(label, x, gridTop + row * (cellH + cellGap) + cellH / 2);
    }
  });
  ctx.textBaseline = "alphabetic";

  // Cells.
  weeks.forEach((week, weekIndex) => {
    week.forEach((day, row) => {
      if (!day.inYear) {
        return;
      }

      const cellX = gridLeft + weekIndex * colStep;
      const cellY = gridTop + row * (cellH + cellGap);
      let fill: string;

      if (day.future) {
        fill = "rgba(33, 30, 27, 0.03)";
      } else {
        const level = activityLevel(day.count);
        fill =
          level === 0
            ? "rgba(33, 30, 27, 0.07)"
            : `rgba(236, 106, 27, ${HEAT_LEVEL_ALPHA[level]})`;
      }

      roundRect(ctx, cellX, cellY, colW, cellH, Math.min(7, cellH * 0.34));
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = CELL_BORDER;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  });

  // Legend.
  const legendY = gridBottom + 16;
  const chip = 15;
  let legendX = x;
  ctx.fillStyle = MUTED;
  ctx.font = "700 13px 'Geist Variable', Geist, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Less", legendX, legendY + chip / 2);
  legendX += ctx.measureText("Less").width + 10;

  HEAT_LEVEL_ALPHA.forEach((alpha, index) => {
    roundRect(ctx, legendX, legendY, chip, chip, 4);
    ctx.fillStyle =
      index === 0 ? "rgba(33, 30, 27, 0.07)" : `rgba(236, 106, 27, ${alpha})`;
    ctx.fill();
    ctx.strokeStyle = CELL_BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();
    legendX += chip + 6;
  });

  ctx.fillStyle = MUTED;
  ctx.fillText("More", legendX + 4, legendY + chip / 2);
  ctx.textBaseline = "alphabetic";
}

function paintBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#eef1f6";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle blueprint grid, matching the app body.
  ctx.strokeStyle = "rgba(33, 30, 27, 0.045)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= WIDTH; gx += 28) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, HEIGHT);
    ctx.stroke();
  }
  for (let gy = 0; gy <= HEIGHT; gy += 28) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(WIDTH, gy);
    ctx.stroke();
  }

  // Warm diagonal sheen on the right, like the dashboard.
  const sheen = ctx.createLinearGradient(WIDTH * 0.45, 0, WIDTH, HEIGHT);
  sheen.addColorStop(0, "rgba(236, 106, 27, 0)");
  sheen.addColorStop(1, "rgba(236, 106, 27, 0.08)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

export async function downloadProofCard(input: ProofCardInput): Promise<void> {
  await ensureFonts();
  const avatar = await loadImage(input.avatarUrl);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = HEIGHT * SCALE;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas is not supported in this browser.");
  }

  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "alphabetic";

  paintBackground(ctx);

  const contentW = WIDTH - PAD * 2;

  // --- Header panel ---------------------------------------------------------
  const headTop = PAD;
  const headH = 188;
  drawPanel(ctx, PAD, headTop, contentW, headH);

  const avatarSize = 104;
  const avatarX = PAD + 36;
  const avatarY = headTop + (headH - avatarSize) / 2;
  drawAvatar(ctx, avatar, input.name, avatarX, avatarY, avatarSize);

  const textX = avatarX + avatarSize + 28;
  ctx.fillStyle = MUTED;
  ctx.font = "800 14px 'Geist Variable', Geist, sans-serif";
  ctx.textAlign = "left";
  withLetterSpacing(ctx, "3px", () =>
    ctx.fillText(`RANK #${input.rank}`, textX, headTop + 52),
  );

  ctx.fillStyle = INK;
  ctx.font = "900 60px Archivo, sans-serif";
  ctx.fillText(input.name, textX, headTop + 108);

  ctx.fillStyle = MUTED;
  ctx.font = "600 22px 'Geist Variable', Geist, sans-serif";
  const metaParts = [`@${input.handle}`];
  if (input.topTag) metaParts.push(`#${input.topTag}`);
  metaParts.push(`${compact(input.postsCount)} posts`);
  ctx.fillText(metaParts.join("   ·   "), textX, headTop + 146);

  // Rank, top-right.
  ctx.fillStyle = INK;
  ctx.font = "900 60px Archivo, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`#${input.rank}`, WIDTH - PAD - 36, headTop + 76);

  // --- Stat tiles -----------------------------------------------------------
  const tilesTop = headTop + headH + 18;
  const tilesH = 150;
  const tileGap = 18;
  const tileW = (contentW - tileGap * 3) / 4;
  const tiles: Array<{ label: string; value: string; icon: TileIcon }> = [
    { label: "FINAL SCORE", value: scoreText(input.score), icon: "score" },
    { label: "VIEWS", value: compact(input.views), icon: "views" },
    { label: "LIKES", value: compact(input.likes), icon: "likes" },
    {
      label: "FOLLOWERS",
      value: input.followers === null ? "—" : compact(input.followers),
      icon: "followers",
    },
  ];
  tiles.forEach((tile, index) => {
    drawStatTile(
      ctx,
      PAD + index * (tileW + tileGap),
      tilesTop,
      tileW,
      tilesH,
      tile.label,
      tile.value,
      tile.icon,
    );
  });

  // --- Posts / heatmap panel ------------------------------------------------
  const postsTop = tilesTop + tilesH + 18;
  const postsH = HEIGHT - PAD - postsTop;
  drawPanel(ctx, PAD, postsTop, contentW, postsH);

  const postsInset = 32;
  ctx.fillStyle = MUTED;
  ctx.font = "800 14px 'Geist Variable', Geist, sans-serif";
  ctx.textAlign = "left";
  withLetterSpacing(ctx, "3px", () =>
    ctx.fillText("AUTHOR POSTS", PAD + postsInset, postsTop + postsInset + 8),
  );
  ctx.fillStyle = INK;
  ctx.font = "900 40px Archivo, sans-serif";
  ctx.fillText("POSTS", PAD + postsInset, postsTop + postsInset + 54);

  const heatTop = postsTop + postsInset + 86;
  drawHeatmap(
    ctx,
    input.timestamps,
    PAD + postsInset,
    heatTop,
    contentW - postsInset * 2,
    postsTop + postsH - postsInset - heatTop,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), "image/png"),
  );

  if (!blob) {
    throw new Error("Could not export the card image.");
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `renaiss-${input.handle || "profile"}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
