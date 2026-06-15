import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  Bot,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  Flag,
  Hand,
  Heart,
  MessageCircle,
  Repeat2,
  Search,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
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
  type RenaissPostMetrics,
  type RenaissPriorPostCsvRow,
  type RenaissProfileCsvRow,
  type RenaissProfileMap,
  type RenaissProfileSummary,
  type RenaissRiskFlag,
} from "./lib/renaissScoring";
import { isRenaissOfficialAccount } from "./lib/renaissOfficialAccounts";
import {
  type BotFlags,
  getBotFlagKey,
  readBotFlags,
  writeBotFlags,
} from "./lib/renaissBotFlags";
import {
  type HoldFlags,
  readHoldFlags,
  writeHoldFlags,
} from "./lib/renaissHoldFlags";
import { cn } from "./lib/utils";

type CsvRow = Record<string, string>;

type PostCsvRow = CsvRow & {
  id: string;
  url: string;
  description: string;
  author_name: string;
  author_username: string;
  created_at: string;
  replies: string;
  reposts: string;
  quotes: string;
  likes: string;
  views: string;
  hashtags: string;
  pictures: string;
};

type CampaignCsvRow = CsvRow & {
  "Renaiss Account": string;
  "Renaiss Wallet": string;
  "BinanceTH UID": string;
  Tickets: string;
  Eligible: string;
  Rewarded: string;
  "Tweet URL": string;
};

type TweetJson = {
  tweets?: TweetRecord[];
};

type TweetRecord = {
  id: string;
  url: string;
  text?: string;
  retweetCount?: number;
  replyCount?: number;
  likeCount?: number;
  quoteCount?: number;
  viewCount?: number;
  bookmarkCount?: number;
  createdAt?: string;
  author?: {
    userName?: string;
    name?: string;
    followers?: number;
    statusesCount?: number;
    profilePicture?: string;
  };
};

type AdminData = {
  season0Posts: PostCsvRow[];
  season1Posts: PostCsvRow[];
  campaignRows: CampaignCsvRow[];
  tweets: TweetRecord[];
  profiles: RenaissProfileMap;
};

type AdminTab = "season0" | "season1" | "campaigns";

type AdminSortKey =
  | "rank"
  | "score"
  | "review"
  | "bot"
  | "posts"
  | "impressions"
  | "name";

type AdminSortDirection = "asc" | "desc";

type SeasonConfig = {
  key: "season0" | "season1";
  label: string;
  source: string;
  startLabel: string;
};

type ScoredPost = {
  id: string;
  url: string;
  description: string;
  authorName: string;
  authorUsername: string;
  createdAt: string;
  timestamp: number;
  replies: number;
  reposts: number;
  quotes: number;
  bookmarks: number;
  likes: number;
  impressions: number;
  followers: number | null;
  priorPosts: number | null;
  profile: RenaissProfileSummary | null;
  metrics: RenaissPostMetrics;
  hashtags: string[];
  pictures: string[];
  lifetimeIndex: number;
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
  riskFlags: RenaissRiskFlag[];
  riskLevel: "clear" | "watch" | "high";
};

type RankedAdminAuthor = {
  key: string;
  flagKey: string;
  rank: number;
  authorName: string;
  authorUsername: string;
  posts: ScoredPost[];
  postCount: number;
  cappedPosts: number;
  replies: number;
  reposts: number;
  quotes: number;
  bookmarks: number;
  likes: number;
  impressions: number;
  weightedEngagement: number;
  rawScore: number;
  score: number;
  botFlagged: boolean;
  held: boolean;
  followers: number | null;
  priorPosts: number | null;
  profile: RenaissProfileSummary | null;
  baselineWeMax: number | null;
  baselineImpMax: number | null;
  baselineStatus: string;
  riskFlags: number;
  yellowFlags: number;
  redFlags: number;
  riskLevel: "clear" | "watch" | "high";
  eligibilityReasons: string[];
  eligibilityKnown: boolean;
  eligible: boolean;
  latestTimestamp: number;
  latestPostUrl: string;
  topTag: string;
  isOfficial: boolean;
};

type SeasonBoard = {
  config: SeasonConfig;
  authors: RankedAdminAuthor[];
  posts: ScoredPost[];
  totals: {
    accounts: number;
    posts: number;
    impressions: number;
    likes: number;
    weightedEngagement: number;
    score: number;
    flagged: number;
    eligible: number;
    riskAccounts: number;
    redFlags: number;
    yellowFlags: number;
    followerCoverage: number;
    cappedPosts: number;
  };
};

type CampaignParticipant = {
  id: string;
  flagKey: string;
  renaissAccount: string;
  renaissName: string;
  wallet: string;
  binanceUid: string;
  twitterHandle: string;
  tweetUrl: string;
  cards: boolean[];
  tickets: number;
  eligible: boolean;
  rewarded: boolean;
  rewardUsd: number;
  matchedTweet?: TweetRecord;
  botFlagged: boolean;
};

type CampaignBoard = {
  participants: CampaignParticipant[];
  totals: {
    participants: number;
    eligible: number;
    tickets: number;
    rewardUsd: number;
    rewarded: number;
    flagged: number;
  };
};


const DEFAULT_QUALITY_MULTIPLIER = 1;

const seasonConfigs: Record<"season0" | "season1", SeasonConfig> = {
  season0: {
    key: "season0",
    label: "Season 0",
    source: "/renaiss_season0.csv",
    startLabel: "Pre Jun 1, 2026 archive",
  },
  season1: {
    key: "season1",
    label: "Season 1",
    source: "/renaiss_mar_may_2026_combined.csv",
    startLabel: "Mar-May 2026 combined",
  },
};

const tabOptions: Array<{
  key: AdminTab;
  label: string;
  icon: ReactNode;
}> = [
  { key: "season0", label: "Season 0", icon: <Trophy /> },
  { key: "season1", label: "Season 1", icon: <CalendarRange /> },
  { key: "campaigns", label: "Campaigns", icon: <WalletCards /> },
];

const adminSortOptions: Array<{ key: AdminSortKey; label: string }> = [
  { key: "rank", label: "Rank" },
  { key: "score", label: "Score" },
  { key: "review", label: "Review flags" },
  { key: "bot", label: "Bot first" },
  { key: "posts", label: "Posts" },
  { key: "impressions", label: "Impressions" },
  { key: "name", label: "Name" },
];

const adminPageSize = 10;

const numberFormatter = new Intl.NumberFormat("en-US");
const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const scoreFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

async function loadAdminData(): Promise<AdminData> {
  const [
    season0Text,
    season1Text,
    campaignText,
    profileText,
    priorPostText,
    tweetPayload,
  ] =
    await Promise.all([
      loadText(seasonConfigs.season0.source),
      loadText(seasonConfigs.season1.source),
      loadText("/renaiss_th_Tier_C_Protection.csv"),
      loadText("/renaiss_profile_mar_may_2026.csv"),
      loadText("/renaiss_profile_mar_may_2026_prior_posts.csv"),
      loadOptionalJson<TweetJson>("/renaiss_tweet.json"),
    ]);
  const profileRows = parseCsv<RenaissProfileCsvRow>(profileText);
  const priorRows = parseCsv<RenaissPriorPostCsvRow>(priorPostText);

  return {
    season0Posts: parseCsv<PostCsvRow>(season0Text),
    season1Posts: parseCsv<PostCsvRow>(season1Text),
    campaignRows: parseCsv<CampaignCsvRow>(campaignText),
    tweets: tweetPayload?.tweets ?? [],
    profiles: createRenaissProfileMap(profileRows, priorRows),
  };
}

