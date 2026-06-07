import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Repeat2,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import AdminRenaissDashboard from "./AdminRenaiss";
import avatarMap from "./data/avatars.json";
import { parseCsv } from "./lib/csv";
import {
  calculateRenaissStage4PostScore,
  createRenaissProfileMap,
  evaluateRenaissEligibility,
  getRenaissPostMetrics,
  getRenaissProfile,
  getRenaissRiskFlags,
  summarizeRenaissRiskFlags,
  type RenaissPriorPostCsvRow,
  type RenaissProfileCsvRow,
  type RenaissProfileMap,
  type RenaissProfileSummary,
  type RenaissRiskFlag,
} from "./lib/renaissScoring";
import { PostingHeatmap } from "./components/PostingHeatmap";
import { downloadProofCard } from "./lib/proofCard";
import { isRenaissOfficialAccount } from "./lib/renaissOfficialAccounts";
import {
  type BotFlags,
  BOT_FLAGS_STORAGE_KEY,
  isBotFlagged,
  readBotFlags,
} from "./lib/renaissBotFlags";
import { cn } from "./lib/utils";

type PostRow = {
  id: string;
  url: string;
  description: string;
  author_name: string;
  author_username: string;
  created_at: string;
  replies: string;
  reposts: string;
  quotes: string;
  bookmarks?: string;
  bookmark_count?: string;
  likes: string;
  views: string;
  impressions?: string;
  impression_count?: string;
  followers?: string;
  author_followers?: string;
  followers_count?: string;
  follower_count?: string;
  hashtags: string;
  score: string;
};

type AuthorStat = {
  authorName: string;
  authorUsername: string;
  latestPostUrl: string;
  posts: number;
  replies: number;
  reposts: number;
  quotes: number;
  likes: number;
  views: number;
  score: number;
  rawScore: number;
  viewsLikesScore: number;
  weightedEngagement: number;
  followers: number | null;
  priorPosts: number | null;
  eligibilityKnown: boolean;
  eligible: boolean;
  eligibilityReasons: string[];
  baselineWeMax: number | null;
  baselineImpMax: number | null;
  riskFlags: number;
  yellowFlags: number;
  redFlags: number;
  riskLevel: "clear" | "watch" | "high";
  profile: RenaissProfileSummary | null;
  latestTimestamp: number;
  topTag: string;
};

type RankedAuthor = AuthorStat & {
  rank: number;
};

type SortKey = "score" | "views" | "likes" | "posts";
type PostSortKey = "latest" | "views" | "likes";

type AuthorPost = {
  id: string;
  url: string;
  description: string;
  createdAt: string;
  timestamp: number;
  replies: number;
  reposts: number;
  quotes: number;
  bookmarks: number;
  likes: number;
  views: number;
  score: number;
  rawScore: number;
  viewsLikesScore: number;
  weightedEngagement: number;
  tier: number;
  werPercent: number;
  postCapFactor: number;
  lifetimeIndex: number;
  riskFlags: RenaissRiskFlag[];
  riskLevel: "clear" | "watch" | "high";
  hashtags: string[];
};

type PublicSeasonKey = "season0" | "season1";

type PublicPosts = Record<PublicSeasonKey, PostRow[]>;

type PublicData = {
  posts: PublicPosts;
  profiles: RenaissProfileMap;
};

type PublicSeason = {
  key: PublicSeasonKey;
  label: string;
  badge: string;
  source: string;
  fact: string;
};

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: "score", label: "Score" },
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "posts", label: "Posts" },
];

const postSortOptions: Array<{ key: PostSortKey; label: string }> = [
  { key: "latest", label: "Latest" },
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
];

const numberFormatter = new Intl.NumberFormat("en-US");
const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const metricLabels: Record<SortKey, string> = {
  score: "Formula score",
  views: "Views",
  likes: "Likes",
  posts: "Posts",
};

const publicSeasons: Record<PublicSeasonKey, PublicSeason> = {
  season0: {
    key: "season0",
    label: "Season 0",
    badge: "Season 0 archive",
    source: "/renaiss_season0.csv",
    fact: "Before Jun 1, 2026",
  },
  season1: {
    key: "season1",
    label: "Season 1",
    badge: "Season 1 live",
    source: "/renaiss_posts.csv",
    fact: "Jun 1, 2026 onward",
  },
};

const seasonOneStart = Date.UTC(2026, 5, 1);
const emptyPosts: PostRow[] = [];
const emptyProfiles: RenaissProfileMap = new Map();

