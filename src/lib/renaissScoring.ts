export type CsvRecord = Record<string, string>;

export type RenaissProfileCsvRow = CsvRecord & {
  author_username: string;
  author_name: string;
  profile_url: string;
  nitter_profile_url: string;
  first_renaiss_at: string;
  first_renaiss_url: string;
  first_renaiss_id: string;
  renaiss_post_count: string;
  followers: string;
  following: string;
  tweets: string;
  likes: string;
  baseline_posts_found: string;
  baseline_status: string;
  baseline_we_max: string;
  baseline_imp_max: string;
  baseline_top_we_url: string;
  baseline_top_imp_url: string;
  baseline_skipped_renaiss_related: string;
  error: string;
};

export type RenaissPriorPostCsvRow = CsvRecord & {
  author_username: string;
  baseline_index: string;
  created_at: string;
  url: string;
  nitter_url: string;
  replies: string;
  reposts: string;
  quotes: string;
  likes: string;
  views: string;
  weighted_engagement: string;
  description: string;
};

export type RenaissPriorPostSummary = {
  authorUsername: string;
  baselineIndex: number;
  createdAt: string;
  url: string;
  replies: number;
  reposts: number;
  quotes: number;
  likes: number;
  impressions: number;
  weightedEngagement: number;
  description: string;
};

export type RenaissProfileSummary = {
  authorUsername: string;
  authorName: string;
  profileUrl: string;
  firstRenaissAt: string;
  firstRenaissUrl: string;
  renaissPostCount: number | null;
  followers: number | null;
  tweets: number | null;
  baselinePostsFound: number | null;
  baselineStatus: string;
  baselineWeMax: number | null;
  baselineImpMax: number | null;
  baselineTopWeUrl: string;
  baselineTopImpUrl: string;
  baselineSkippedRenaissRelated: number | null;
  error: string;
  priorPosts: RenaissPriorPostSummary[];
};

export type RenaissProfileMap = Map<string, RenaissProfileSummary>;

export type RenaissPostMetrics = {
  replies: number;
  reposts: number;
  quotes: number;
  bookmarks: number;
  likes: number;
  impressions: number;
  weightedEngagement: number;
};

export type RenaissScoreBreakdown = {
  tier: number;
  weightedEngagement: number;
  werPercent: number;
  tierNorm: number;
  werNorm: number;
  scaleNorm: number;
  impressionNorm: number;
  baseScore: number;
  qualityMultiplier: number;
  postCapFactor: number;
  score: number;
};

export type RenaissEligibility = {
  known: boolean;
  eligible: boolean;
  reasons: string[];
};

export type RenaissRiskSeverity = "yellow" | "red";

export type RenaissRiskFlag = {
  id: string;
  label: string;
  severity: RenaissRiskSeverity;
  value: number;
  detail: string;
};

export type RenaissRiskSummary = {
  total: number;
  yellow: number;
  red: number;
  level: "clear" | "watch" | "high";
};

export const RENAISS_DEFAULT_QUALITY_MULTIPLIER = 1;

