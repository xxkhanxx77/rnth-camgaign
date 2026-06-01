import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
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
  likes: number;
  views: number;
  score: number;
  hashtags: string[];
};

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: "score", label: "V + L" },
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
  const [postSortBy, setPostSortBy] = useState<PostSortKey>("latest");
  const [selectedUsername, setSelectedUsername] = useState(() =>
    getUsernameFromHash(),
  );

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
    () => buildAuthorPosts(data, selectedUsername, postSortBy),
    [data, postSortBy, selectedUsername],
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

  useEffect(() => {
    const syncFromHash = () => setSelectedUsername(getUsernameFromHash());

    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("popstate", syncFromHash);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("popstate", syncFromHash);
    };
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

  return (
    <main className="site-shell overflow-x-hidden text-foreground">
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

          <div className="relative grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-end">
            <div className="taste-reveal min-w-0 max-w-4xl py-3 lg:py-10">
              <Badge variant="accent">Open beta buzz map</Badge>
              <h1 className="mt-6 max-w-full break-words font-display text-5xl font-black leading-[0.88] tracking-normal text-foreground sm:text-7xl lg:text-8xl">
                <span className="block">OUR</span>
                <span className="block">TRACTIONS</span>
              </h1>

              <p className="mt-3 max-w-full text-base font-semibold leading-7 text-muted-foreground sm:max-w-xl">
                Public community posts ranked by views plus likes, with replies
                and reposts kept visible for context.
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
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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
          <StatTile
            icon={<MessageCircle />}
            label="Engagement rate"
            value={`${engagementRate.toFixed(2)}%`}
          />
        </div>

        {isError ? (
          <div className="glass-panel mt-5 rounded-md p-4 text-sm font-semibold text-foreground">
            Failed to load{" "}
            <span className="font-black">/renaiss_posts.csv</span>.
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

              <div className="mt-4 grid gap-3 border-t border-white/20 pt-4 text-sm font-semibold text-muted-foreground sm:grid-cols-3">
                <InlineFact
                  label="CSV posts"
                  value={formatNumber(totals.posts)}
                />
                <InlineFact label="Latest post" value={latestPostDate} />
                <InlineFact label="Sorted by" value={metricLabels[sortBy]} />
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

function buildAuthorPosts(
  posts: PostRow[],
  username: string,
  sortBy: PostSortKey,
): AuthorPost[] {
  const normalizedUsername = username.trim().toLowerCase();

  return posts
    .filter(
      (post) => post.author_username.trim().toLowerCase() === normalizedUsername,
    )
    .map((post) => {
      const replies = toNumber(post.replies);
      const reposts = toNumber(post.reposts);
      const quotes = toNumber(post.quotes);
      const likes = toNumber(post.likes);
      const views = toNumber(post.views);

      return {
        id: post.id,
        url: post.url,
        description: post.description.trim(),
        createdAt: post.created_at,
        timestamp: parsePostDate(post.created_at),
        replies,
        reposts,
        quotes,
        likes,
        views,
        score: views + likes,
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
        <div className="flex flex-col gap-6 border-b border-white/20 p-5 lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:p-7">
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
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 lg:items-end">
            <p className="font-display text-6xl font-black leading-none">
              #{author.rank}
            </p>
            <Button asChild variant="default">
              <a href={xProfileUrl} target="_blank" rel="noreferrer">
                Open X profile
                <ArrowUpRight />
              </a>
            </Button>
          </div>
        </div>

        <div className="grid border-b border-white/20 sm:grid-cols-2 lg:grid-cols-4">
          <ProfileMetric icon={<Eye />} label="Views" value={author.views} />
          <ProfileMetric icon={<Heart />} label="Likes" value={author.likes} />
          <ProfileMetric
            icon={<Repeat2 />}
            label="Reposts + quotes"
            value={author.reposts + author.quotes}
          />
          <ProfileMetric
            icon={<MessageCircle />}
            label="Replies"
            value={author.replies}
          />
        </div>
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

        <div className="mt-4 grid gap-3 border-t border-white/20 pt-4 sm:grid-cols-3">
          <InlineFact label="Indexed posts" value={formatNumber(posts.length)} />
          <InlineFact
            label="Top post"
            value={formatCompact(Math.max(0, ...posts.map((post) => post.score)))}
          />
          <InlineFact
            label="Latest"
            value={formatPostDate(author.latestTimestamp)}
          />
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

function ProfileMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="border-b border-white/20 p-5 last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
        <span className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-4 font-display text-4xl font-black leading-none sm:text-5xl">
        {formatCompact(value)}
      </p>
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

function buildShareUrl(
  topAuthor: RankedAuthor | undefined,
  totalViews: number,
) {
  const text = topAuthor
    ? `Proof of Renaiss : @${topAuthor.authorUsername} leads with ${formatCompact(topAuthor.views)} views. Total indexed views: ${formatCompact(totalViews)}.`
    : "Proof of Renaiss from public X posts.";

  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

function getUsernameFromHash() {
  if (typeof window === "undefined") {
    return "";
  }

  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);

  return params.get("u") ?? "";
}