async function loadPosts(): Promise<PublicData> {
  const [season0, season1, profileRows, priorRows] = await Promise.all([
    loadPostCsv(publicSeasons.season0.source),
    loadPostCsv(publicSeasons.season1.source),
    loadCsv<RenaissProfileCsvRow>("/renaiss_profile_mar_may_2026.csv"),
    loadCsv<RenaissPriorPostCsvRow>(
      "/renaiss_profile_mar_may_2026_prior_posts.csv",
    ),
  ]);

  return {
    posts: {
      season0,
      season1: season1.filter(
        (post) => parsePostDate(post.created_at) >= seasonOneStart,
      ),
    },
    profiles: createRenaissProfileMap(profileRows, priorRows),
  };
}

async function loadPostCsv(path: string): Promise<PostRow[]> {
  return loadCsv<PostRow>(path);
}

async function loadCsv<T extends Record<string, string>>(path: string): Promise<T[]> {
  const res = await fetch(path);

  if (!res.ok) {
    throw new Error(`CSV request failed: ${path}`);
  }

  return parseCsv<T>(await res.text());
}

export default function App() {
  // SPA route: vercel.json rewrites all paths to index.html, so we check pathname here
  if (window.location.pathname === "/admin-renaiss") {
    return <AdminRenaissDashboard />;
  }

  return <PublicRenaissDashboard />;
}

