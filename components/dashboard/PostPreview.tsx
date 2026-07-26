'use client';

import React from 'react';
import { SocialPlatform } from '@/types';
import {
  Heart,
  MessageCircle,
  MessageSquare,
  Send,
  Bookmark,
  Share2,
  Repeat2,
  ThumbsUp,
  ThumbsDown,
  Play,
  MoreHorizontal,
  MoreVertical,
  BadgeCheck,
  Music2,
  Plus,
  Eye,
  Globe,
} from 'lucide-react';

export interface PreviewMedia {
  url: string;
  type: string;
  name: string;
  preview: string;
}

export interface PreviewAuthor {
  name: string;
  handle: string;
  avatarUrl?: string;
}

interface Props {
  platform: SocialPlatform;
  content: string;
  hashtags?: string;
  media?: PreviewMedia[];
  author: PreviewAuthor;
  topic: string;
  /** Used as the headline for the Blog preview. */
  title?: string;
}

/* ------------------------------ shared helpers ------------------------------ */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'C';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

// Deterministic pseudo-count so previews don't flicker between renders.
function seededCount(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return min + (h % (max - min + 1));
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

function readingTime(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

const Avatar: React.FC<{ author: PreviewAuthor; size?: number; className?: string }> = ({
  author,
  size = 40,
  className = '',
}) => {
  const dim = { width: size, height: size };
  if (author.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={author.avatarUrl} alt={author.name} style={dim} className={`rounded-full object-cover ${className}`} />;
  }
  return (
    <div
      style={dim}
      className={`rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white font-bold flex items-center justify-center shrink-0 ${className}`}
    >
      <span style={{ fontSize: size * 0.4 }}>{initials(author.name)}</span>
    </div>
  );
};

function useMediaSlot(media?: PreviewMedia[]) {
  const first = media?.[0];
  return {
    src: first?.preview,
    isVideo: Boolean(first?.type.startsWith('video/')),
    hasMedia: Boolean(first),
  };
}

const GradientPoster: React.FC<{ topic: string; variant: SocialPlatform; className?: string }> = ({
  topic,
  variant,
  className = '',
}) => {
  const bg =
    variant === 'instagram'
      ? 'bg-[linear-gradient(135deg,#feda75,#d62976_45%,#962fbf_75%,#4f5bd5)]'
      : variant === 'tiktok'
        ? 'bg-[linear-gradient(160deg,#25f4ee_0%,#000_45%,#fe2c55_100%)]'
        : variant === 'youtube'
          ? 'bg-[linear-gradient(135deg,#1a1a1a,#c4302b)]'
          : 'bg-[linear-gradient(135deg,#0f172a,#10b981)]';
  return (
    <div className={`relative flex items-center justify-center text-center px-5 ${bg} ${className}`}>
      <span className="text-white font-extrabold tracking-tight text-lg drop-shadow-sm">{topic}</span>
    </div>
  );
};

/** Renders body copy, then any hashtags in the platform accent color. */
const Body: React.FC<{ content: string; hashtags?: string; accent: string; className?: string }> = ({
  content,
  hashtags,
  accent,
  className = '',
}) => (
  <div className={`whitespace-pre-wrap break-words leading-snug ${className}`}>
    {content}
    {hashtags?.trim() && (
      <>
        {content.trim() && '\n\n'}
        <span style={{ color: accent }}>{hashtags}</span>
      </>
    )}
  </div>
);

/* -------------------------------- LinkedIn --------------------------------- */

const LinkedInPreview: React.FC<Props> = ({ content, hashtags, media, author, topic }) => {
  const { src, hasMedia } = useMediaSlot(media);
  const reactions = seededCount(`li${content}`, 40, 1800);
  const comments = seededCount(`lic${content}`, 3, 120);
  return (
    <div className="bg-white text-[#1f2328] rounded-xl border border-black/10 overflow-hidden text-[13px] shadow-sm">
      <div className="p-3 flex gap-2 items-start">
        <Avatar author={author} size={44} />
        <div className="min-w-0">
          <div className="font-semibold leading-tight truncate">{author.name}</div>
          <div className="text-[11px] text-black/55 truncate">Sharing signal on {topic}</div>
          <div className="text-[11px] text-black/50 flex items-center gap-1">1h · <Globe className="w-3 h-3" /></div>
        </div>
        <button className="ml-auto text-[#0a66c2] font-semibold text-[13px] flex items-center gap-1 shrink-0">
          <Plus className="w-4 h-4" strokeWidth={2.5} /> Follow
        </button>
      </div>
      <Body content={content} hashtags={hashtags} accent="#0a66c2" className="px-3 pb-2.5" />
      {hasMedia && src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full max-h-72 object-cover border-y border-black/5" />
      )}
      <div className="px-3 py-1.5 flex items-center gap-1.5 text-[11px] text-black/55 border-t border-black/5">
        <span className="flex -space-x-1">
          <span className="w-4 h-4 rounded-full bg-[#0a66c2] flex items-center justify-center text-white text-[8px]">
            <ThumbsUp className="w-2.5 h-2.5" />
          </span>
          <span className="w-4 h-4 rounded-full bg-[#d93025] flex items-center justify-center text-white text-[8px]">❤</span>
        </span>
        {fmtCount(reactions)} · {fmtCount(comments)} comments
      </div>
      <div className="grid grid-cols-4 border-t border-black/10 text-black/60 text-[12px] font-semibold">
        {[
          { Icon: ThumbsUp, label: 'Like' },
          { Icon: MessageSquare, label: 'Comment' },
          { Icon: Repeat2, label: 'Repost' },
          { Icon: Send, label: 'Send' },
        ].map(({ Icon, label }) => (
          <div key={label} className="flex items-center justify-center gap-1.5 py-2 hover:bg-black/5">
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------------------------------- X ------------------------------------- */

const XPreview: React.FC<Props> = ({ content, hashtags, media, author }) => {
  const { src, hasMedia } = useMediaSlot(media);
  const replies = seededCount(`xr${content}`, 5, 400);
  const reposts = seededCount(`xrt${content}`, 10, 900);
  const likes = seededCount(`xl${content}`, 50, 9000);
  const views = seededCount(`xv${content}`, 5000, 900000);
  return (
    <div className="bg-white text-[#0f1419] rounded-xl border border-black/10 p-3 text-[14px]">
      <div className="flex gap-2.5">
        <Avatar author={author} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[14px]">
            <span className="font-bold truncate">{author.name}</span>
            <BadgeCheck className="w-4 h-4 text-[#1d9bf0] shrink-0" fill="#1d9bf0" stroke="white" />
            <span className="text-black/50 truncate">{author.handle} · 1h</span>
            <MoreHorizontal className="w-4 h-4 text-black/40 ml-auto shrink-0" />
          </div>
          <Body content={content} hashtags={hashtags} accent="#1d9bf0" className="mt-0.5" />
          {hasMedia && src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="mt-2 w-full max-h-72 object-cover rounded-2xl border border-black/10" />
          )}
          <div className="flex items-center justify-between mt-2.5 max-w-[320px] text-black/50 text-[12px]">
            <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4" />{fmtCount(replies)}</span>
            <span className="flex items-center gap-1"><Repeat2 className="w-4 h-4" />{fmtCount(reposts)}</span>
            <span className="flex items-center gap-1"><Heart className="w-4 h-4" />{fmtCount(likes)}</span>
            <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{fmtCount(views)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------- Instagram -------------------------------- */

const InstagramPreview: React.FC<Props> = ({ content, hashtags, media, author, topic }) => {
  const { src, hasMedia } = useMediaSlot(media);
  const likes = seededCount(`igl${content}`, 200, 40000);
  const username = author.handle.replace(/^@/, '');
  return (
    <div className="bg-white text-[#262626] rounded-xl border border-black/10 overflow-hidden text-[13px]">
      <div className="flex items-center gap-2 p-2.5">
        <div className="rounded-full p-[2px] bg-[linear-gradient(45deg,#feda75,#d62976,#4f5bd5)]">
          <Avatar author={author} size={30} className="ring-2 ring-white" />
        </div>
        <span className="font-semibold text-[13px]">{username}</span>
        <MoreHorizontal className="w-4 h-4 ml-auto text-black/60" />
      </div>
      {hasMedia && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full aspect-square object-cover" />
      ) : (
        <GradientPoster topic={topic} variant="instagram" className="w-full aspect-square" />
      )}
      <div className="flex items-center gap-4 px-3 pt-2.5 text-[#262626]">
        <Heart className="w-6 h-6" />
        <MessageCircle className="w-6 h-6 -scale-x-100" />
        <Send className="w-6 h-6" />
        <Bookmark className="w-6 h-6 ml-auto" />
      </div>
      <div className="px-3 pt-2 font-semibold text-[13px]">{fmtCount(likes)} likes</div>
      <div className="px-3 pt-0.5 pb-3">
        <span className="font-semibold mr-1">{username}</span>
        <Body content={content} hashtags={hashtags} accent="#00376b" className="inline" />
      </div>
    </div>
  );
};

/* --------------------------------- TikTok --------------------------------- */

const TikTokPreview: React.FC<Props> = ({ content, hashtags, media, author, topic }) => {
  const { src, hasMedia, isVideo } = useMediaSlot(media);
  const likes = seededCount(`ttl${content}`, 1000, 900000);
  const comments = seededCount(`ttc${content}`, 50, 20000);
  const saves = seededCount(`tts${content}`, 20, 8000);
  const shares = seededCount(`ttsh${content}`, 30, 12000);
  const username = author.handle.replace(/^@/, '');
  return (
    <div className="relative bg-black text-white rounded-xl overflow-hidden aspect-[9/16] max-w-[230px] mx-auto">
      {hasMedia && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90" />
      ) : (
        <GradientPoster topic={topic} variant="tiktok" className="absolute inset-0 w-full h-full" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
      {(!hasMedia || isVideo) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Play className="w-12 h-12 text-white/80" fill="rgba(255,255,255,0.85)" />
        </div>
      )}
      {/* action rail */}
      <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3.5">
        <Avatar author={author} size={38} className="ring-2 ring-white" />
        {[
          { Icon: Heart, n: likes, fill: '#fe2c55' },
          { Icon: MessageCircle, n: comments },
          { Icon: Bookmark, n: saves, fill: '#f5c518' },
          { Icon: Share2, n: shares },
        ].map(({ Icon, n, fill }, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <Icon className="w-7 h-7 drop-shadow" fill={fill ?? 'white'} stroke={fill ? fill : 'white'} />
            <span className="text-[11px] font-semibold drop-shadow">{fmtCount(n)}</span>
          </div>
        ))}
      </div>
      {/* caption */}
      <div className="absolute left-3 right-14 bottom-3">
        <div className="font-bold text-[13px]">@{username}</div>
        <div className="text-[12px] leading-snug line-clamp-2 mt-0.5">{content}</div>
        {hashtags?.trim() && <div className="text-[12px] font-semibold mt-0.5 line-clamp-1">{hashtags}</div>}
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
          <Music2 className="w-3 h-3" />
          <span className="truncate">original sound — {username}</span>
        </div>
      </div>
    </div>
  );
};

/* --------------------------------- YouTube -------------------------------- */

const YouTubePreview: React.FC<Props> = ({ content, hashtags, media, author, topic }) => {
  const { src, hasMedia } = useMediaSlot(media);
  const likes = seededCount(`ytl${content}`, 100, 60000);
  const comments = seededCount(`ytc${content}`, 10, 4000);
  return (
    <div className="bg-white text-[#0f0f0f] rounded-xl border border-black/10 p-3 text-[13px]">
      <div className="flex items-center gap-2">
        <Avatar author={author} size={36} />
        <div className="min-w-0">
          <div className="font-semibold text-[13px] truncate">{author.name}</div>
          <div className="text-[11px] text-black/55">1 hour ago</div>
        </div>
        <MoreVertical className="w-4 h-4 ml-auto text-black/50" />
      </div>
      <Body content={content} hashtags={hashtags} accent="#065fd4" className="mt-2" />
      {hasMedia && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="mt-2.5 w-full max-h-72 object-cover rounded-lg" />
      ) : (
        <GradientPoster topic={topic} variant="youtube" className="mt-2.5 w-full aspect-video rounded-lg" />
      )}
      <div className="flex items-center gap-5 mt-2.5 text-black/70 text-[12px] font-medium">
        <span className="flex items-center gap-1.5"><ThumbsUp className="w-4 h-4" />{fmtCount(likes)}</span>
        <ThumbsDown className="w-4 h-4" />
        <span className="flex items-center gap-1.5"><MessageSquare className="w-4 h-4" />{fmtCount(comments)}</span>
        <Share2 className="w-4 h-4 ml-auto" />
      </div>
    </div>
  );
};

/* ---------------------------------- Blog ---------------------------------- */

const BlogPreview: React.FC<Props> = ({ content, media, author, topic, title }) => {
  const { src, hasMedia } = useMediaSlot(media);
  const headline = (title || content.split('\n')[0] || topic).slice(0, 90);
  const excerpt = content.replace(headline, '').trim() || content;
  return (
    <article className="bg-white text-[#1a1a1a] rounded-xl border border-black/10 overflow-hidden">
      {hasMedia && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-36 object-cover" />
      ) : (
        <GradientPoster topic={topic} variant="blog" className="w-full h-32" />
      )}
      <div className="p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">{topic}</div>
        <h3 className="text-lg font-extrabold tracking-tight mt-1 leading-snug text-balance">{headline}</h3>
        <div className="flex items-center gap-2 mt-2.5">
          <Avatar author={author} size={26} />
          <span className="text-[12px] text-black/60">
            {author.name} · {readingTime(content)}
          </span>
        </div>
        <p className="text-[13px] text-black/70 leading-relaxed mt-2.5 line-clamp-3">{excerpt}</p>
        <div className="text-[13px] font-semibold text-emerald-600 mt-3">Read article →</div>
      </div>
    </article>
  );
};

/* -------------------------------- dispatcher ------------------------------- */

export const PostPreview: React.FC<Props> = (props) => {
  switch (props.platform) {
    case 'linkedin':
      return <LinkedInPreview {...props} />;
    case 'twitter':
      return <XPreview {...props} />;
    case 'instagram':
      return <InstagramPreview {...props} />;
    case 'tiktok':
      return <TikTokPreview {...props} />;
    case 'youtube':
      return <YouTubePreview {...props} />;
    case 'blog':
      return <BlogPreview {...props} />;
    default:
      return null;
  }
};