export function createRenaissProfileMap(
  profileRows: RenaissProfileCsvRow[],
  priorRows: RenaissPriorPostCsvRow[] = [],
): RenaissProfileMap {
  const priorMap = createPriorPostMap(priorRows);
  const profiles: RenaissProfileMap = new Map();

  for (const row of profileRows) {
    const authorUsername = row.author_username?.trim() ?? "";
    const key = normalizeRenaissUsername(authorUsername);

    if (!key) {
      continue;
    }

    const priorPosts = priorMap.get(key) ?? [];
    const baselineWeFromPrior = maxNullable(
      priorPosts.map((post) => post.weightedEngagement),
    );
    const baselineImpFromPrior = maxNullable(
      priorPosts.map((post) => post.impressions),
    );
    const baselinePostsFound = firstNullableNumber(
      row.baseline_posts_found,
      priorPosts.length > 0 ? priorPosts.length : undefined,
    );

    profiles.set(key, {
      authorUsername,
      authorName: row.author_name?.trim() || authorUsername,
      profileUrl: row.profile_url?.trim() ?? "",
      firstRenaissAt: row.first_renaiss_at?.trim() ?? "",
      firstRenaissUrl: row.first_renaiss_url?.trim() ?? "",
      renaissPostCount: parseNullableNumber(row.renaiss_post_count),
      followers: parseNullableNumber(row.followers),
      tweets: parseNullableNumber(row.tweets),
      baselinePostsFound,
      baselineStatus: row.baseline_status?.trim() ?? "",
      baselineWeMax: firstNullableNumber(
        row.baseline_we_max,
        baselineWeFromPrior,
      ),
      baselineImpMax: firstNullableNumber(
        row.baseline_imp_max,
        baselineImpFromPrior,
      ),
      baselineTopWeUrl: row.baseline_top_we_url?.trim() ?? "",
      baselineTopImpUrl: row.baseline_top_imp_url?.trim() ?? "",
      baselineSkippedRenaissRelated: parseNullableNumber(
        row.baseline_skipped_renaiss_related,
      ),
      error: row.error?.trim() ?? "",
      priorPosts,
    });
  }

  for (const [key, priorPosts] of priorMap.entries()) {
    if (profiles.has(key)) {
      continue;
    }

    profiles.set(key, {
      authorUsername: priorPosts[0]?.authorUsername ?? key,
      authorName: priorPosts[0]?.authorUsername ?? key,
      profileUrl: "",
      firstRenaissAt: "",
      firstRenaissUrl: "",
      renaissPostCount: null,
      followers: null,
      tweets: null,
      baselinePostsFound: priorPosts.length,
      baselineStatus: "prior-only",
      baselineWeMax: maxNullable(priorPosts.map((post) => post.weightedEngagement)),
      baselineImpMax: maxNullable(priorPosts.map((post) => post.impressions)),
      baselineTopWeUrl: "",
      baselineTopImpUrl: "",
      baselineSkippedRenaissRelated: null,
      error: "",
      priorPosts,
    });
  }

  return profiles;
}

export function getRenaissProfile(
  profiles: RenaissProfileMap,
  username: string | undefined | null,
) {
  const key = normalizeRenaissUsername(username);

  return key ? profiles.get(key) ?? null : null;
}

export function evaluateRenaissEligibility(
  profile: RenaissProfileSummary | null | undefined,
): RenaissEligibility {
  const followers = profile?.followers ?? null;
  const priorPosts = profile?.baselinePostsFound ?? null;
  const reasons: string[] = [];

  if (!profile) {
    reasons.push("Profile missing");
  }

  if (followers === null) {
    reasons.push("Followers missing");
  } else if (followers < 1_000) {
    reasons.push("Followers below 1,000");
  }

  if (priorPosts === null) {
    reasons.push("Prior posts missing");
  } else if (priorPosts < 10) {
    reasons.push("Prior posts below 10");
  }

  return {
    known: followers !== null && priorPosts !== null,
    eligible: followers !== null && followers >= 1_000 && priorPosts !== null && priorPosts >= 10,
    reasons: reasons.length > 0 ? reasons : ["Eligible"],
  };
}

export function getRenaissPostMetrics(row: object): RenaissPostMetrics {
  const replies = readNumber(row, ["replies", "reply_count", "replyCount"]);
  const reposts = readNumber(row, ["reposts", "retweets", "repost_count", "retweetCount"]);
  const quotes = readNumber(row, ["quotes", "quote_count", "quoteCount"]);
  const bookmarks = readNumber(row, ["bookmarks", "bookmark_count", "bookmarkCount"]);
  const likes = readNumber(row, ["likes", "like_count", "likeCount"]);
  const impressions = readNumber(row, [
    "impressions",
    "impression_count",
    "views",
    "view_count",
    "viewCount",
  ]);
  const weightedEngagement =
    replies * 5 + reposts * 4 + quotes * 4 + bookmarks * 2 + likes;

  return {
    replies,
    reposts,
    quotes,
    bookmarks,
    likes,
    impressions,
    weightedEngagement,
  };
}