function PublicRenaissDashboard() {
  const [activeSeason, setActiveSeason] =
    useState<PublicSeasonKey>("season0");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [postSortBy, setPostSortBy] = useState<PostSortKey>("latest");
  const [selectedUsername, setSelectedUsername] = useState(() =>
    getUsernameFromHash(),
  );
  const [botFlags, setBotFlags] = useState<BotFlags>(() => readBotFlags());

  const {
    data,
    isError,
    isLoading,
  } = useQuery({
    queryKey: ["renaiss-posts"],
    queryFn: loadPosts,
    staleTime: Infinity,
  });

  const activePosts = data?.posts[activeSeason] ?? emptyPosts;
  const profiles = data?.profiles ?? emptyProfiles;
  const activeSeasonConfig = publicSeasons[activeSeason];
  const authors = useMemo(
    () =>
      aggregateAuthors(activePosts, profiles).filter(
        (author) =>
          !isRenaissOfficialAccount(author.authorUsername) &&
          !isBotFlagged(author.authorUsername, botFlags),
      ),
    [activePosts, botFlags, profiles],
  );
  const rankedAuthors = useMemo(
    () => rankAuthors(authors, sortBy),
    [authors, sortBy],
  );
  const selectedAuthor = useMemo(
    () =>
      selectedUsername
        ? rankedAuthors.find(
            (author) =>
              author.authorUsername.toLowerCase() ===
              selectedUsername.toLowerCase(),
          )
        : undefined,
    [rankedAuthors, selectedUsername],
  );
  const selectedAuthorPosts = useMemo(
    () =>
      buildAuthorPosts(activePosts, selectedUsername, postSortBy, profiles),
    [activePosts, postSortBy, profiles, selectedUsername],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredAuthors = useMemo(() => {
    if (!normalizedQuery) {
      return rankedAuthors;
    }

    return rankedAuthors.filter((author) =>
      `${author.authorName} ${author.authorUsername} ${author.topTag}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [normalizedQuery, rankedAuthors]);

  const totals = useMemo(() => {
    return authors.reduce(
      (summary, author) => ({
        posts: summary.posts + author.posts,
        views: summary.views + author.views,
        likes: summary.likes + author.likes,
        replies: summary.replies + author.replies,
        reposts: summary.reposts + author.reposts,
        quotes: summary.quotes + author.quotes,
        weightedEngagement:
          summary.weightedEngagement + author.weightedEngagement,
        score: summary.score + author.score,
        rawScore: summary.rawScore + author.rawScore,
        followerKnownPosts:
          summary.followerKnownPosts + (author.followers === null ? 0 : author.posts),
        eligibleAuthors:
          summary.eligibleAuthors + (author.eligible ? 1 : 0),
        riskAuthors:
          summary.riskAuthors + (author.riskFlags > 0 ? 1 : 0),
        redFlags: summary.redFlags + author.redFlags,
        yellowFlags: summary.yellowFlags + author.yellowFlags,
      }),
      {
        posts: 0,
        views: 0,
        likes: 0,
        replies: 0,
        reposts: 0,
        quotes: 0,
        weightedEngagement: 0,
        score: 0,
        rawScore: 0,
        followerKnownPosts: 0,
        eligibleAuthors: 0,
        riskAuthors: 0,
        redFlags: 0,
        yellowFlags: 0,
      },
    );
  }, [authors]);

  const topAuthor = rankedAuthors[0];
  const maxSignalScore = Math.max(
    0,
    ...rankedAuthors.map((author) => author.score),
  );
  const latestPostDate = useMemo(() => formatLatestDate(authors), [authors]);
  const followerCoverage =
    totals.posts > 0 ? (totals.followerKnownPosts / totals.posts) * 100 : 0;

  useEffect(() => {
    const syncFromHash = () => setSelectedUsername(getUsernameFromHash());

    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("popstate", syncFromHash);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("popstate", syncFromHash);
    };
  }, []);

  useEffect(() => {
    const syncBotFlags = (event: StorageEvent) => {
      if (event.key === BOT_FLAGS_STORAGE_KEY) {
        setBotFlags(readBotFlags());
      }
    };

    window.addEventListener("storage", syncBotFlags);
    return () => window.removeEventListener("storage", syncBotFlags);
  }, []);

  function selectAuthor(username: string) {
    const nextHash = `#u=${encodeURIComponent(username)}`;
    setSelectedUsername(username);
    window.history.pushState(null, "", nextHash);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearSelectedAuthor() {
    setSelectedUsername("");
    window.history.pushState(null, "", window.location.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changeSeason(season: PublicSeasonKey) {
    setActiveSeason(season);
    setSelectedUsername("");
    setQuery("");
    window.history.pushState(null, "", window.location.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="site-shell overflow-x-hidden text-foreground">
      {!selectedUsername && (
      <section className="relative overflow-hidden border-b border-white/40 bg-white/42">
        <div className="mx-auto flex max-w-7xl flex-col gap-9 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/renaiss-mark.png"
                alt=""
                className="h-8 w-7 rounded-sm object-cover"
              />
              <div>
                <p className="font-display text-lg font-black leading-none tracking-normal">
                  renaiss Protocol
                </p>
                <p className="text-sm font-semibold text-muted-foreground">
                  Campaign traction dashboard
                </p>
              </div>
            </div>

          </header>

          <div className="relative grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-end">
            <div className="taste-reveal min-w-0 max-w-4xl py-3 lg:py-10">
              <Badge variant="accent">{activeSeasonConfig.badge}</Badge>
              <h1 className="mt-6 max-w-full break-words font-display text-5xl font-black leading-[0.88] tracking-normal text-foreground sm:text-7xl lg:text-8xl">
                <span className="block">OUR</span>
                <span className="block">TRACTIONS</span>
              </h1>

              <p className="mt-3 max-w-full text-base font-semibold leading-7 text-muted-foreground sm:max-w-xl">
                {activeSeasonConfig.label} public community posts ranked by the
                Stage 4 formula, with eligibility and review flags visible for
                context.
              </p>
            </div>

            <div className="relative lg:min-h-[400px]">
              <PrismStage />
              <div className="glass-panel taste-reveal relative z-10 min-w-0 overflow-hidden rounded-md p-5 text-foreground [animation-delay:90ms] sm:ml-auto lg:mt-28">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      Top rank
                    </p>
                    <div className="mt-3 flex min-w-0 items-center gap-3">
                      {topAuthor ? (
                        <Avatar author={topAuthor} size="lg" />
                      ) : null}
                      <div className="min-w-0">
                        <h2 className="break-words font-display text-2xl font-black leading-none sm:text-3xl">
                          {topAuthor ? topAuthor.authorName : "Loading"}
                        </h2>
                        <p className="mt-2 text-sm font-semibold text-muted-foreground">
                          {topAuthor
                            ? `@${topAuthor.authorUsername}`
                            : "Reading CSV"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="glass-control glass-fill-orange grid h-16 w-16 shrink-0 place-items-center rounded-md">
                    <Trophy className="h-8 w-8" />
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <TopSignalMetric
                    label="Formula score"
                    value={formatScore(topAuthor?.score ?? 0)}
                  />
                  <TopSignalMetric
                    label="Views"
                    value={formatCompact(topAuthor?.views ?? 0)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {!selectedUsername && (
        <>
        <div className="glass-panel mb-5 rounded-md p-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.values(publicSeasons).map((season) => (
              <button
                key={season.key}
                type="button"
                onClick={() => changeSeason(season.key)}
                className={cn(
                  "flex min-h-12 flex-col items-start justify-center rounded-[5px] px-4 py-3 text-left transition-colors sm:min-h-14",
                  activeSeason === season.key
                    ? "glass-fill-primary"
                    : "text-muted-foreground hover:bg-white/24 hover:text-foreground",
                )}
              >
                <span className="text-sm font-black uppercase tracking-[0.12em]">
                  {season.label}
                </span>
                <span className="mt-1 text-xs font-bold">{season.fact}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Eye />}
            label="Total views"
            value={formatCompact(totals.views)}
          />
          <StatTile
            icon={<Heart />}
            label="Total likes"
            value={formatCompact(totals.likes)}
          />
          <StatTile
            icon={<Users />}
            label="Ranked authors"
            value={formatNumber(authors.length)}
          />
        </div>
        </>
        )}

        {isError ? (
          <div className="glass-panel mt-5 rounded-md p-4 text-sm font-semibold text-foreground">
            Failed to load{" "}
            <span className="font-black">{activeSeasonConfig.source}</span>.
          </div>
        ) : null}

        {selectedUsername ? (
          <AuthorDetail
            author={selectedAuthor}
            isLoading={isLoading}
            onBack={clearSelectedAuthor}
            posts={selectedAuthorPosts}
            postSortBy={postSortBy}
            setPostSortBy={setPostSortBy}
          />
        ) : (
          <>
            <div className="glass-panel taste-reveal mt-7 rounded-md p-4 [animation-delay:140ms]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    {activeSeasonConfig.label} users
                  </p>
                  <h2 className="mt-1 font-display text-3xl font-black tracking-normal">
                    Leaderboard
                  </h2>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search author or tag"
                      className="pl-9"
                    />
                  </div>

                  <div className="glass-control grid grid-cols-4 gap-1 rounded-md p-1">
                    {sortOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setSortBy(option.key)}
                        className={cn(
                          "h-11 rounded-[5px] px-3 text-xs font-extrabold uppercase tracking-[0.08em] transition-colors sm:h-10",
                          sortBy === option.key
                            ? "glass-fill-primary"
                            : "text-muted-foreground hover:bg-white/24 hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 border-t border-white/20 pt-4 text-sm font-semibold text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                <InlineFact
                  label="CSV posts"
                  value={formatNumber(totals.posts)}
                />
                <InlineFact label="Latest post" value={latestPostDate} />
                <InlineFact
                  label="Follower coverage"
                  value={`${followerCoverage.toFixed(0)}%`}
                />
              </div>
            </div>

            <div className="glass-panel taste-reveal mt-5 overflow-hidden rounded-md [animation-delay:180ms]">
              <div className="glass-row hidden grid-cols-[76px_minmax(260px,1fr)_160px_320px_96px] items-center border-b border-white/20 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground lg:grid">
                <span>Rank</span>
                <span>Author</span>
                <span className="text-right">{metricLabels[sortBy]}</span>
                <span className="text-right">Reach mix</span>
                <span className="text-right">Posts</span>
              </div>

              {isLoading ? (
                <div className="p-6 text-sm font-semibold text-muted-foreground">
                  Loading rankings...
                </div>
              ) : null}

              {!isLoading && filteredAuthors.length === 0 ? (
                <div className="p-6 text-sm font-semibold text-muted-foreground">
                  No authors matched that search.
                </div>
              ) : null}

              {!isLoading &&
                filteredAuthors.map((author) => (
                  <AuthorRow
                    key={author.authorUsername || author.authorName}
                    author={author}
                    sortBy={sortBy}
                    maxSignalScore={maxSignalScore}
                    onSelect={selectAuthor}
                  />
                ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function aggregateAuthors(
  posts: PostRow[],
  profiles: RenaissProfileMap,
): AuthorStat[] {
  const groupedPosts = new Map<string, PostRow[]>();
  const tagCounts = new Map<string, Map<string, number>>();

  for (const post of posts) {
    const username = post.author_username.trim();
    const authorName = post.author_name.trim() || username || "Unknown author";
    const key = username || authorName;
    const authorPosts = groupedPosts.get(key) ?? [];
    authorPosts.push(post);
    groupedPosts.set(key, authorPosts);

    const authorTags = tagCounts.get(key) ?? new Map<string, number>();
    for (const tag of post.hashtags
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)) {
      authorTags.set(tag, (authorTags.get(tag) ?? 0) + 1);
    }
    tagCounts.set(key, authorTags);
  }

  return [...groupedPosts.entries()].map(([key, authorPosts]) => {
    const sortedPosts = [...authorPosts].sort(
      (first, second) =>
        parsePostDate(first.created_at) - parsePostDate(second.created_at) ||
        first.id.localeCompare(second.id),
    );
    const profile = getRenaissProfile(
      profiles,
      sortedPosts.find((post) => post.author_username.trim())?.author_username ??
        key,
    );
    const eligibility = evaluateRenaissEligibility(profile);
    const followerCount = profile?.followers ?? null;
    const priorPosts = profile?.baselinePostsFound ?? null;
    const scoredPosts = sortedPosts.map((post, index) =>
      scorePublicPost(post, profile, index + 1),
    );
    const accountRisk = summarizeRenaissRiskFlags(
      scoredPosts.flatMap((post) => post.riskFlags),
    );
    const author = sortedPosts.reduce(
      (summary, post, index) => {
        const metrics = scoredPosts[index].metrics;
        const score = scoredPosts[index].score;
        const timestamp = parsePostDate(post.created_at);

        summary.posts += 1;
        summary.replies += metrics.replies;
        summary.reposts += metrics.reposts;
        summary.quotes += metrics.quotes;
        summary.likes += metrics.likes;
        summary.views += metrics.impressions;
        summary.weightedEngagement += metrics.weightedEngagement;
        summary.rawScore += score;
        summary.viewsLikesScore += metrics.impressions + metrics.likes;

        if (timestamp > summary.latestTimestamp) {
          summary.latestTimestamp = timestamp;
          summary.latestPostUrl = post.url;
        }

        return summary;
      },
      {
        authorName:
          sortedPosts.find((post) => post.author_name.trim())?.author_name.trim() ||
          sortedPosts[0]?.author_username.trim() ||
          "Unknown author",
        authorUsername:
          sortedPosts.find((post) => post.author_username.trim())?.author_username.trim() ||
          sortedPosts[0]?.author_name.trim() ||
          "Unknown author",
        latestPostUrl: sortedPosts[0]?.url ?? "",
        posts: 0,
        replies: 0,
        reposts: 0,
        quotes: 0,
        likes: 0,
        views: 0,
        score: 0,
        rawScore: 0,
        viewsLikesScore: 0,
        weightedEngagement: 0,
        followers: followerCount,
        priorPosts,
        eligibilityKnown: eligibility.known,
        eligible: eligibility.eligible,
        eligibilityReasons: eligibility.reasons,
        baselineWeMax: profile?.baselineWeMax ?? null,
        baselineImpMax: profile?.baselineImpMax ?? null,
        riskFlags: accountRisk.total,
        yellowFlags: accountRisk.yellow,
        redFlags: accountRisk.red,
        riskLevel: accountRisk.level,
        profile,
        latestTimestamp: 0,
        topTag: "Renaiss",
      },
    );
    const tags = [...(tagCounts.get(key)?.entries() ?? [])].sort(
      (a, b) => b[1] - a[1],
    );
    return {
      ...author,
      score: eligibility.eligible ? author.rawScore : 0,
      topTag: tags[0]?.[0] ?? author.topTag,
    };
  });
}

function rankAuthors(authors: AuthorStat[], sortBy: SortKey): RankedAuthor[] {
  return [...authors]
    .sort((first, second) => {
      const metricDelta = getMetric(second, sortBy) - getMetric(first, sortBy);

      return (
        metricDelta ||
        second.score - first.score ||
        second.views - first.views ||
        first.authorName.localeCompare(second.authorName)
      );
    })
    .map((author, index) => ({
      ...author,
      rank: index + 1,
    }));
}

function buildAuthorPosts(
  posts: PostRow[],
  username: string,
  sortBy: PostSortKey,
  profiles: RenaissProfileMap,
): AuthorPost[] {
  const normalizedUsername = username.trim().toLowerCase();
  const userPosts = posts.filter(
    (post) => post.author_username.trim().toLowerCase() === normalizedUsername,
  );
  const profile = getRenaissProfile(profiles, username);
  const lifetimeOrder = new Map<string, number>();

  [...userPosts]
    .sort(
      (first, second) =>
        parsePostDate(first.created_at) - parsePostDate(second.created_at) ||
        first.id.localeCompare(second.id),
    )
    .forEach((post, index) => {
      lifetimeOrder.set(post.id || post.url, index + 1);
    });

  return userPosts
    .map((post) => {
      const lifetimeIndex = lifetimeOrder.get(post.id || post.url) ?? 1;
      const scored = scorePublicPost(post, profile, lifetimeIndex);
      const riskSummary = summarizeRenaissRiskFlags(scored.riskFlags);

      return {
        id: post.id,
        url: post.url,
        description: post.description.trim(),
        createdAt: post.created_at,
        timestamp: parsePostDate(post.created_at),
        replies: scored.metrics.replies,
        reposts: scored.metrics.reposts,
        quotes: scored.metrics.quotes,
        bookmarks: scored.metrics.bookmarks,
        likes: scored.metrics.likes,
        views: scored.metrics.impressions,
        score: scored.score,
        rawScore: scored.score,
        viewsLikesScore: scored.metrics.impressions + scored.metrics.likes,
        weightedEngagement: scored.metrics.weightedEngagement,
        tier: scored.breakdown.tier,
        werPercent: scored.breakdown.werPercent,
        postCapFactor: scored.breakdown.postCapFactor,
        lifetimeIndex,
        riskFlags: scored.riskFlags,
        riskLevel: riskSummary.level,
        hashtags: post.hashtags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
    })
    .sort((first, second) => {
      if (sortBy === "views") {
        return second.views - first.views || second.timestamp - first.timestamp;
      }

      if (sortBy === "likes") {
        return second.likes - first.likes || second.timestamp - first.timestamp;
      }

      return second.timestamp - first.timestamp || second.score - first.score;
    });
}

function scorePublicPost(
  post: PostRow,
  profile: RenaissProfileSummary | null,
  lifetimeIndex: number,
) {
  const metrics = getRenaissPostMetrics(post);
  const breakdown = calculateRenaissStage4PostScore({
    metrics,
    followers: profile?.followers ?? null,
    lifetimeIndex,
  });
  const riskFlags = getRenaissRiskFlags(metrics, profile);

  return {
    metrics,
    breakdown,
    riskFlags,
    score: breakdown.score,
  };
}

function AuthorDetail({
  author,
  isLoading,
  onBack,
  posts,
  postSortBy,
  setPostSortBy,
}: {
  author: RankedAuthor | undefined;
  isLoading: boolean;
  onBack: () => void;
  posts: AuthorPost[];
  postSortBy: PostSortKey;
  setPostSortBy: (key: PostSortKey) => void;
}) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleDownload() {
    if (!author || isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      await downloadProofCard({
        name: author.authorName,
        handle: author.authorUsername,
        topTag: author.topTag,
        rank: author.rank,
        score: author.score,
        views: author.views,
        likes: author.likes,
        followers: author.followers,
        postsCount: author.posts,
        avatarUrl: getAvatarUrl(author.authorUsername),
        timestamps: posts.map((post) => post.timestamp),
      });
    } catch (error) {
      console.error("Failed to generate proof card", error);
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="glass-panel mt-7 rounded-md p-6 text-sm font-semibold text-muted-foreground">
        Loading author profile...
      </div>
    );
  }

  if (!author) {
    return (
      <div className="glass-panel mt-7 rounded-md p-6">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ArrowLeft />
          Back
        </Button>
        <p className="mt-6 text-sm font-semibold text-muted-foreground">
          This author was not found in the current CSV.
        </p>
      </div>
    );
  }

  const xProfileUrl = `https://x.com/${author.authorUsername}`;

  return (
    <div className="taste-reveal mt-7 space-y-5">
      <div className="glass-panel overflow-hidden rounded-md">
        <div className="flex flex-col gap-6 p-5 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:p-7">
          <div className="min-w-0">
            <Button type="button" variant="secondary" onClick={onBack}>
              <ArrowLeft />
              Back to leaderboard
            </Button>

            <div className="mt-7 flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end">
              <Avatar author={author} size="xl" />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Rank #{author.rank}
                </p>
                <h2 className="mt-2 break-words font-display text-4xl font-black leading-none tracking-normal sm:text-6xl">
                  {author.authorName}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-muted-foreground">
                  <span>@{author.authorUsername}</span>
                  <span>#{author.topTag}</span>
                  <span>{formatNumber(author.posts)} posts</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">Stage 4</Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 lg:items-end">
            <p className="font-display text-6xl font-black leading-none">
              #{author.rank}
            </p>
            <div className="flex flex-wrap gap-2 lg:flex-nowrap lg:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={handleDownload}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Download />
                )}
                {isExporting ? "Rendering" : "Download"}
              </Button>
              <Button asChild variant="default">
                <a href={xProfileUrl} target="_blank" rel="noreferrer">
                  Open X profile
                  <ArrowUpRight />
                </a>
              </Button>
            </div>
          </div>
        </div>

      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Trophy />}
          label="Final score"
          value={formatScore(author.score)}
        />
        <StatTile
          icon={<Eye />}
          label="Views"
          value={formatCompact(author.views)}
        />
        <StatTile
          icon={<Heart />}
          label="Likes"
          value={formatCompact(author.likes)}
        />
        <StatTile
          icon={<Users />}
          label="Followers"
          value={
            author.followers === null ? "—" : formatCompact(author.followers)
          }
        />
      </div>

      <div className="glass-panel rounded-md p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
              Author posts
            </p>
            <h3 className="mt-1 font-display text-4xl font-black tracking-normal">
              POSTS
            </h3>
          </div>

          <div className="glass-control grid grid-cols-3 gap-1 rounded-md p-1">
            {postSortOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPostSortBy(option.key)}
                className={cn(
                  "h-11 rounded-[5px] px-3 text-xs font-extrabold uppercase tracking-[0.08em] transition-colors sm:h-10",
                  postSortBy === option.key
                    ? "glass-fill-primary"
                    : "text-muted-foreground hover:bg-white/24 hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 border-t border-white/20 pt-5">
          <PostingHeatmap posts={posts} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {posts.map((post) => (
          <PostCard key={post.id || post.url} post={post} />
        ))}
      </div>
    </div>
  );
}

function PostCard({ post }: { post: AuthorPost }) {
  return (
    <article className="glass-panel flex min-h-[260px] flex-col rounded-md p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-muted-foreground">
            {formatPostDate(post.timestamp)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">Score {formatScore(post.score)}</Badge>
            {post.postCapFactor < 1 ? (
              <Badge variant="default">Cap 0.3x</Badge>
            ) : null}
            {post.hashtags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline">
                #{tag}
              </Badge>
            ))}
          </div>
        </div>
        <Button asChild variant="secondary" size="icon">
          <a href={post.url} target="_blank" rel="noreferrer" aria-label="Open post on X">
            <ArrowUpRight />
          </a>
        </Button>
      </div>

      <p className="mt-5 flex-1 text-base font-semibold leading-7 text-foreground/80">
        {post.description || "No post text available."}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/20 pt-4 sm:grid-cols-4">
        <MiniMetric icon={<Eye />} value={formatCompact(post.views)} />
        <MiniMetric icon={<Heart />} value={formatCompact(post.likes)} />
        <MiniMetric
          icon={<Repeat2 />}
          value={formatCompact(post.reposts + post.quotes)}
        />
        <MiniMetric icon={<MessageCircle />} value={formatCompact(post.replies)} />
      </div>

    </article>
  );
}

function AuthorRow({
  author,
  maxSignalScore,
  sortBy,
  onSelect,
}: {
  author: RankedAuthor;
  maxSignalScore: number;
  sortBy: SortKey;
  onSelect: (username: string) => void;
}) {
  const rankTone = getRankTone(author.rank);
  const scoreWidth =
    maxSignalScore > 0 ? Math.max(5, (author.score / maxSignalScore) * 100) : 0;
  const metricValue = getMetric(author, sortBy);

  return (
    <article className="glass-row grid gap-4 border-b border-white/20 px-4 py-4 last:border-b-0 lg:grid-cols-[76px_minmax(260px,1fr)_160px_320px_96px] lg:items-center">
      <div className="flex items-center justify-between gap-3 lg:block">
        <div
          className={cn(
            "grid h-12 w-12 place-items-center rounded-md border font-display text-xl font-black",
            "glass-control",
            rankTone,
          )}
        >
          {author.rank}
        </div>
        <Badge variant="outline" className="lg:hidden">
          {metricLabels[sortBy]}
        </Badge>
      </div>

      <div className="min-w-0">
        <button
          type="button"
          onClick={() => onSelect(author.authorUsername)}
          className="group flex min-w-0 items-center gap-3 text-left"
        >
          <Avatar author={author} />
          <div className="min-w-0">
            <span className="inline-flex max-w-full items-center gap-2 font-display text-xl font-black leading-tight group-hover:text-accent">
              <span className="truncate">{author.authorName}</span>
              <ArrowDownRight className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
          </div>
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-14 text-sm font-semibold text-muted-foreground">
          <span>@{author.authorUsername}</span>
          <span>#{author.topTag}</span>
          <a
            href={author.latestPostUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            Latest post
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="text-left lg:text-right">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          {metricLabels[sortBy]}
        </p>
        <p className="font-display text-2xl font-black">
          {sortBy === "score"
            ? formatScore(metricValue)
            : formatCompact(metricValue)}
        </p>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Raw {formatScore(author.rawScore)}
        </p>
      </div>

      <div className="space-y-2">
        <div className="glass-control h-2 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-orange"
            style={{ width: `${scoreWidth}%` }}
          />
        </div>
        <div className="grid grid-cols-4 gap-2 text-right text-xs font-bold text-muted-foreground">
          <MiniMetric icon={<Eye />} value={formatCompact(author.views)} />
          <MiniMetric icon={<Heart />} value={formatCompact(author.likes)} />
          <MiniMetric
            icon={<Repeat2 />}
            value={formatCompact(author.reposts + author.quotes)}
          />
          <MiniMetric
            icon={<MessageCircle />}
            value={formatCompact(author.replies)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 lg:justify-end">
        <div className="text-left lg:text-right">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
            Posts
          </p>
          <p className="font-display text-2xl font-black">{author.posts}</p>
        </div>
        <ArrowDownRight className="hidden h-4 w-4 text-muted-foreground lg:block" />
      </div>
    </article>
  );
}

function TopSignalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-control rounded-md p-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-black">{value}</p>
    </div>
  );
}

function PrismStage() {
  return (
    <div className="prism-stage hidden lg:block" aria-hidden="true">
      <div className="prism-ribbon" />
      <div className="prism-sheet" />
      <div className="prism-ring" />
      <div className="prism-orb" />
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-panel rounded-md p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <div className="glass-fill-orange grid h-9 w-9 place-items-center rounded-md [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </div>
      </div>
      <p className="mt-5 font-display text-4xl font-black leading-none tracking-normal">
        {value}
      </p>
    </div>
  );
}

function InlineFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-control flex items-center justify-between gap-3 rounded-md px-3 py-2">
      <span>{label}</span>
      <span className="font-black text-foreground">{value}</span>
    </div>
  );
}


function MiniMetric({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      <span>{value}</span>
    </div>
  );
}

function Avatar({
  author,
  size = "md",
}: {
  author: Pick<AuthorStat, "authorName" | "authorUsername">;
  size?: "md" | "lg" | "xl";
}) {
  const avatarUrl = getAvatarUrl(author.authorUsername);
  const sizeClass =
    size === "xl"
      ? "h-24 w-24 text-2xl"
      : size === "lg"
        ? "h-14 w-14 text-base"
        : "h-11 w-11 text-sm";

  return (
    <span
      className={cn(
        "glass-control relative grid shrink-0 place-items-center overflow-hidden rounded-md font-display font-black text-secondary-foreground",
        sizeClass,
      )}
    >
      <span>{getInitials(author.authorName)}</span>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          data-h={author.authorName}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </span>
  );
}

function getMetric(author: AuthorStat, sortBy: SortKey) {
  if (sortBy === "views") {
    return author.views;
  }

  if (sortBy === "likes") {
    return author.likes;
  }

  if (sortBy === "posts") {
    return author.posts;
  }

  return author.score;
}

function getRankTone(rank: number) {
  if (rank === 1) {
    return "glass-fill-orange";
  }

  if (rank === 2) {
    return "glass-fill-primary";
  }

  if (rank === 3) {
    return "glass-fill-orange-soft";
  }

  return "text-secondary-foreground";
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

function getAvatarUrl(username: string) {
  const handle = username.trim().replace(/^@/, "");

  return (
    (avatarMap as Record<string, string>)[handle] ??
    `https://unavatar.io/x/${encodeURIComponent(handle)}`
  );
}

function parsePostDate(value: string) {
  const timestamp = Date.parse(value.replace(/\s+·\s+/, " "));

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatLatestDate(authors: AuthorStat[]) {
  const latest = Math.max(
    0,
    ...authors.map((author) => author.latestTimestamp),
  );

  if (!latest) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(latest);
}

function formatPostDate(timestamp: number) {
  if (!timestamp) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function formatCompact(value: number) {
  return compactFormatter.format(Math.round(value));
}

function formatScore(value: number) {
  return numberFormatter.format(Number(value.toFixed(2)));
}


function getUsernameFromHash() {
  if (typeof window === "undefined") {
    return "";
  }

  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);

  return params.get("u") ?? "";
}
