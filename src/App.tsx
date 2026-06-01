import { type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Search,
  Share2,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import avatarMap from "./data/avatars.json";
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
  likes: string;
  views: string;
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
  latestTimestamp: number;
  topTag: string;
};

type RankedAuthor = AuthorStat & {
  rank: number;
};

type SortKey = "score" | "views" | "likes" | "posts";

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: "score", label: "V + L" },
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "posts", label: "Posts" },
];

const numberFormatter = new Intl.NumberFormat("en-US");
const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const metricLabels: Record<SortKey, string> = {
  score: "Views + likes",
  views: "Views",
  likes: "Likes",
  posts: "Posts",
};

async function loadPosts(): Promise<PostRow[]> {
  const res = await fetch("/renaiss_posts.csv");

  if (!res.ok) {
    throw new Error("CSV request failed");
  }

  return parseCsv(await res.text());
}

function parseCsv(text: string): PostRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  const headers =
    rows.shift()?.map((header) => header.replace(/^\uFEFF/, "")) ?? [];

  return rows
    .filter((cells) => cells.some((cell) => cell.trim() !== ""))
    .map(
      (cells) =>
        Object.fromEntries(
          headers.map((header, index) => [header, cells[index] ?? ""]),
        ) as PostRow,
    );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("score");

  const {
    data = [],
    isError,
    isLoading,
  } = useQuery({
    queryKey: ["renaiss-posts"],
    queryFn: loadPosts,
    staleTime: Infinity,
  });

  const authors = useMemo(() => aggregateAuthors(data), [data]);
  const rankedAuthors = useMemo(
    () => rankAuthors(authors, sortBy),
    [authors, sortBy],
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
        score: summary.score + author.score,
      }),
      {
        posts: 0,
        views: 0,
        likes: 0,
        replies: 0,
        reposts: 0,
        quotes: 0,
        score: 0,
      },
    );
  }, [authors]);

  const topAuthor = rankedAuthors[0];
  const maxSignalScore = Math.max(
    0,
    ...rankedAuthors.map((author) => author.score),
  );
  const totalEngagement =
    totals.likes + totals.replies + totals.reposts + totals.quotes;
  const engagementRate =
    totals.views > 0 ? (totalEngagement / totals.views) * 100 : 0;
  const latestPostDate = useMemo(() => formatLatestDate(authors), [authors]);
  const shareUrl = buildShareUrl(topAuthor, totals.views);

  return (
    <main className="min-h-screen overflow-x-hidden text-foreground">
      <section className="glass-panel border-b border-white/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="glass-control glass-fill-primary grid h-10 w-10 place-items-center rounded-md">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-lg font-black uppercase leading-none tracking-[0.04em]">
                  Renaiss Signal
                </p>
                <p className="text-sm font-semibold text-muted-foreground">
                  Author ranking from X posts
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <a href="/renaiss_posts.csv" download>
                  <Download />
                  CSV
                </a>
              </Button>
              <Button asChild variant="default" size="sm">
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  <Share2 />
                  Post
                </a>
              </Button>
            </div>
          </header>

          <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div className="min-w-0 max-w-4xl">
              <Badge variant="accent">Open beta buzz map</Badge>
              <h1 className="mt-5 max-w-full break-words font-display text-4xl font-black leading-[0.94] tracking-normal text-foreground sm:text-6xl lg:text-7xl">
                <span className="block sm:inline">Proof of Renaiss</span>{" "}
                <span className="block sm:inline">hype.</span>
              </h1>
              <p className="mt-5 max-w-full text-sm font-medium leading-7 text-muted-foreground sm:max-w-2xl sm:text-lg">
                A ranked view of the people carrying Renaiss across X, ordered
                by views plus likes with replies, reposts, and quotes shown as
                context.
              </p>
            </div>

            <div className="glass-panel min-w-0 overflow-hidden rounded-md p-5 text-foreground">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Top rank
                  </p>
                  <div className="mt-3 flex min-w-0 items-center gap-3">
                    {topAuthor ? <Avatar author={topAuthor} size="lg" /> : null}
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
                  label="Views + likes"
                  value={formatCompact(topAuthor?.score ?? 0)}
                />
                <TopSignalMetric
                  label="Views"
                  value={formatCompact(topAuthor?.views ?? 0)}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Eye />}
            label="Total views"
            value={formatCompact(totals.views)}
            tone="violet"
          />
          <StatTile
            icon={<Heart />}
            label="Total likes"
            value={formatCompact(totals.likes)}
            tone="coral"
          />
          <StatTile
            icon={<Users />}
            label="Ranked authors"
            value={formatNumber(authors.length)}
            tone="mint"
          />
          <StatTile
            icon={<MessageCircle />}
            label="Engagement rate"
            value={`${engagementRate.toFixed(2)}%`}
            tone="lemon"
          />
        </div>

        <div className="glass-panel mt-7 rounded-md p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Users
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
                      "h-9 rounded-[5px] px-3 text-xs font-extrabold uppercase tracking-[0.08em] transition-colors",
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

          <div className="mt-4 grid gap-3 border-t border-white/20 pt-4 text-sm font-semibold text-muted-foreground sm:grid-cols-3">
            <InlineFact label="CSV posts" value={formatNumber(totals.posts)} />
            <InlineFact label="Latest post" value={latestPostDate} />
            <InlineFact label="Sorted by" value={metricLabels[sortBy]} />
          </div>
        </div>

        {isError ? (
          <div className="glass-panel mt-5 rounded-md bg-coral/10 p-4 text-sm font-semibold text-foreground">
            Failed to load{" "}
            <span className="font-black">/renaiss_posts.csv</span>.
          </div>
        ) : null}

        <div className="glass-panel mt-5 overflow-hidden rounded-md">
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
              />
            ))}
        </div>
      </section>
    </main>
  );
}