export function calculateRenaissStage4PostScore({
  metrics,
  followers,
  lifetimeIndex,
  qualityMultiplier = RENAISS_DEFAULT_QUALITY_MULTIPLIER,
}: {
  metrics: RenaissPostMetrics;
  followers: number | null;
  lifetimeIndex: number;
  qualityMultiplier?: number;
}): RenaissScoreBreakdown {
  const followerCount = followers ?? 0;
  const tier = getRenaissTier(followerCount);
  const werPercent =
    followerCount > 0 ? (metrics.weightedEngagement / followerCount) * 100 : 0;
  const tierNorm = (tier / 6) * 100;
  const werNorm = Math.min((werPercent / 15) * 100, 100);
  const scaleNorm = Math.min(
    (Math.log10(metrics.weightedEngagement + 1) / 5) * 100,
    100,
  );
  const impressionNorm = Math.min(
    (Math.log10(metrics.impressions + 1) / 6) * 100,
    100,
  );
  const baseScore =
    tierNorm * 0.35 +
    werNorm * 0.2 +
    scaleNorm * 0.35 +
    impressionNorm * 0.1;
  const postCapFactor = lifetimeIndex <= 30 ? 1 : 0.3;

  return {
    tier,
    weightedEngagement: metrics.weightedEngagement,
    werPercent,
    tierNorm,
    werNorm,
    scaleNorm,
    impressionNorm,
    baseScore,
    qualityMultiplier,
    postCapFactor,
    score: baseScore * qualityMultiplier * postCapFactor,
  };
}

export function getRenaissRiskFlags(
  metrics: RenaissPostMetrics,
  profile: RenaissProfileSummary | null | undefined,
): RenaissRiskFlag[] {
  const flags: RenaissRiskFlag[] = [];
  const engagementTotal =
    metrics.likes +
    metrics.replies +
    metrics.reposts +
    metrics.quotes +
    metrics.bookmarks;
  const likeRatio =
    metrics.likes / (metrics.replies + metrics.reposts + metrics.quotes + 1);

  pushUpperFlag(flags, {
    id: "like-ratio",
    label: "Like ratio",
    value: likeRatio,
    yellow: 8,
    red: 15,
    detail: `${formatRatio(likeRatio)} likes per conversation/share action`,
  });

  if (metrics.impressions > 5_000) {
    const eri = (engagementTotal / metrics.impressions) * 100;

    pushLowerFlag(flags, {
      id: "eri-low",
      label: "Low ERI",
      value: eri,
      yellow: 1.5,
      red: 0.8,
      detail: `${formatPercent(eri)} engagement per impression`,
    });
    pushUpperFlag(flags, {
      id: "eri-high",
      label: "High ERI",
      value: eri,
      yellow: 6,
      red: 10,
      detail: `${formatPercent(eri)} engagement per impression`,
    });
  }

  if (metrics.impressions > 0) {
    const liRatio = metrics.likes / metrics.impressions;

    pushUpperFlag(flags, {
      id: "like-impression",
      label: "Likes over views",
      value: liRatio,
      yellow: 0.5,
      red: 1,
      detail: `${formatRatio(liRatio)} likes per impression`,
    });
  }

  const rtRatio = metrics.reposts / (metrics.likes + 1);
  pushUpperFlag(flags, {
    id: "rt-like",
    label: "Repost ratio",
    value: rtRatio,
    yellow: 0.8,
    red: 1.2,
    detail: `${formatRatio(rtRatio)} reposts per like`,
  });

  const rtEng = metrics.reposts / (metrics.replies + metrics.quotes + 1);
  pushUpperFlag(flags, {
    id: "rt-engagement",
    label: "Repost concentration",
    value: rtEng,
    yellow: 8,
    red: 15,
    detail: `${formatRatio(rtEng)} reposts per reply/quote`,
  });

  const spikeValues = [
    profile?.baselineWeMax && profile.baselineWeMax > 0
      ? metrics.weightedEngagement / profile.baselineWeMax
      : null,
    profile?.baselineImpMax && profile.baselineImpMax > 0
      ? metrics.impressions / profile.baselineImpMax
      : null,
  ].filter((value): value is number => value !== null);

  if (spikeValues.length > 0) {
    const spike = Math.max(...spikeValues);

    pushUpperFlag(flags, {
      id: "baseline-spike",
      label: "Baseline spike",
      value: spike,
      yellow: 5,
      red: 10,
      detail: `${formatRatio(spike)}x over profile baseline max`,
    });
  }

  return flags;
}

export function summarizeRenaissRiskFlags(
  flags: RenaissRiskFlag[],
): RenaissRiskSummary {
  const red = flags.filter((flag) => flag.severity === "red").length;
  const yellow = flags.length - red;

  return {
    total: flags.length,
    yellow,
    red,
    level: red > 0 || flags.length >= 2 ? "high" : flags.length > 0 ? "watch" : "clear",
  };
}