async function loadText(path: string) {
  const res = await fetch(path);

  if (!res.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  return res.text();
}

async function loadOptionalJson<T>(path: string): Promise<T | null> {
  const res = await fetch(path);

  if (!res.ok) {
    return null;
  }

  return res.json() as Promise<T>;
}

export default function AdminRenaissDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("season0");
  const [query, setQuery] = useState("");
  const [selectedAuthorKey, setSelectedAuthorKey] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [botFlags, setBotFlags] = useState<BotFlags>(() => readBotFlags());
  const [holdFlags, setHoldFlags] = useState<HoldFlags>(() => readHoldFlags());

  const {
    data,
    isError,
    isLoading,
  } = useQuery({
    queryKey: ["admin-renaiss-data"],
    queryFn: loadAdminData,
    staleTime: Infinity,
  });

  const season0Board = useMemo(
    () =>
      buildSeasonBoard(
        seasonConfigs.season0,
        data?.season0Posts ?? [],
        botFlags,
        holdFlags,
        data?.profiles,
      ),
    [botFlags, holdFlags, data?.profiles, data?.season0Posts],
  );
  const season1Board = useMemo(
    () =>
      buildSeasonBoard(
        seasonConfigs.season1,
        data?.season1Posts ?? [],
        botFlags,
        holdFlags,
        data?.profiles,
      ),
    [botFlags, holdFlags, data?.profiles, data?.season1Posts],
  );
  const campaignBoard = useMemo(
    () =>
      buildCampaignBoard(
        data?.campaignRows ?? [],
        data?.tweets ?? [],
        botFlags,
      ),
    [botFlags, data?.campaignRows, data?.tweets],
  );

  const activeSeason =
    activeTab === "season1" ? season1Board : season0Board;

  function selectTab(tab: AdminTab) {
    setActiveTab(tab);
    setQuery("");
    setSelectedAuthorKey("");
    setSelectedParticipantId("");
  }

  function toggleBotFlag(flagKey: string) {
    setBotFlags((current) => {
      const next = { ...current };

      if (next[flagKey]) {
        delete next[flagKey];
      } else {
        next[flagKey] = true;
      }

      writeBotFlags(next);
      return next;
    });
  }

  function toggleHold(flagKey: string) {
    setHoldFlags((current) => {
      const next = { ...current };

      if (next[flagKey]) {
        delete next[flagKey];
      } else {
        next[flagKey] = true;
      }

      writeHoldFlags(next);
      return next;
    });
  }

  return (
    <main className="site-shell min-h-screen overflow-x-hidden text-foreground">
      <section className="border-b border-white/40 bg-white/42">
        <div className="flex w-full flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 2xl:px-10">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src="/renaiss-mark.png"
                alt=""
                className="h-10 w-9 shrink-0 rounded-sm object-cover"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="accent">Admin</Badge>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Renaiss operations
                  </p>
                </div>
                <h1 className="mt-2 break-words font-display text-4xl font-black leading-none tracking-normal sm:text-5xl">
                  Renaiss Admin
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <a href="/">
                  <ArrowLeft />
                  Public
                </a>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <a href="/renaiss_season0.csv" download>
                  <Download />
                  Season 0 CSV
                </a>
              </Button>
              <Button asChild variant="default" size="sm">
                <a href={seasonConfigs.season1.source} download>
                  <Download />
                  Mar-May CSV
                </a>
              </Button>
            </div>
          </header>

          <div className="glass-panel rounded-md p-2">
            <div className="grid gap-2 sm:grid-cols-3">
              {tabOptions.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => selectTab(tab.key)}
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 rounded-[5px] px-3 text-sm font-black uppercase tracking-[0.08em] transition-colors [&_svg]:h-4 [&_svg]:w-4",
                    activeTab === tab.key
                      ? "glass-fill-primary"
                      : "text-muted-foreground hover:bg-white/24 hover:text-foreground",
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="w-full px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
        {isError ? (
          <div className="glass-panel rounded-md p-5 text-sm font-semibold text-foreground">
            Failed to load one or more Renaiss data files from
            <span className="font-black"> public/</span>.
          </div>
        ) : null}

        {activeTab === "campaigns" ? (
          <CampaignPanel
            board={campaignBoard}
            isLoading={isLoading}
            query={query}
            selectedParticipantId={selectedParticipantId}
            setQuery={setQuery}
            setSelectedParticipantId={setSelectedParticipantId}
            toggleBotFlag={toggleBotFlag}
          />
        ) : (
          <SeasonPanel
            board={activeSeason}
            isLoading={isLoading}
            query={query}
            selectedAuthorKey={selectedAuthorKey}
            setQuery={setQuery}
            setSelectedAuthorKey={setSelectedAuthorKey}
            toggleBotFlag={toggleBotFlag}
            toggleHold={toggleHold}
          />
        )}
      </section>
    </main>
  );
}