function aggregateAuthors(posts: PostRow[]): AuthorStat[] {
  const authors = new Map<string, AuthorStat>();
  const tagCounts = new Map<string, Map<string, number>>();

  for (const post of posts) {
    const username = post.author_username.trim();
    const authorName = post.author_name.trim() || username || "Unknown author";
    const key = username || authorName;
    const existing = authors.get(key) ?? {
      authorName,
      authorUsername: username || authorName,
      latestPostUrl: post.url,
      posts: 0,
      replies: 0,
      reposts: 0,
      quotes: 0,
      likes: 0,
      views: 0,
      score: 0,
      latestTimestamp: 0,
      topTag: "Renaiss",
    };

    const replies = toNumber(post.replies);
    const reposts = toNumber(post.reposts);
    const quotes = toNumber(post.quotes);
    const likes = toNumber(post.likes);
    const views = toNumber(post.views);
    const rankScore = views + likes;
    const timestamp = parsePostDate(post.created_at);

    existing.posts += 1;
    existing.replies += replies;
    existing.reposts += reposts;
    existing.quotes += quotes;
    existing.likes += likes;
    existing.views += views;
    existing.score += rankScore;

    if (timestamp > existing.latestTimestamp) {
      existing.latestTimestamp = timestamp;
      existing.latestPostUrl = post.url;
    }

    const authorTags = tagCounts.get(key) ?? new Map<string, number>();
    for (const tag of post.hashtags
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)) {
      authorTags.set(tag, (authorTags.get(tag) ?? 0) + 1);
    }
    tagCounts.set(key, authorTags);
    authors.set(key, existing);
  }

  return [...authors.entries()].map(([key, author]) => {
    const tags = [...(tagCounts.get(key)?.entries() ?? [])].sort(
      (a, b) => b[1] - a[1],
    );
    return {
      ...author,
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

function AuthorRow({
  author,
  maxSignalScore,
  sortBy,
}: {
  author: RankedAuthor;
  maxSignalScore: number;
  sortBy: SortKey;
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
        <div className="flex min-w-0 items-center gap-3">
          <Avatar author={author} />
          <div className="min-w-0">
            <a
              href={author.latestPostUrl}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex max-w-full items-center gap-2 font-display text-xl font-black leading-tight hover:text-accent"
            >
              <span className="truncate">{author.authorName}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-muted-foreground">
              <span>@{author.authorUsername}</span>
              <span>#{author.topTag}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-left lg:text-right">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          {metricLabels[sortBy]}
        </p>
        <p className="font-display text-2xl font-black">
          {formatCompact(metricValue)}
        </p>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Views + likes {formatCompact(author.score)}
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

function StatTile({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode;
  label: string;
  tone: "violet" | "coral" | "mint" | "lemon";
  value: string;
}) {
  const toneClasses = {
    violet: "glass-fill-violet",
    coral: "glass-fill-coral",
    mint: "glass-fill-mint",
    lemon: "glass-fill-lemon",
  };

  return (
    <div className="glass-panel rounded-md p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <div
          className={cn(
            "grid h-9 w-9 place-items-center rounded-md [&_svg]:h-4 [&_svg]:w-4",
            toneClasses[tone],
          )}
        >
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
  size?: "md" | "lg";
}) {
  const avatarUrl = getAvatarUrl(author.authorUsername);

  return (
    <span
      className={cn(
        "glass-control relative grid shrink-0 place-items-center overflow-hidden rounded-md font-display font-black text-secondary-foreground",
        size === "lg" ? "h-14 w-14 text-base" : "h-11 w-11 text-sm",
      )}
    >
      <span>{getInitials(author.authorName)}</span>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          data-h={author.authorName}
          alt=""
          crossOrigin="anonymous"
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
    return "glass-fill-violet";
  }

  if (rank === 3) {
    return "glass-fill-mint";
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

  return (avatarMap as Record<string, string>)[handle] ?? "";
}

function toNumber(value: string | undefined) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();

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

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function formatCompact(value: number) {
  return compactFormatter.format(Math.round(value));
}

function buildShareUrl(
  topAuthor: RankedAuthor | undefined,
  totalViews: number,
) {
  const text = topAuthor
    ? `Proof of Renaiss : @${topAuthor.authorUsername} leads with ${formatCompact(topAuthor.views)} views. Total indexed views: ${formatCompact(totalViews)}.`
    : "Proof of Renaiss from public X posts.";

  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