export function getRenaissTier(followers: number) {
  if (followers > 300_000) {
    return 6;
  }

  if (followers >= 100_000) {
    return 5;
  }

  if (followers >= 50_000) {
    return 4;
  }

  if (followers >= 10_000) {
    return 3;
  }

  if (followers >= 3_000) {
    return 2;
  }

  if (followers >= 1_000) {
    return 1;
  }

  return 0;
}

export function normalizeRenaissUsername(value: string | undefined | null) {
  return String(value ?? "").trim().replace(/^@/, "").toLowerCase();
}

function createPriorPostMap(rows: RenaissPriorPostCsvRow[]) {
  const map = new Map<string, RenaissPriorPostSummary[]>();

  for (const row of rows) {
    const key = normalizeRenaissUsername(row.author_username);

    if (!key) {
      continue;
    }

    const summary: RenaissPriorPostSummary = {
      authorUsername: row.author_username?.trim() ?? "",
      baselineIndex: parseNumber(row.baseline_index),
      createdAt: row.created_at?.trim() ?? "",
      url: row.url?.trim() ?? "",
      replies: parseNumber(row.replies),
      reposts: parseNumber(row.reposts),
      quotes: parseNumber(row.quotes),
      likes: parseNumber(row.likes),
      impressions: parseNumber(row.views),
      weightedEngagement:
        parseNullableNumber(row.weighted_engagement) ??
        getRenaissPostMetrics(row).weightedEngagement,
      description: row.description?.trim() ?? "",
    };
    const current = map.get(key) ?? [];
    current.push(summary);
    map.set(key, current);
  }

  return map;
}

function pushUpperFlag(
  flags: RenaissRiskFlag[],
  config: {
    id: string;
    label: string;
    value: number;
    yellow: number;
    red: number;
    detail: string;
  },
) {
  if (config.value > config.red) {
    flags.push({
      id: config.id,
      label: config.label,
      severity: "red",
      value: config.value,
      detail: config.detail,
    });
    return;
  }

  if (config.value > config.yellow) {
    flags.push({
      id: config.id,
      label: config.label,
      severity: "yellow",
      value: config.value,
      detail: config.detail,
    });
  }
}

function pushLowerFlag(
  flags: RenaissRiskFlag[],
  config: {
    id: string;
    label: string;
    value: number;
    yellow: number;
    red: number;
    detail: string;
  },
) {
  if (config.value < config.red) {
    flags.push({
      id: config.id,
      label: config.label,
      severity: "red",
      value: config.value,
      detail: config.detail,
    });
    return;
  }

  if (config.value < config.yellow) {
    flags.push({
      id: config.id,
      label: config.label,
      severity: "yellow",
      value: config.value,
      detail: config.detail,
    });
  }
}

function readNumber(row: object, keys: string[]) {
  const record = row as Record<string, string | number | undefined | null>;

  for (const key of keys) {
    const value = record[key];

    if (String(value ?? "").trim()) {
      return parseNumber(value);
    }
  }

  return 0;
}

function parseNullableNumber(value: string | number | undefined | null) {
  if (!String(value ?? "").trim()) {
    return null;
  }

  return parseNumber(value);
}

function firstNullableNumber(
  first: string | number | undefined | null,
  fallback: string | number | undefined | null,
) {
  const parsedFirst = parseNullableNumber(first);

  if (parsedFirst !== null) {
    return parsedFirst;
  }

  return parseNullableNumber(fallback);
}

function parseNumber(value: string | number | undefined | null) {
  const raw = String(value ?? "").trim().toLowerCase();

  if (!raw) {
    return 0;
  }

  const multiplier = raw.endsWith("k")
    ? 1_000
    : raw.endsWith("m")
      ? 1_000_000
      : 1;
  const numeric = Number(raw.replace(/[^\d.-]/g, ""));

  return Number.isFinite(numeric) ? numeric * multiplier : 0;
}

function maxNullable(values: number[]) {
  const numbers = values.filter((value) => Number.isFinite(value));

  if (numbers.length === 0) {
    return null;
  }

  return Math.max(...numbers);
}

function formatRatio(value: number) {
  return value.toFixed(value >= 10 ? 1 : 2);
}

function formatPercent(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}