function SeasonPanel({
  board,
  isLoading,
  query,
  selectedAuthorKey,
  setQuery,
  setSelectedAuthorKey,
  toggleBotFlag,
  toggleHold,
}: {
  board: SeasonBoard;
  isLoading: boolean;
  query: string;
  selectedAuthorKey: string;
  setQuery: (value: string) => void;
  setSelectedAuthorKey: (value: string) => void;
  toggleBotFlag: (flagKey: string) => void;
  toggleHold: (flagKey: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<AdminSortKey>("rank");
  const [sortDirection, setSortDirection] =
    useState<AdminSortDirection>("asc");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredAuthors = useMemo(() => {
    if (!normalizedQuery) {
      return board.authors;
    }

    return board.authors.filter((author) =>
      [
        author.authorName,
        author.authorUsername,
        author.topTag,
        author.held ? "hold held" : "released",
        author.eligibilityKnown && !author.eligible ? "high risk" : "eligible",
        author.riskFlags > 0 ? "review flags risk" : "clear",
        author.botFlagged ? "bot flagged" : "clear",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [board.authors, normalizedQuery]);
  const sortedAuthors = useMemo(
    () => sortAdminAuthors(filteredAuthors, sortBy, sortDirection),
    [filteredAuthors, sortBy, sortDirection],
  );
  const pageCount = Math.max(1, Math.ceil(sortedAuthors.length / adminPageSize));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * adminPageSize;
  const pagedAuthors = sortedAuthors.slice(
    pageStart,
    pageStart + adminPageSize,
  );
  const pageEnd = Math.min(pageStart + adminPageSize, sortedAuthors.length);

  const selectedAuthor =
    pagedAuthors.find((author) => author.key === selectedAuthorKey) ??
    pagedAuthors[0] ??
    sortedAuthors[0] ??
    board.authors[0];

  useEffect(() => {
    setPage(1);
  }, [board.config.key, normalizedQuery, sortBy, sortDirection]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Trophy />}
          label={`${board.config.label} score`}
          value={formatScore(board.totals.score)}
        />
        <StatTile
          icon={<Users />}
          label="Eligible accounts"
          value={`${formatNumber(board.totals.eligible)} / ${formatNumber(
            board.totals.accounts,
          )}`}
        />
        <StatTile
          icon={<Flag />}
          label="Review flags"
          value={formatNumber(board.totals.riskAccounts)}
        />
        <StatTile
          icon={<Bot />}
          label="Bot flags"
          value={formatNumber(board.totals.flagged)}
        />
      </div>

      <div className="glass-panel rounded-md p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
              {board.config.startLabel}
            </p>
            <h2 className="mt-1 font-display text-3xl font-black tracking-normal">
              {board.config.label} Ranking
            </h2>
          </div>

          <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[680px] xl:min-w-[820px]">
            <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_190px_108px_190px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search account, tag, status"
                  className="pl-9"
                />
              </div>

              <select
                value={sortBy}
                onChange={(event) => {
                  const nextSort = event.target.value as AdminSortKey;
                  setSortBy(nextSort);
                  setSortDirection(
                    nextSort === "rank" || nextSort === "name" ? "asc" : "desc",
                  );
                }}
                className="glass-control h-11 rounded-md px-3 text-sm font-black text-foreground outline-none"
                aria-label="Sort accounts"
              >
                {adminSortOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setSortDirection((current) =>
                    current === "asc" ? "desc" : "asc",
                  )
                }
              >
                {sortDirection === "asc" ? "Asc" : "Desc"}
              </Button>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => downloadSeasonReviewCsv(board)}
              >
                <Download />
                Review CSV
              </Button>
            </div>
            <p className="text-xs font-bold text-muted-foreground">
              Showing {sortedAuthors.length === 0 ? 0 : pageStart + 1}-
              {pageEnd} of {formatNumber(sortedAuthors.length)} accounts · 10
              per page
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-white/20 pt-4 text-sm font-semibold text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
          <InlineFact label="CSV posts" value={formatNumber(board.totals.posts)} />
          <InlineFact
            label="Impressions"
            value={formatCompact(board.totals.impressions)}
          />
          <InlineFact
            label="Post cap hits"
            value={formatNumber(board.totals.cappedPosts)}
          />
          <InlineFact
            label="Follower coverage"
            value={`${board.totals.followerCoverage.toFixed(0)}%`}
          />
        </div>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.22fr)_minmax(420px,0.78fr)]">
        <div className="glass-panel min-w-0 overflow-hidden rounded-md">
          <div className="glass-row hidden grid-cols-[76px_minmax(0,1.7fr)_130px_150px_84px_196px] items-center gap-4 border-b border-white/20 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground lg:grid">
            <span>Rank</span>
            <span>Account</span>
            <span className="text-right">Score</span>
            <span className="text-right">WE / Imp</span>
            <span className="text-right">Posts</span>
            <span className="text-right">Review</span>
          </div>

          {isLoading ? (
            <div className="p-6 text-sm font-semibold text-muted-foreground">
              Loading admin rankings...
            </div>
          ) : null}

          {!isLoading && sortedAuthors.length === 0 ? (
            <div className="p-6 text-sm font-semibold text-muted-foreground">
              No accounts matched that search.
            </div>
          ) : null}

          {!isLoading &&
            pagedAuthors.map((author) => (
              <AdminAuthorRow
                key={author.key}
                author={author}
                selected={selectedAuthor?.key === author.key}
                onSelect={setSelectedAuthorKey}
                onToggleBot={toggleBotFlag}
                onToggleHold={toggleHold}
              />
            ))}

          {!isLoading && sortedAuthors.length > 0 ? (
            <div className="glass-row flex flex-col gap-3 px-5 py-4 text-sm font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Page {formatNumber(safePage)} of {formatNumber(pageCount)}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                >
                  <ChevronLeft />
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setPage((current) => Math.min(pageCount, current + 1))
                  }
                  disabled={safePage >= pageCount}
                >
                  Next
                  <ChevronRight />
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <AdminAuthorDetail
          author={selectedAuthor}
          isLoading={isLoading}
          onToggleBot={toggleBotFlag}
          onToggleHold={toggleHold}
        />
      </div>
    </div>
  );
}

function AdminAuthorRow({
  author,
  selected,
  onSelect,
  onToggleBot,
  onToggleHold,
}: {
  author: RankedAdminAuthor;
  selected: boolean;
  onSelect: (key: string) => void;
  onToggleBot: (flagKey: string) => void;
  onToggleHold: (flagKey: string) => void;
}) {
  return (
    <article
      className={cn(
        "glass-row grid min-w-0 gap-4 border-b border-white/20 px-4 py-4 last:border-b-0 sm:px-5 lg:grid-cols-[76px_minmax(0,1.7fr)_130px_150px_84px_196px] lg:items-center",
        selected && "bg-white/32",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(author.key)}
        className={cn(
          "grid h-12 w-12 place-items-center rounded-md border font-display text-lg font-black",
          "glass-control",
          getRankTone(author.rank),
        )}
        aria-label={`Open ${author.authorUsername}`}
      >
        {author.rank}
      </button>

      <div className="min-w-0">
        <button
          type="button"
          onClick={() => onSelect(author.key)}
          className="group flex w-full min-w-0 items-center gap-3 text-left"
        >
          <AdminAvatar
            name={author.authorName}
            username={author.authorUsername}
          />
          <div className="min-w-0 flex-1 overflow-hidden">
            <span className="block max-w-full truncate font-display text-xl font-black leading-tight group-hover:text-accent">
              {author.authorName}
            </span>
            <span className="mt-1 block max-w-full truncate text-sm font-semibold text-muted-foreground">
              @{author.authorUsername || "unknown"} · #{author.topTag}
            </span>
            {author.isOfficial ? (
              <span className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" className="shrink-0 gap-1 border-blue-400/60 text-blue-400">
                  Official
                </Badge>
              </span>
            ) : null}
            {author.riskFlags > 0 ? (
              <span className="mt-2 flex flex-wrap gap-2">
                <Badge
                  variant={author.redFlags > 0 ? "default" : "secondary"}
                  className="shrink-0"
                >
                  {author.riskFlags} flags
                </Badge>
              </span>
            ) : null}
          </div>
        </button>
      </div>

      <div className="text-left lg:text-right">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          Score
        </p>
        <p className="font-display text-2xl font-black">
          {formatScore(author.score)}
        </p>
        {author.botFlagged ? (
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            raw {formatScore(author.rawScore)}
          </p>
        ) : null}
      </div>

      <div className="text-left lg:text-right">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          WE / Imp
        </p>
        <p className="font-bold">
          {formatCompact(author.weightedEngagement)} /{" "}
          {formatCompact(author.impressions)}
        </p>
      </div>

      <div className="text-left lg:text-right">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          Posts
        </p>
        <p className="font-display text-2xl font-black">{author.postCount}</p>
      </div>

      <div className="flex items-center justify-between gap-2 lg:justify-end">
        <ReviewBadge
          flagged={author.botFlagged}
          held={author.held}
          eligible={author.eligible}
          eligibilityKnown={author.eligibilityKnown}
          redFlags={author.redFlags}
          riskFlags={author.riskFlags}
          ineligibleLabel="highRisk"
        />
        <HoldToggleButton
          held={author.held}
          onToggle={() => onToggleHold(author.flagKey)}
          username={author.authorUsername || author.authorName}
        />
        <button
          type="button"
          onClick={() => onToggleBot(author.flagKey)}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-md transition-colors",
            author.botFlagged
              ? "glass-fill-primary"
              : "glass-control text-muted-foreground hover:text-foreground",
          )}
          aria-label={
            author.botFlagged
              ? `Clear bot flag for ${author.authorUsername}`
              : `Flag ${author.authorUsername} as bot`
          }
        >
          <Flag className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function AdminAuthorDetail({
  author,
  isLoading,
  onToggleBot,
  onToggleHold,
}: {
  author: RankedAdminAuthor | undefined;
  isLoading: boolean;
  onToggleBot: (flagKey: string) => void;
  onToggleHold: (flagKey: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="glass-panel rounded-md p-6 text-sm font-semibold text-muted-foreground">
        Loading account detail...
      </div>
    );
  }

  if (!author) {
    return (
      <div className="glass-panel rounded-md p-6 text-sm font-semibold text-muted-foreground">
        No account selected.
      </div>
    );
  }

  const sortedPosts = [...author.posts].sort(
    (first, second) =>
      second.score - first.score || second.timestamp - first.timestamp,
  );
  const flaggedPosts = sortedPosts.filter((post) => post.riskFlags.length > 0);
  const xProfileUrl = author.authorUsername
    ? `https://x.com/${author.authorUsername}`
    : author.latestPostUrl;

  return (
    <aside className="space-y-4 2xl:sticky 2xl:top-5 2xl:self-start">
      <div className="glass-panel overflow-hidden rounded-md">
        <div className="border-b border-white/20 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <AdminAvatar
                name={author.authorName}
                username={author.authorUsername}
                size="lg"
              />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Rank #{author.rank}
                </p>
                <h3 className="mt-1 break-words font-display text-3xl font-black leading-none">
                  {author.authorName}
                </h3>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">
                  @{author.authorUsername || "unknown"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <HoldToggleButton
                held={author.held}
                onToggle={() => onToggleHold(author.flagKey)}
                username={author.authorUsername || author.authorName}
                size="lg"
              />
              <button
                type="button"
                onClick={() => onToggleBot(author.flagKey)}
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-md transition-colors",
                  author.botFlagged
                    ? "glass-fill-primary"
                    : "glass-control text-muted-foreground hover:text-foreground",
                )}
                aria-label="Toggle bot flag"
              >
                {author.botFlagged ? (
                  <Ban className="h-5 w-5" />
                ) : (
                  <Flag className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {author.isOfficial ? (
              <Badge variant="outline" className="gap-1 border-blue-400/60 text-blue-400">
                Official
              </Badge>
            ) : null}
            <Badge variant={author.held ? "default" : "outline"} className="gap-1">
              {author.held ? (
                <XCircle className="h-3.5 w-3.5" />
              ) : (
                <Hand className="h-3.5 w-3.5" />
              )}
              {author.held ? "On hold" : "Released"}
            </Badge>
            <Badge variant={author.botFlagged ? "default" : "outline"}>
              {author.botFlagged ? "Bot flagged" : "Clear"}
            </Badge>
            <Badge variant="secondary">
              {author.eligibilityKnown
                ? author.eligible
                  ? "Eligible"
                  : "High risk"
                : "Eligibility pending"}
            </Badge>
            <Badge variant={author.redFlags > 0 ? "default" : "outline"}>
              {author.riskFlags > 0
                ? `${author.riskFlags} review flags`
                : "No review flags"}
            </Badge>
            <Badge variant="outline">Quality 1.0</Badge>
          </div>
        </div>

        <div className="grid border-b border-white/20 sm:grid-cols-2">
          <ProfileMetric
            icon={<Trophy />}
            label="Final score"
            value={formatScore(author.score)}
          />
          <ProfileMetric
            icon={<Flag />}
            label="Review flags"
            value={formatNumber(author.riskFlags)}
          />
          <ProfileMetric
            icon={<Eye />}
            label="Impressions"
            value={formatCompact(author.impressions)}
          />
          <ProfileMetric
            icon={<Repeat2 />}
            label="Posts"
            value={formatNumber(author.postCount)}
          />
        </div>

        <div className="grid gap-3 p-4 text-sm font-semibold text-muted-foreground">
          <InlineFact
            label="Followers"
            value={author.followers === null ? "Missing" : formatNumber(author.followers)}
          />
          <InlineFact
            label="Prior posts"
            value={author.priorPosts === null ? "Missing" : formatNumber(author.priorPosts)}
          />
          <InlineFact
            label="Baseline max"
            value={`${formatCompact(author.baselineWeMax ?? 0)} WE / ${formatCompact(
              author.baselineImpMax ?? 0,
            )} views`}
          />
          <InlineFact
            label="Gate reason"
            value={author.eligibilityReasons[0] ?? "Eligible"}
          />
          <InlineFact
            label="Cap adjusted"
            value={formatNumber(author.cappedPosts)}
          />
          <InlineFact label="Top tag" value={`#${author.topTag}`} />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-white/20 p-4">
          <Button asChild variant="default" size="sm">
            <a href={xProfileUrl} target="_blank" rel="noreferrer">
              X profile
              <ArrowUpRight />
            </a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={author.latestPostUrl} target="_blank" rel="noreferrer">
              Latest post
              <ArrowUpRight />
            </a>
          </Button>
        </div>
      </div>

      {flaggedPosts.length > 0 ? (
        <div className="glass-panel rounded-md p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                Anti-cheat
              </p>
              <h4 className="mt-1 font-display text-2xl font-black">
                Review Queue
              </h4>
            </div>
            <Badge variant={author.redFlags > 0 ? "default" : "secondary"}>
              {formatNumber(flaggedPosts.length)} posts
            </Badge>
          </div>

          <div className="mt-4 grid gap-3">
            {flaggedPosts.slice(0, 5).map((post) => (
              <div
                key={`flag-${post.id || post.url}`}
                className="glass-control rounded-md p-3 text-sm font-semibold"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-black text-foreground">
                    {formatDate(post.timestamp)}
                  </p>
                  <Button asChild variant="secondary" size="icon">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open flagged post"
                    >
                      <ArrowUpRight />
                    </a>
                  </Button>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                  {post.riskFlags.slice(0, 3).map((flag) => (
                    <div key={`${post.id}-${flag.id}`}>
                      <span className="font-black text-foreground">
                        {flag.label}
                      </span>
                      <span> · {flag.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="glass-panel rounded-md p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
              Content
            </p>
            <h4 className="mt-1 font-display text-2xl font-black">
              Top Posts
            </h4>
          </div>
          <Badge variant="outline">{formatNumber(sortedPosts.length)} posts</Badge>
        </div>

        <div className="mt-4 grid gap-3">
          {sortedPosts.slice(0, 8).map((post) => (
            <AdminPostCard key={post.id || post.url} post={post} />
          ))}
        </div>
      </div>
    </aside>
  );
}

function CampaignPanel({
  board,
  isLoading,
  query,
  selectedParticipantId,
  setQuery,
  setSelectedParticipantId,
  toggleBotFlag,
}: {
  board: CampaignBoard;
  isLoading: boolean;
  query: string;
  selectedParticipantId: string;
  setQuery: (value: string) => void;
  setSelectedParticipantId: (value: string) => void;
  toggleBotFlag: (flagKey: string) => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredParticipants = useMemo(() => {
    if (!normalizedQuery) {
      return board.participants;
    }

    return board.participants.filter((participant) =>
      [
        participant.twitterHandle,
        participant.renaissName,
        participant.wallet,
        participant.binanceUid,
        participant.eligible ? "eligible" : "not eligible",
        participant.botFlagged ? "bot flagged" : "clear",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [board.participants, normalizedQuery]);

  const selectedParticipant =
    board.participants.find(
      (participant) => participant.id === selectedParticipantId,
    ) ??
    filteredParticipants[0] ??
    board.participants[0];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Users />}
          label="Participants"
          value={formatNumber(board.totals.participants)}
        />
        <StatTile
          icon={<CheckCircle2 />}
          label="Eligible"
          value={formatNumber(board.totals.eligible)}
        />
        <StatTile
          icon={<Ticket />}
          label="Tickets"
          value={formatNumber(board.totals.tickets)}
        />
        <StatTile
          icon={<CircleDollarSign />}
          label="Rewards"
          value={usdFormatter.format(board.totals.rewardUsd)}
        />
      </div>

      <div className="glass-panel rounded-md p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/renaiss-thai-mark.svg"
              alt=""
              className="h-12 w-12 shrink-0 rounded-md bg-white/55 p-2"
            />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                Campaign registry
              </p>
              <h2 className="mt-1 break-words font-display text-3xl font-black tracking-normal">
                Tier C Protection
              </h2>
            </div>
          </div>

          <div className="relative lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search handle, wallet, UID"
              className="pl-9"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-white/20 pt-4 text-sm font-semibold text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
          <InlineFact
            label="Rewarded"
            value={formatNumber(board.totals.rewarded)}
          />
          <InlineFact label="Bot flags" value={formatNumber(board.totals.flagged)} />
          <InlineFact label="Source rows" value={formatNumber(board.totals.participants)} />
          <InlineFact label="Campaign tweet" value="2062733991506259989" />
        </div>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)]">
        <div className="glass-panel min-w-0 overflow-hidden rounded-md">
          <div className="glass-row hidden grid-cols-[minmax(220px,1fr)_130px_120px_100px_110px_92px] items-center border-b border-white/20 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground lg:grid">
            <span>Participant</span>
            <span className="text-right">Cards</span>
            <span className="text-right">Tickets</span>
            <span className="text-right">Reward</span>
            <span className="text-right">Status</span>
            <span className="text-right">Review</span>
          </div>

          {isLoading ? (
            <div className="p-6 text-sm font-semibold text-muted-foreground">
              Loading campaign participants...
            </div>
          ) : null}

          {!isLoading && filteredParticipants.length === 0 ? (
            <div className="p-6 text-sm font-semibold text-muted-foreground">
              No participants matched that search.
            </div>
          ) : null}

          {!isLoading &&
            filteredParticipants.map((participant) => (
              <CampaignParticipantRow
                key={participant.id}
                participant={participant}
                selected={selectedParticipant?.id === participant.id}
                onSelect={setSelectedParticipantId}
                onToggleBot={toggleBotFlag}
              />
            ))}
        </div>

        <CampaignParticipantDetail
          participant={selectedParticipant}
          isLoading={isLoading}
          onToggleBot={toggleBotFlag}
        />
      </div>
    </div>
  );
}

function CampaignParticipantRow({
  participant,
  selected,
  onSelect,
  onToggleBot,
}: {
  participant: CampaignParticipant;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggleBot: (flagKey: string) => void;
}) {
  const cardCount = participant.cards.filter(Boolean).length;

  return (
    <article
      className={cn(
        "glass-row grid gap-4 border-b border-white/20 px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(220px,1fr)_130px_120px_100px_110px_92px] lg:items-center",
        selected && "bg-white/32",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(participant.id)}
        className="flex min-w-0 items-center gap-3 text-left"
      >
        <AdminAvatar
          name={participant.twitterHandle || participant.renaissName}
          username={participant.twitterHandle}
        />
        <span className="min-w-0">
          <span className="block truncate font-display text-xl font-black">
            @{participant.twitterHandle || "unknown"}
          </span>
          <span className="mt-1 block truncate text-sm font-semibold text-muted-foreground">
            {participant.renaissName || "No Renaiss account"}
          </span>
        </span>
      </button>

      <div className="text-left lg:text-right">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          Cards
        </p>
        <p className="font-bold">{cardCount} / 3</p>
      </div>

      <div className="text-left lg:text-right">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          Tickets
        </p>
        <p className="font-display text-2xl font-black">{participant.tickets}</p>
      </div>

      <div className="text-left lg:text-right">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          Reward
        </p>
        <p className="font-bold">{usdFormatter.format(participant.rewardUsd)}</p>
      </div>

      <div className="flex justify-start lg:justify-end">
        <Badge variant={participant.eligible ? "outline" : "default"}>
          {participant.eligible ? "Eligible" : "No"}
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-2 lg:justify-end">
        <ReviewBadge
          flagged={participant.botFlagged}
          eligible={participant.eligible}
          eligibilityKnown
        />
        <button
          type="button"
          onClick={() => onToggleBot(participant.flagKey)}
          className={cn(
            "grid h-10 w-10 place-items-center rounded-md transition-colors",
            participant.botFlagged
              ? "glass-fill-primary"
              : "glass-control text-muted-foreground hover:text-foreground",
          )}
          aria-label="Toggle campaign bot flag"
        >
          <Flag className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function CampaignParticipantDetail({
  participant,
  isLoading,
  onToggleBot,
}: {
  participant: CampaignParticipant | undefined;
  isLoading: boolean;
  onToggleBot: (flagKey: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="glass-panel rounded-md p-6 text-sm font-semibold text-muted-foreground">
        Loading participant detail...
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="glass-panel rounded-md p-6 text-sm font-semibold text-muted-foreground">
        No participant selected.
      </div>
    );
  }

  return (
    <aside className="space-y-4 2xl:sticky 2xl:top-5 2xl:self-start">
      <div className="glass-panel overflow-hidden rounded-md">
        <div className="border-b border-white/20 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <AdminAvatar
                name={participant.twitterHandle || participant.renaissName}
                username={participant.twitterHandle}
                size="lg"
              />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Campaign participant
                </p>
                <h3 className="mt-1 break-words font-display text-3xl font-black leading-none">
                  @{participant.twitterHandle || "unknown"}
                </h3>
                <p className="mt-2 break-words text-sm font-semibold text-muted-foreground">
                  {participant.renaissName || "No Renaiss profile"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onToggleBot(participant.flagKey)}
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-md transition-colors",
                participant.botFlagged
                  ? "glass-fill-primary"
                  : "glass-control text-muted-foreground hover:text-foreground",
              )}
              aria-label="Toggle bot flag"
            >
              {participant.botFlagged ? (
                <Ban className="h-5 w-5" />
              ) : (
                <Flag className="h-5 w-5" />
              )}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant={participant.eligible ? "outline" : "default"}>
              {participant.eligible ? "Eligible" : "Not eligible"}
            </Badge>
            <Badge variant={participant.rewarded ? "accent" : "secondary"}>
              {participant.rewarded ? "Rewarded" : "Not rewarded"}
            </Badge>
            <Badge variant={participant.botFlagged ? "default" : "outline"}>
              {participant.botFlagged ? "Bot flagged" : "Clear"}
            </Badge>
          </div>
        </div>

        <div className="grid border-b border-white/20 sm:grid-cols-2">
          <ProfileMetric
            icon={<Ticket />}
            label="Tickets"
            value={formatNumber(participant.tickets)}
          />
          <ProfileMetric
            icon={<CircleDollarSign />}
            label="Reward"
            value={usdFormatter.format(participant.rewardUsd)}
          />
          <ProfileMetric
            icon={<WalletCards />}
            label="Cards"
            value={`${participant.cards.filter(Boolean).length} / 3`}
          />
          <ProfileMetric
            icon={<ShieldCheck />}
            label="Status"
            value={participant.eligible ? "OK" : "Hold"}
          />
        </div>

        <div className="grid gap-3 p-4 text-sm font-semibold text-muted-foreground">
          <InlineFact label="Wallet" value={shortenWallet(participant.wallet)} />
          <InlineFact label="Binance UID" value={participant.binanceUid || "Missing"} />
          <InlineFact
            label="Card checks"
            value={participant.cards.map((card) => (card ? "Y" : "N")).join(" / ")}
          />
          <InlineFact
            label="Tweet metrics"
            value={
              participant.matchedTweet
                ? `${formatCompact(participant.matchedTweet.viewCount ?? 0)} views`
                : "Not in JSON"
            }
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-white/20 p-4">
          <Button asChild variant="default" size="sm">
            <a href={participant.tweetUrl} target="_blank" rel="noreferrer">
              Tweet
              <ArrowUpRight />
            </a>
          </Button>
          {participant.renaissAccount ? (
            <Button asChild variant="secondary" size="sm">
              <a
                href={participant.renaissAccount}
                target="_blank"
                rel="noreferrer"
              >
                Renaiss
                <ArrowUpRight />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {participant.matchedTweet?.text ? (
        <div className="glass-panel rounded-md p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
            Tweet text
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-foreground/80">
            {participant.matchedTweet.text}
          </p>
        </div>
      ) : null}
    </aside>
  );
}

function AdminPostCard({ post }: { post: ScoredPost }) {
  return (
    <article className="glass-control rounded-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            {formatDate(post.timestamp)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {post.riskFlags.length > 0 ? (
              <Badge variant={post.riskLevel === "high" ? "default" : "secondary"}>
                {post.riskFlags.length} flags
              </Badge>
            ) : null}
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
          <a href={post.url} target="_blank" rel="noreferrer" aria-label="Open post">
            <ArrowUpRight />
          </a>
        </Button>
      </div>

      <p className="mt-4 line-clamp-4 text-sm font-semibold leading-6 text-foreground/80">
        {post.description || "No post text available."}
      </p>

      {post.pictures.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {post.pictures.slice(0, 2).map((picture) => (
            <img
              key={picture}
              src={picture}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="aspect-[4/3] w-full rounded-md object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/20 pt-3 text-xs font-bold text-muted-foreground sm:grid-cols-4">
        <MiniMetric icon={<Trophy />} value={formatScore(post.score)} />
        <MiniMetric icon={<MessageCircle />} value={formatCompact(post.weightedEngagement)} />
        <MiniMetric icon={<Eye />} value={formatCompact(post.impressions)} />
        <MiniMetric icon={<Heart />} value={formatCompact(post.likes)} />
      </div>

      {post.riskFlags.length > 0 ? (
        <div className="mt-3 grid gap-1 text-xs font-semibold text-muted-foreground">
          {post.riskFlags.slice(0, 2).map((flag) => (
            <p key={`${post.id}-${flag.id}`}>
              <span className="font-black text-foreground">{flag.label}</span>
              <span> · {flag.detail}</span>
            </p>
          ))}
        </div>
      ) : null}
    </article>
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
      <p className="mt-5 break-words font-display text-4xl font-black leading-none tracking-normal">
        {value}
      </p>
    </div>
  );
}

function ProfileMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-white/20 p-5 last:border-b-0 sm:border-r sm:last:border-r-0 sm:[&:nth-child(2n)]:border-r-0">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
        <span className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-4 break-words font-display text-3xl font-black leading-none">
        {value}
      </p>
    </div>
  );
}

function InlineFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-control flex min-w-0 items-center justify-between gap-3 rounded-md px-3 py-2">
      <span className="shrink-0">{label}</span>
      <span className="min-w-0 break-words text-right font-black text-foreground">
        {value}
      </span>
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

type ReviewState = "bot" | "hold" | "highRisk" | "check" | "risk" | "flag" | "clear";

function resolveReviewState({
  flagged,
  held = false,
  eligible,
  eligibilityKnown,
  redFlags = 0,
  riskFlags = 0,
  ineligibleLabel = "hold",
}: {
  flagged: boolean;
  held?: boolean;
  eligible: boolean;
  eligibilityKnown: boolean;
  redFlags?: number;
  riskFlags?: number;
  ineligibleLabel?: "hold" | "highRisk";
}): ReviewState {
  if (flagged) return "bot";
  if (held) return "hold";
  if (eligibilityKnown && !eligible) {
    return ineligibleLabel === "highRisk" ? "highRisk" : "hold";
  }
  if (!eligibilityKnown) return "check";
  if (riskFlags > 0) return redFlags > 0 ? "risk" : "flag";
  return "clear";
}

const reviewStateMeta: Record<
  ReviewState,
  { label: string; variant: "default" | "secondary" | "outline"; icon: ReactNode }
> = {
  bot: { label: "Bot", variant: "default", icon: <Bot className="h-3.5 w-3.5" /> },
  hold: { label: "Hold", variant: "default", icon: <XCircle className="h-3.5 w-3.5" /> },
  highRisk: {
    label: "High Risk",
    variant: "secondary",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  check: { label: "Check", variant: "secondary", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  risk: { label: "Risk", variant: "default", icon: <Flag className="h-3.5 w-3.5" /> },
  flag: { label: "Flag", variant: "secondary", icon: <Flag className="h-3.5 w-3.5" /> },
  clear: { label: "Clear", variant: "outline", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
};

function ReviewBadge(props: {
  flagged: boolean;
  held?: boolean;
  eligible: boolean;
  eligibilityKnown: boolean;
  redFlags?: number;
  riskFlags?: number;
  ineligibleLabel?: "hold" | "highRisk";
}) {
  const meta = reviewStateMeta[resolveReviewState(props)];

  return (
    <Badge variant={meta.variant} className="gap-1">
      {meta.icon}
      {meta.label}
    </Badge>
  );
}

function HoldToggleButton({
  held,
  onToggle,
  username,
  size = "sm",
}: {
  held: boolean;
  onToggle: () => void;
  username: string;
  size?: "sm" | "lg";
}) {
  const sizeClass = size === "lg" ? "h-11 w-11" : "h-10 w-10";
  const iconClass = size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "grid shrink-0 place-items-center rounded-md transition-colors",
        sizeClass,
        held
          ? "glass-fill-primary"
          : "glass-control text-muted-foreground hover:text-foreground",
      )}
      aria-label={held ? `Release hold on ${username}` : `Hold ${username}`}
      title={held ? "Release hold" : "Hold account"}
    >
      <Hand className={iconClass} />
    </button>
  );
}

function AdminAvatar({
  name,
  username,
  size = "md",
}: {
  name: string;
  username: string;
  size?: "md" | "lg";
}) {
  const avatarUrl = getAvatarUrl(username);
  const sizeClass = size === "lg" ? "h-16 w-16 text-lg" : "h-11 w-11 text-sm";

  return (
    <span
      className={cn(
        "glass-control relative grid shrink-0 place-items-center overflow-hidden rounded-md font-display font-black text-secondary-foreground",
        sizeClass,
      )}
    >
      <span>{getInitials(name || username)}</span>
      {avatarUrl ? (
        <img
          src={avatarUrl}
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

function sortAdminAuthors(
  authors: RankedAdminAuthor[],
  sortBy: AdminSortKey,
  direction: AdminSortDirection,
) {
  const modifier = direction === "asc" ? 1 : -1;

  return [...authors].sort((first, second) => {
    if (sortBy === "name") {
      return (
        first.authorName.localeCompare(second.authorName) * modifier ||
        first.rank - second.rank
      );
    }

    if (sortBy === "rank") {
      return (first.rank - second.rank) * modifier;
    }

    const firstValue = getAdminSortValue(first, sortBy);
    const secondValue = getAdminSortValue(second, sortBy);

    return (
      (firstValue - secondValue) * modifier ||
      first.rank - second.rank ||
      first.authorName.localeCompare(second.authorName)
    );
  });
}

function getAdminSortValue(author: RankedAdminAuthor, sortBy: AdminSortKey) {
  if (sortBy === "score") {
    return author.score;
  }

  if (sortBy === "review") {
    return author.redFlags * 1_000 + author.riskFlags;
  }

  if (sortBy === "bot") {
    return author.botFlagged ? 1 : 0;
  }

  if (sortBy === "posts") {
    return author.postCount;
  }

  if (sortBy === "impressions") {
    return author.impressions;
  }

  return author.rank;
}

function downloadSeasonReviewCsv(board: SeasonBoard) {
  const headers = [
    "rank",
    "author_username",
    "author_name",
    "final_score",
    "raw_score",
    "eligible",
    "eligibility_status",
    "followers",
    "prior_posts",
    "post_count",
    "weighted_engagement",
    "impressions",
    "likes",
    "review_flags",
    "red_flags",
    "yellow_flags",
    "latest_post_url",
    "bot_flag",
    "hold",
    "review_state",
  ];
  const rows = board.authors.map((author) => [
    author.rank,
    author.authorUsername,
    author.authorName,
    formatScore(author.score),
    formatScore(author.rawScore),
    author.eligible ? "TRUE" : "FALSE",
    author.eligibilityReasons[0] ?? "Eligible",
    author.followers ?? "",
    author.priorPosts ?? "",
    author.postCount,
    author.weightedEngagement,
    author.impressions,
    author.likes,
    author.riskFlags,
    author.redFlags,
    author.yellowFlags,
    author.latestPostUrl,
    author.botFlagged ? "TRUE" : "FALSE",
    author.held ? "TRUE" : "FALSE",
    reviewStateMeta[
      resolveReviewState({
        flagged: author.botFlagged,
        held: author.held,
        eligible: author.eligible,
        eligibilityKnown: author.eligibilityKnown,
        redFlags: author.redFlags,
        riskFlags: author.riskFlags,
        ineligibleLabel: "highRisk",
      })
    ].label,
  ]);

  downloadCsv(
    toCsv(headers, rows),
    `renaiss_${board.config.key}_admin_review.csv`,
  );
}

function toCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>,
) {
  return [headers, ...rows]
    .map((row) => row.map(formatCsvCell).join(","))
    .join("\n");
}

function formatCsvCell(value: string | number | boolean | null | undefined) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildSeasonBoard(
  config: SeasonConfig,
  rows: PostCsvRow[],
  botFlags: BotFlags,
  holdFlags: HoldFlags,
  profiles: RenaissProfileMap = new Map(),
): SeasonBoard {
  const normalizedPosts = rows.map((row) => normalizePostRow(row, profiles));
  const groupedPosts = new Map<string, ScoredPost[]>();
  const tagCounts = new Map<string, Map<string, number>>();

  for (const post of normalizedPosts) {
    const key = getAuthorKey(post.authorUsername, post.authorName);
    const posts = groupedPosts.get(key) ?? [];
    posts.push(post);
    groupedPosts.set(key, posts);

    const authorTags = tagCounts.get(key) ?? new Map<string, number>();
    for (const tag of post.hashtags) {
      authorTags.set(tag, (authorTags.get(tag) ?? 0) + 1);
    }
    tagCounts.set(key, authorTags);
  }

  const authors = [...groupedPosts.entries()].map(([key, posts]) => {
    const sortedByTime = [...posts].sort(
      (first, second) =>
        first.timestamp - second.timestamp || first.id.localeCompare(second.id),
    );
    const authorName =
      sortedByTime.find((post) => post.authorName)?.authorName ??
      sortedByTime[0]?.authorName ??
      "Unknown author";
    const authorUsername =
      sortedByTime.find((post) => post.authorUsername)?.authorUsername ??
      sortedByTime[0]?.authorUsername ??
      "";
    const profile =
      getRenaissProfile(profiles, authorUsername) ??
      sortedByTime.find((post) => post.profile)?.profile ??
      null;
    const eligibility = evaluateRenaissEligibility(profile);
    const followers = profile?.followers ?? null;
    const priorPosts = profile?.baselinePostsFound ?? null;
    const scoredPosts = sortedByTime.map((post, index) =>
      scorePost({
        ...post,
        followers,
        priorPosts,
        profile,
        lifetimeIndex: index + 1,
      }),
    );
    const latestPost = scoredPosts.reduce(
      (latest, post) => (post.timestamp > latest.timestamp ? post : latest),
      scoredPosts[0],
    );
    const rawScore = scoredPosts.reduce((sum, post) => sum + post.score, 0);
    const riskSummary = summarizeRenaissRiskFlags(
      scoredPosts.flatMap((post) => post.riskFlags),
    );
    const flagKey = getBotFlagKey(authorUsername || authorName);
    const botFlagged = Boolean(botFlags[flagKey]);
    const held = Boolean(holdFlags[flagKey]);
    // Eligibility no longer auto-zeros the score — ineligible accounts surface as
    // "High risk" instead. Only a bot flag or an explicit admin hold removes score.
    const accountFactor = botFlagged || held ? 0 : 1;
    const tags = [...(tagCounts.get(key)?.entries() ?? [])].sort(
      (first, second) => second[1] - first[1],
    );

    return {
      key,
      flagKey,
      rank: 0,
      authorName,
      authorUsername,
      posts: scoredPosts.sort(
        (first, second) => second.timestamp - first.timestamp,
      ),
      postCount: scoredPosts.length,
      cappedPosts: scoredPosts.filter((post) => post.postCapFactor < 1).length,
      replies: sumBy(scoredPosts, "replies"),
      reposts: sumBy(scoredPosts, "reposts"),
      quotes: sumBy(scoredPosts, "quotes"),
      bookmarks: sumBy(scoredPosts, "bookmarks"),
      likes: sumBy(scoredPosts, "likes"),
      impressions: sumBy(scoredPosts, "impressions"),
      weightedEngagement: sumBy(scoredPosts, "weightedEngagement"),
      rawScore,
      score: rawScore * accountFactor,
      botFlagged,
      held,
      followers,
      priorPosts,
      profile,
      baselineWeMax: profile?.baselineWeMax ?? null,
      baselineImpMax: profile?.baselineImpMax ?? null,
      baselineStatus: profile?.baselineStatus ?? "missing",
      riskFlags: riskSummary.total,
      yellowFlags: riskSummary.yellow,
      redFlags: riskSummary.red,
      riskLevel: riskSummary.level,
      eligibilityReasons: eligibility.reasons,
      eligibilityKnown: eligibility.known,
      eligible: eligibility.eligible,
      latestTimestamp: latestPost?.timestamp ?? 0,
      latestPostUrl: latestPost?.url ?? "",
      topTag: tags[0]?.[0] ?? "Renaiss",
      isOfficial: isRenaissOfficialAccount(authorUsername),
    };
  });

  const rankedAuthors = authors
    .sort(
      (first, second) =>
        second.score - first.score ||
        second.rawScore - first.rawScore ||
        second.impressions - first.impressions ||
        first.authorName.localeCompare(second.authorName),
    )
    .map((author, index) => ({
      ...author,
      rank: index + 1,
    }));

  const followerKnownPosts = normalizedPosts.filter(
    (post) => post.followers !== null,
  ).length;

  return {
    config,
    authors: rankedAuthors,
    posts: normalizedPosts,
    totals: {
      accounts: rankedAuthors.length,
      posts: normalizedPosts.length,
      impressions: sumBy(normalizedPosts, "impressions"),
      likes: sumBy(normalizedPosts, "likes"),
      weightedEngagement: sumBy(normalizedPosts, "weightedEngagement"),
      score: rankedAuthors.reduce((sum, author) => sum + author.score, 0),
      flagged: rankedAuthors.filter((author) => author.botFlagged).length,
      eligible: rankedAuthors.filter((author) => author.eligible).length,
      riskAccounts: rankedAuthors.filter((author) => author.riskFlags > 0)
        .length,
      redFlags: rankedAuthors.reduce((sum, author) => sum + author.redFlags, 0),
      yellowFlags: rankedAuthors.reduce(
        (sum, author) => sum + author.yellowFlags,
        0,
      ),
      followerCoverage:
        normalizedPosts.length > 0
          ? (followerKnownPosts / normalizedPosts.length) * 100
          : 0,
      cappedPosts: rankedAuthors.reduce(
        (sum, author) => sum + author.cappedPosts,
        0,
      ),
    },
  };
}

function normalizePostRow(
  row: PostCsvRow,
  profiles: RenaissProfileMap,
): ScoredPost {
  const metrics = getRenaissPostMetrics(row);
  const profile = getRenaissProfile(profiles, row.author_username);
  const followers = profile?.followers ?? null;
  const priorPosts = profile?.baselinePostsFound ?? null;

  return scorePost({
    id: row.id,
    url: row.url,
    description: row.description?.trim() ?? "",
    authorName: row.author_name?.trim() || row.author_username?.trim() || "Unknown author",
    authorUsername: row.author_username?.trim() ?? "",
    createdAt: row.created_at,
    timestamp: parsePostDate(row.created_at),
    replies: metrics.replies,
    reposts: metrics.reposts,
    quotes: metrics.quotes,
    bookmarks: metrics.bookmarks,
    likes: metrics.likes,
    impressions: metrics.impressions,
    followers,
    priorPosts,
    profile,
    metrics,
    hashtags: splitCsvList(row.hashtags),
    pictures: splitCsvList(row.pictures),
    lifetimeIndex: 1,
    tier: 0,
    weightedEngagement: 0,
    werPercent: 0,
    tierNorm: 0,
    werNorm: 0,
    scaleNorm: 0,
    impressionNorm: 0,
    baseScore: 0,
    qualityMultiplier: DEFAULT_QUALITY_MULTIPLIER,
    postCapFactor: 1,
    score: 0,
    riskFlags: [],
    riskLevel: "clear",
  });
}

function scorePost(post: ScoredPost): ScoredPost {
  const metrics = getRenaissPostMetrics(post);
  const breakdown = calculateRenaissStage4PostScore({
    metrics,
    followers: post.followers,
    lifetimeIndex: post.lifetimeIndex,
    qualityMultiplier: DEFAULT_QUALITY_MULTIPLIER,
  });
  const riskFlags = getRenaissRiskFlags(metrics, post.profile);
  const riskSummary = summarizeRenaissRiskFlags(riskFlags);

  return {
    ...post,
    metrics,
    tier: breakdown.tier,
    weightedEngagement: breakdown.weightedEngagement,
    werPercent: breakdown.werPercent,
    tierNorm: breakdown.tierNorm,
    werNorm: breakdown.werNorm,
    scaleNorm: breakdown.scaleNorm,
    impressionNorm: breakdown.impressionNorm,
    baseScore: breakdown.baseScore,
    qualityMultiplier: breakdown.qualityMultiplier,
    postCapFactor: breakdown.postCapFactor,
    score: breakdown.score,
    riskFlags,
    riskLevel: riskSummary.level,
  };
}

function buildCampaignBoard(
  rows: CampaignCsvRow[],
  tweets: TweetRecord[],
  botFlags: BotFlags,
): CampaignBoard {
  const tweetById = new Map(tweets.map((tweet) => [tweet.id, tweet]));
  const tweetByUrl = new Map(tweets.map((tweet) => [tweet.url, tweet]));
  const participants = rows
    .map((row, index) => {
      const tweetUrl = row["Tweet URL"] ?? "";
      const tweetId = extractTweetId(tweetUrl);
      const matchedTweet =
        tweetByUrl.get(tweetUrl) ?? (tweetId ? tweetById.get(tweetId) : undefined);
      const twitterHandle =
        extractTwitterHandle(tweetUrl) ??
        matchedTweet?.author?.userName ??
        "";
      const renaissAccount = row["Renaiss Account"] ?? "";
      const renaissName = extractLastPathPart(renaissAccount);
      const wallet = row["Renaiss Wallet"] ?? "";
      const flagKey = getBotFlagKey(twitterHandle || wallet || renaissName);
      const participant: CampaignParticipant = {
        id: wallet || tweetUrl || String(index),
        flagKey,
        renaissAccount,
        renaissName,
        wallet,
        binanceUid: row["BinanceTH UID"] ?? "",
        twitterHandle,
        tweetUrl,
        cards: [
          toBoolean(getCardValue(row, 1)),
          toBoolean(getCardValue(row, 2)),
          toBoolean(getCardValue(row, 3)),
        ],
        tickets: toNumber(row.Tickets),
        eligible: toBoolean(row.Eligible),
        rewarded: toBoolean(row.Rewarded),
        rewardUsd: toMoney(getRewardValue(row)),
        matchedTweet,
        botFlagged: Boolean(botFlags[flagKey]),
      };

      return participant;
    })
    .sort(
      (first, second) =>
        Number(second.eligible) - Number(first.eligible) ||
        second.tickets - first.tickets ||
        first.twitterHandle.localeCompare(second.twitterHandle),
    );

  return {
    participants,
    totals: {
      participants: participants.length,
      eligible: participants.filter((participant) => participant.eligible).length,
      tickets: participants.reduce(
        (sum, participant) => sum + participant.tickets,
        0,
      ),
      rewardUsd: participants.reduce(
        (sum, participant) => sum + participant.rewardUsd,
        0,
      ),
      rewarded: participants.filter((participant) => participant.rewarded).length,
      flagged: participants.filter((participant) => participant.botFlagged).length,
    },
  };
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

function getCardValue(row: CsvRow, cardNumber: number) {
  const key = Object.keys(row).find((rowKey) =>
    rowKey.toLowerCase().startsWith(`card ${cardNumber}`),
  );

  return key ? row[key] : "";
}

function getRewardValue(row: CsvRow) {
  const keys = Object.keys(row);
  const key =
    keys.find((rowKey) => rowKey.toLowerCase().includes("($)")) ??
    keys.find((rowKey) => rowKey.toLowerCase().includes("amount")) ??
    keys.find((rowKey) => rowKey.toLowerCase().includes("share")) ??
    keys.find((rowKey) => {
      const normalized = rowKey.toLowerCase();
      return normalized.includes("reward") && normalized !== "rewarded";
    });

  return key ? row[key] : "";
}

function splitCsvList(value: string | undefined) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toBoolean(value: string | undefined) {
  return String(value ?? "").trim().toLowerCase() === "true";
}

function toMoney(value: string | undefined) {
  return toNumber(value);
}

function toNumber(value: string | number | undefined | null) {
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

function sumBy<T extends Record<K, number>, K extends keyof T>(
  rows: T[],
  key: K,
) {
  return rows.reduce((sum, row) => sum + row[key], 0);
}

function parsePostDate(value: string | undefined) {
  const timestamp = Date.parse(String(value ?? "").replace(/\s+·\s+/, " "));

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatDate(timestamp: number) {
  if (!timestamp) {
    return "Unknown";
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
  return scoreFormatter.format(value);
}

function shortenWallet(value: string) {
  if (value.length <= 14) {
    return value || "Missing";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function extractTweetId(url: string) {
  return url.match(/status\/(\d+)/)?.[1] ?? "";
}

function extractTwitterHandle(url: string) {
  return url.match(/x\.com\/([^/?#]+)/i)?.[1] ?? "";
}

function extractLastPathPart(url: string) {
  const match = url.match(/\/([^/?#]+)\/?$/);
  return match?.[1] ?? "";
}

function getAuthorKey(username: string, name: string) {
  return (username || name || "unknown").trim().toLowerCase();
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

  if (!handle) {
    return "";
  }

  return (
    (avatarMap as Record<string, string>)[handle] ??
    `https://unavatar.io/x/${encodeURIComponent(handle)}`
  );
}
