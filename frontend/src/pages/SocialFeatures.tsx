import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Camera,
  Check,
  Film,
  Globe2,
  Heart,
  Image,
  Link,
  MapPin,
  MessageCircle,
  Pencil,
  Send,
  Share2,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type React from "react";
import { format } from "date-fns";
import { api, apiBlob, apiForm, updateStoredUser } from "../lib/api";
import { Button, Card, Input } from "../components/ui";

type NetworkUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
};
type Media = {
  id: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  mimeType: string;
  size: number;
};
type Post = {
  id: string;
  body: string;
  visibility: "PUBLIC" | "NETWORK" | "PRIVATE";
  createdAt: string;
  likedByMe: boolean;
  likeCount: number;
  media: Media[];
  author: { id: string; name: string; avatarUrl?: string; position?: string };
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; name: string; avatarUrl?: string };
  }>;
};
type Profile = {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  coverUrl?: string;
  bio?: string;
  profession?: string;
  position?: string;
  company?: string;
  city?: string;
  region?: string;
  country?: string;
  website?: string;
  phone?: string;
  professionalLinks?: Array<{ label: string; url: string }>;
  socialLinks?: Array<{ network: string; url: string }>;
  createdAt: string;
  own: boolean;
  connected: boolean;
  completion: number;
  verified: boolean;
  profileVerifiedAt?: string;
  verificationMissing?: string[];
  connectionCount: number;
  posts: Post[];
  organizations: Array<{
    role: string;
    organization: { id: string; name: string; slug: string; logoUrl?: string };
  }>;
};
type Organization = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  city?: string;
  region?: string;
  country?: string;
  website?: string;
  logoUrl?: string;
  coverUrl?: string;
  isPublic: boolean;
  membership?: { role: "OWNER" | "ADMIN" | "MEMBER" };
  members?: Array<{
    id: string;
    role: string;
    user: { id: string; name: string; position?: string; avatarUrl?: string };
  }>;
  teams?: Array<{
    id: string;
    name: string;
    _count: { members: number; events: number; tasks: number };
  }>;
};

function Shell({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm">
      <Card
        className={`safe-bottom mx-auto flex h-[100dvh] w-full flex-col overflow-hidden rounded-none ${wide ? "max-w-6xl" : "max-w-3xl"} sm:my-4 sm:h-[calc(100dvh-2rem)] sm:rounded-xl`}
        role="dialog"
        aria-modal="true"
      >
        <header className="safe-top flex shrink-0 items-center justify-between bg-slate-950 px-4 py-3 text-white sm:px-6">
          <h2 className="truncate text-lg font-bold">{title}</h2>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg bg-white text-slate-800"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </Card>
    </div>
  );
}

export function SecureMedia({
  path,
  type = "image",
  className = "",
}: {
  path?: string;
  type?: "image" | "video";
  className?: string;
}) {
  const [source, setSource] = useState<string>();
  useEffect(() => {
    if (!path) return;
    if (/^https?:\/\//.test(path)) {
      setSource(path);
      return;
    }
    let url = "";
    apiBlob(path)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setSource(url);
      })
      .catch(() => undefined);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  if (!source)
    return <div className={`animate-pulse bg-slate-200 ${className}`} />;
  return type === "video" ? (
    <video className={className} controls preload="metadata" src={source} />
  ) : (
    <img className={className} src={source} alt="" />
  );
}

function PostCard({
  post,
  onProfile,
}: {
  post: Post;
  onProfile: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const like = useMutation({
    mutationFn: () =>
      api(`/api/social/feed/${post.id}/like`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed"] }),
  });
  const commentMutation = useMutation({
    mutationFn: () =>
      api(`/api/social/feed/${post.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: comment.trim() }),
      }),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
  const visibility =
    post.visibility === "PUBLIC"
      ? "Público"
      : post.visibility === "NETWORK"
        ? "Minha Rede"
        : "Somente eu";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        className="flex items-center gap-3 text-left"
        onClick={() => onProfile(post.author.id)}
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">
          {post.author.name[0]}
        </span>
        <span>
          <strong className="block text-sm">{post.author.name}</strong>
          <span className="text-xs text-slate-500">
            {post.author.position || "Usuário OrganizaÍ"} · {visibility} ·{" "}
            {format(new Date(post.createdAt), "dd/MM HH:mm")}
          </span>
        </span>
      </button>
      {post.body && (
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6">
          {post.body}
        </p>
      )}
      {post.media?.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {post.media.map((media) => (
            <SecureMedia
              key={media.id}
              path={media.url}
              type={media.type === "VIDEO" ? "video" : "image"}
              className="max-h-96 w-full rounded-xl bg-black object-contain"
            />
          ))}
        </div>
      )}
      <div className="mt-4 flex gap-4 border-y py-2">
        <button
          type="button"
          className={post.likedByMe ? "text-red-600" : "text-slate-600"}
          onClick={() => like.mutate()}
        >
          <Heart
            className="mr-1 inline"
            size={18}
            fill={post.likedByMe ? "currentColor" : "none"}
          />
          {post.likeCount} Curtir
        </button>
        <span className="text-sm text-slate-600">
          <MessageCircle className="mr-1 inline" size={18} />
          {post.comments.length}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {post.comments.map((item) => (
          <div key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <strong>{item.author.name}</strong>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Comentar"
        />
        <Button
          className="px-3"
          type="button"
          disabled={!comment.trim()}
          onClick={() => commentMutation.mutate()}
        >
          <Send size={17} />
        </Button>
      </div>
    </article>
  );
}

export function FeedDialogEnhanced({
  onClose,
  onOpenProfile,
}: {
  onClose: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<
    "PUBLIC" | "NETWORK" | "PRIVATE"
  >("PUBLIC");
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File>();
  const feed = useQuery({
    queryKey: ["feed"],
    queryFn: () =>
      api<{ posts: Post[]; nextCursor?: string }>("/api/social/feed?limit=30"),
  });
  const publish = useMutation({
    mutationFn: async () => {
      const created = await api<{ post: { id: string } }>("/api/social/feed", {
        method: "POST",
        body: JSON.stringify({ body: body.trim(), visibility }),
      });
      if (images.length) {
        const form = new FormData();
        images.forEach((file) => form.append("files", file));
        await apiForm(`/api/social/feed/${created.post.id}/media/images`, form);
      }
      if (video) {
        const form = new FormData();
        form.append("files", video);
        await apiForm(`/api/social/feed/${created.post.id}/media/video`, form);
      }
    },
    onSuccess: () => {
      setBody("");
      setImages([]);
      setVideo(undefined);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
  return (
    <Shell title="Feed de Notícias" onClose={onClose}>
      <div className="space-y-4 bg-slate-50 p-3 sm:p-5">
        <div className="rounded-xl border bg-white p-4">
          <textarea
            className="min-h-24 w-full rounded-lg border p-3 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Compartilhe uma atualização..."
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <select
              className="h-10 rounded-md border bg-white px-3 text-sm"
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as typeof visibility)
              }
            >
              <option value="PUBLIC">Público</option>
              <option value="NETWORK">Minha Rede</option>
              <option value="PRIVATE">Somente eu</option>
            </select>
            <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm font-semibold">
              <Image size={17} />
              Fotos ({images.length})
              <input
                className="hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) =>
                  setImages(Array.from(e.target.files ?? []).slice(0, 4))
                }
              />
            </label>
            <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm font-semibold">
              <Film size={17} />
              Vídeo
              <input
                className="hidden"
                type="file"
                accept="video/mp4,video/webm"
                onChange={(e) => setVideo(e.target.files?.[0])}
              />
            </label>
          </div>
          <Button
            className="mt-3 w-full"
            type="button"
            disabled={
              (!body.trim() && !images.length && !video) || publish.isPending
            }
            onClick={() => publish.mutate()}
          >
            <Send size={17} />
            {publish.isPending ? "Publicando..." : "Publicar"}
          </Button>
          <p className="mt-2 text-xs text-slate-500">
            Até 4 fotos de 8 MB ou 1 vídeo de 30 MB. Vídeos não são processados
            na VM.
          </p>
        </div>
        {feed.data?.posts.map((post) => (
          <PostCard key={post.id} post={post} onProfile={onOpenProfile} />
        ))}
      </div>
    </Shell>
  );
}

export function SocialProfileDialog({
  userId,
  networkUsers,
  onClose,
}: {
  userId: string;
  networkUsers: NetworkUser[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("posts");
  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => api<{ profile: Profile }>(`/api/users/profiles/${userId}`),
  });
  const profile = profileQuery.data?.profile;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [orgCreating, setOrgCreating] = useState(false);
  const [orgForm, setOrgForm] = useState({
    name: "",
    description: "",
    category: "",
    city: "",
    region: "",
    country: "",
    website: "",
  });
  const [selectedOrg, setSelectedOrg] = useState<string>();
  const [verificationMessage, setVerificationMessage] = useState("");
  useEffect(() => {
    if (profile)
      setForm({
        name: profile.name,
        username: profile.username ?? "",
        bio: profile.bio ?? "",
        profession: profile.profession ?? "",
        position: profile.position ?? "",
        company: profile.company ?? "",
        city: profile.city ?? "",
        region: profile.region ?? "",
        country: profile.country ?? "",
        website: profile.website ?? "",
        phone: profile.phone ?? "",
      });
  }, [profile]);
  const save = useMutation({
    mutationFn: () =>
      api("/api/users/profiles/me", {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          username: form.username || null,
          bio: form.bio || null,
          profession: form.profession || null,
          position: form.position || null,
          company: form.company || null,
          city: form.city || null,
          region: form.region || null,
          country: form.country || null,
          website: form.website || null,
          phone: form.phone || null,
          professionalLinks: profile?.professionalLinks ?? [],
          socialLinks: profile?.socialLinks ?? [],
        }),
      }),
    onSuccess: () => {
      setEditing(false);
      updateStoredUser({ name: form.name });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });
  const upload = async (kind: "avatar" | "cover", file?: File) => {
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    await apiForm(`/api/users/profiles/me/media/${kind}`, data);
    queryClient.invalidateQueries({ queryKey: ["profile", userId] });
  };
  const organizations = useQuery({
    queryKey: ["organizations"],
    queryFn: () => api<{ organizations: Organization[] }>("/api/organizations"),
    enabled: Boolean(profile?.own),
  });
  const orgDetails = useQuery({
    queryKey: ["organization", selectedOrg],
    queryFn: () =>
      api<{ organization: Organization }>(`/api/organizations/${selectedOrg}`),
    enabled: Boolean(selectedOrg),
  });
  const createOrg = useMutation({
    mutationFn: () =>
      api("/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          ...orgForm,
          description: orgForm.description || null,
          category: orgForm.category || null,
          city: orgForm.city || null,
          region: orgForm.region || null,
          country: orgForm.country || null,
          website: orgForm.website || null,
          isPublic: false,
        }),
      }),
    onSuccess: () => {
      setOrgCreating(false);
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });
  const requestVerification = useMutation({
    mutationFn: () =>
      api<{ message: string }>("/api/users/profiles/me/verification/request", {
        method: "POST",
      }),
    onSuccess: ({ message }) => setVerificationMessage(message),
    onError: (reason) =>
      setVerificationMessage(
        reason instanceof Error
          ? reason.message
          : "Não foi possível solicitar a verificação.",
      ),
  });
  if (!profile)
    return (
      <Shell title="Perfil" onClose={onClose}>
        <div className="grid h-full place-items-center p-8">
          Carregando perfil...
        </div>
      </Shell>
    );
  const tabs = [
    ["posts", "Publicações"],
    ["about", "Sobre"],
    ["network", "Rede"],
    ["photos", "Fotos"],
    ["videos", "Vídeos"],
    ["organizations", "Organizações"],
  ];
  const set =
    (key: string) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));
  return (
    <Shell title={`Perfil de ${profile.name}`} onClose={onClose} wide>
      <div className="bg-slate-50">
        <div className="relative h-44 bg-gradient-to-br from-blue-700 to-cyan-500 sm:h-60">
          {profile.coverUrl && (
            <SecureMedia
              path={profile.coverUrl}
              className="h-full w-full object-cover"
            />
          )}
          {profile.own && (
            <label className="absolute right-3 top-3 flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold">
              <Camera size={16} />
              Capa
              <input
                className="hidden"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => upload("cover", e.target.files?.[0])}
              />
            </label>
          )}
        </div>
        <div className="mx-auto max-w-5xl px-3">
          <div className="relative -mt-14 flex flex-col items-start gap-3 sm:flex-row sm:items-end">
            <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-blue-100 shadow">
              {profile.avatarUrl ? (
                <SecureMedia
                  path={profile.avatarUrl}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="grid h-full place-items-center text-3xl font-bold text-blue-700">
                  {profile.name[0]}
                </span>
              )}
              {profile.own && (
                <label className="absolute bottom-1 right-1 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-blue-700 text-white">
                  <Camera size={16} />
                  <input
                    className="hidden"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => upload("avatar", e.target.files?.[0])}
                  />
                </label>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{profile.name}</h1>
                {profile.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
                    <ShieldCheck size={15} />
                    Verificado
                  </span>
                )}
              </div>
              {profile.username && (
                <p className="text-sm text-slate-500">@{profile.username}</p>
              )}
              <p className="text-sm text-slate-600">
                {profile.position || profile.profession}
                {profile.company ? ` · ${profile.company}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <span>{profile.connectionCount} conexões</span>
                <span>{profile.posts.length} publicações</span>
                <span>{profile.organizations.length} organizações</span>
              </div>
            </div>
            {profile.own && (
              <Button type="button" onClick={() => setEditing(true)}>
                <Pencil size={16} />
                Editar perfil
              </Button>
            )}
          </div>
          {profile.own && profile.completion < 100 && (
            <div className="my-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <strong>Complete seu perfil</strong>
              <p className="text-sm">Perfil {profile.completion}% completo</p>
              <div className="mt-2 h-2 rounded-full bg-blue-100">
                <div
                  className="h-2 rounded-full bg-blue-600"
                  style={{ width: `${profile.completion}%` }}
                />
              </div>
            </div>
          )}
          {profile.own && !profile.verified && (
            <div className="my-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <strong className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-violet-700" />
                    Verificar perfil por e-mail
                  </strong>
                  <p className="mt-1 text-sm text-slate-600">
                    {profile.verificationMissing?.length
                      ? `Complete os campos pendentes (${profile.verificationMissing.length}) para solicitar o selo.`
                      : "Seu perfil está completo. Enviaremos um link para seu e-mail."}
                  </p>
                </div>
                <Button
                  type="button"
                  disabled={
                    Boolean(profile.verificationMissing?.length) ||
                    requestVerification.isPending
                  }
                  onClick={() => requestVerification.mutate()}
                >
                  {requestVerification.isPending
                    ? "Enviando..."
                    : "Enviar verificação"}
                </Button>
              </div>
              {verificationMessage && (
                <p className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700">
                  {verificationMessage}
                </p>
              )}
            </div>
          )}
          <nav className="mt-4 flex gap-1 overflow-x-auto border-b">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`shrink-0 px-3 py-3 text-sm font-semibold ${tab === id ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500"}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <main className="min-h-80 py-5">
            {editing && (
              <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
                {[
                  "name",
                  "username",
                  "profession",
                  "position",
                  "company",
                  "city",
                  "region",
                  "country",
                  "website",
                  "phone",
                ].map((field) => (
                  <label
                    key={field}
                    className="text-sm font-semibold capitalize"
                  >
                    {field}
                    <Input value={form[field] ?? ""} onChange={set(field)} />
                  </label>
                ))}
                <label className="sm:col-span-2 text-sm font-semibold">
                  Bio
                  <textarea
                    className="mt-1 min-h-28 w-full rounded-md border p-3"
                    value={form.bio ?? ""}
                    onChange={set("bio")}
                  />
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="button" onClick={() => save.mutate()}>
                    Salvar
                  </Button>
                  <Button
                    type="button"
                    className="bg-slate-200 text-slate-800"
                    onClick={() => setEditing(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
            {!editing && tab === "posts" && (
              <div className="space-y-4">
                {profile.own && <ProfilePublisher profileId={userId} />}
                {profile.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onProfile={() => undefined}
                  />
                ))}
                {!profile.posts.length && (
                  <Empty text="Nenhuma publicação visível." />
                )}
              </div>
            )}
            {tab === "about" && (
              <div className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2">
                <Info
                  icon={<UserRound />}
                  title="Apresentação"
                  value={profile.bio}
                />
                <Info
                  icon={<Building2 />}
                  title="Profissão"
                  value={[profile.profession, profile.position, profile.company]
                    .filter(Boolean)
                    .join(" · ")}
                />
                <Info
                  icon={<MapPin />}
                  title="Localização"
                  value={[profile.city, profile.region, profile.country]
                    .filter(Boolean)
                    .join(", ")}
                />
                <Info icon={<Link />} title="Site" value={profile.website} />
                <Info
                  icon={<Globe2 />}
                  title="No OrganizaÍ desde"
                  value={format(new Date(profile.createdAt), "dd/MM/yyyy")}
                />
              </div>
            )}
            {tab === "network" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {profile.own &&
                  networkUsers.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border bg-white p-4"
                    >
                      <strong>{item.name}</strong>
                      <p className="text-xs text-slate-500">{item.email}</p>
                    </div>
                  ))}
                {!profile.own && (
                  <Empty
                    text={
                      profile.connected
                        ? "Vocês estão conectados."
                        : "Este usuário não faz parte da sua rede."
                    }
                  />
                )}
              </div>
            )}
            {tab === "photos" && (
              <MediaGrid posts={profile.posts} kind="IMAGE" />
            )}
            {tab === "videos" && (
              <MediaGrid posts={profile.posts} kind="VIDEO" />
            )}
            {tab === "organizations" && (
              <div className="space-y-4">
                {profile.own && (
                  <Button type="button" onClick={() => setOrgCreating(true)}>
                    <Building2 size={17} />
                    Criar organização
                  </Button>
                )}
                {orgCreating && (
                  <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
                    {Object.keys(orgForm).map((key) =>
                      key === "description" ? (
                        <textarea
                          key={key}
                          className="rounded-md border p-3 sm:col-span-2"
                          placeholder="Descrição"
                          value={orgForm.description}
                          onChange={(e) =>
                            setOrgForm({
                              ...orgForm,
                              description: e.target.value,
                            })
                          }
                        />
                      ) : (
                        <Input
                          key={key}
                          placeholder={key}
                          value={orgForm[key as keyof typeof orgForm]}
                          onChange={(e) =>
                            setOrgForm({ ...orgForm, [key]: e.target.value })
                          }
                        />
                      ),
                    )}
                    <Button
                      type="button"
                      disabled={!orgForm.name.trim()}
                      onClick={() => createOrg.mutate()}
                    >
                      Criar
                    </Button>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {(profile.own
                    ? (organizations.data?.organizations ?? [])
                    : profile.organizations.map((item) => item.organization)
                  ).map((organization) => (
                    <button
                      key={organization.id}
                      type="button"
                      className="rounded-xl border bg-white p-4 text-left"
                      onClick={() => setSelectedOrg(organization.id)}
                    >
                      <strong>{organization.name}</strong>
                    </button>
                  ))}
                </div>
                {selectedOrg && orgDetails.data && (
                  <OrganizationPanel
                    organization={orgDetails.data.organization}
                    networkUsers={networkUsers}
                  />
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </Shell>
  );
}

function ProfilePublisher({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<
    "PUBLIC" | "NETWORK" | "PRIVATE"
  >("PUBLIC");
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File>();
  const publish = useMutation({
    mutationFn: async () => {
      const created = await api<{ post: { id: string } }>("/api/social/feed", {
        method: "POST",
        body: JSON.stringify({ body: body.trim(), visibility }),
      });
      if (images.length) {
        const data = new FormData();
        images.forEach((file) => data.append("files", file));
        await apiForm(`/api/social/feed/${created.post.id}/media/images`, data);
      }
      if (video) {
        const data = new FormData();
        data.append("files", video);
        await apiForm(`/api/social/feed/${created.post.id}/media/video`, data);
      }
    },
    onSuccess: () => {
      setBody("");
      setImages([]);
      setVideo(undefined);
      queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
  return (
    <div className="rounded-xl border bg-white p-4">
      <textarea
        className="min-h-24 w-full rounded-md border p-3 text-sm"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Publique no seu perfil..."
      />
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <select
          className="h-10 rounded-md border px-3"
          value={visibility}
          onChange={(event) =>
            setVisibility(event.target.value as typeof visibility)
          }
        >
          <option value="PUBLIC">Público</option>
          <option value="NETWORK">Minha Rede</option>
          <option value="PRIVATE">Somente eu</option>
        </select>
        <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm">
          <Image size={17} />
          Fotos
          <input
            className="hidden"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              setImages(Array.from(event.target.files ?? []).slice(0, 4))
            }
          />
        </label>
        <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm">
          <Film size={17} />
          Vídeo
          <input
            className="hidden"
            type="file"
            accept="video/mp4,video/webm"
            onChange={(event) => setVideo(event.target.files?.[0])}
          />
        </label>
      </div>
      <Button
        className="mt-3 w-full"
        type="button"
        disabled={
          (!body.trim() && !images.length && !video) || publish.isPending
        }
        onClick={() => publish.mutate()}
      >
        <Send size={17} />
        Publicar
      </Button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">
      {text}
    </p>
  );
}
function Info({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value?: string;
}) {
  return (
    <div className="flex gap-3">
      {icon}
      <div>
        <strong className="text-sm">{title}</strong>
        <p className="text-sm text-slate-600">{value || "Não informado"}</p>
      </div>
    </div>
  );
}
function MediaGrid({
  posts,
  kind,
}: {
  posts: Post[];
  kind: "IMAGE" | "VIDEO";
}) {
  const media = posts.flatMap((post) =>
    post.media.filter((item) => item.type === kind),
  );
  return media.length ? (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {media.map((item) => (
        <SecureMedia
          key={item.id}
          path={item.url}
          type={kind === "VIDEO" ? "video" : "image"}
          className="aspect-square w-full rounded-xl bg-black object-cover"
        />
      ))}
    </div>
  ) : (
    <Empty
      text={
        kind === "IMAGE" ? "Nenhuma foto visível." : "Nenhum vídeo visível."
      }
    />
  );
}

function OrganizationPanel({
  organization,
  networkUsers,
}: {
  organization: Organization;
  networkUsers: NetworkUser[];
}) {
  const queryClient = useQueryClient();
  const [inviteUrl, setInviteUrl] = useState("");
  const [userId, setUserId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const canManage = ["OWNER", "ADMIN"].includes(
    organization.membership?.role ?? "",
  );
  const invite = useMutation({
    mutationFn: () =>
      api<{ invitation: { url: string; emailQueued: boolean } }>(
        `/api/organizations/${organization.id}/invites`,
        {
          method: "POST",
          body: JSON.stringify({
            userId: inviteEmail.trim() ? null : userId || null,
            email: inviteEmail.trim().toLowerCase() || null,
            role: "MEMBER",
          }),
        },
      ),
    onSuccess: ({ invitation }) => {
      setInviteUrl(invitation.url);
      if (inviteEmail.trim()) {
        setInviteMessage(
          invitation.emailQueued
            ? `Convite enviado para ${inviteEmail.trim()}.`
            : "O link foi criado, mas o e-mail não pôde ser enviado. Você ainda pode copiá-lo.",
        );
        setInviteEmail("");
      } else if (navigator.share)
        navigator
          .share({
            title: organization.name,
            text: `Convite para ${organization.name}`,
            url: invitation.url,
          })
          .catch(() => undefined);
    },
    onError: (reason) =>
      setInviteMessage(
        reason instanceof Error
          ? reason.message
          : "Não foi possível criar o convite.",
      ),
  });
  const uploadMedia = async (kind: "logo" | "cover", file?: File) => {
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    await apiForm(`/api/organizations/${organization.id}/media/${kind}`, data);
    await queryClient.invalidateQueries({
      queryKey: ["organization", organization.id],
    });
    await queryClient.invalidateQueries({ queryKey: ["organizations"] });
  };
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="relative h-32 bg-gradient-to-r from-blue-700 to-violet-600 sm:h-44">
        {organization.coverUrl && (
          <SecureMedia
            path={organization.coverUrl}
            className="h-full w-full object-cover"
          />
        )}
        {canManage && (
          <label className="absolute right-3 top-3 cursor-pointer rounded-md bg-white/90 px-3 py-2 text-xs font-semibold shadow">
            Alterar capa
            <input
              className="hidden"
              type="file"
              capture="environment"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                uploadMedia("cover", event.target.files?.[0])
              }
            />
          </label>
        )}
      </div>
      <div className="p-4">
        <div className="-mt-14 flex items-end gap-3">
          <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-white bg-white shadow">
            {organization.logoUrl ? (
              <SecureMedia
                path={organization.logoUrl}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="grid h-full place-items-center bg-violet-100 text-2xl font-bold text-violet-700">
                {organization.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          {canManage && (
            <label className="mb-1 cursor-pointer text-xs font-semibold text-blue-700 hover:underline">
              Alterar logo
              <input
                className="hidden"
                type="file"
                capture="environment"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  uploadMedia("logo", event.target.files?.[0])
                }
              />
            </label>
          )}
        </div>
        <h3 className="mt-3 text-xl font-bold">{organization.name}</h3>
        <p className="mt-2 text-sm text-slate-600">
          {organization.description}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {organization.members?.map((member) => (
            <div key={member.id} className="rounded-lg bg-slate-50 p-3 text-sm">
              <strong>{member.user.name}</strong>
              <p>{member.role}</p>
            </div>
          ))}
        </div>
        {canManage && (
          <div className="mt-4 rounded-lg border p-3">
            <strong>Convidar pessoas</strong>
            <select
              className="mt-2 h-10 w-full rounded-md border px-3"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={Boolean(inviteEmail.trim())}
            >
              <option value="">Gerar convite por link</option>
              {networkUsers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="my-3 flex items-center gap-3 text-xs font-semibold uppercase text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              ou pelo e-mail
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="usuario@exemplo.com"
              value={inviteEmail}
              onChange={(event) => {
                setInviteEmail(event.target.value);
                if (event.target.value) setUserId("");
              }}
            />
            <Button
              className="mt-2 w-full"
              type="button"
              disabled={invite.isPending}
              onClick={() => invite.mutate()}
            >
              <Share2 size={17} />
              Convidar
            </Button>
            {inviteUrl && <Input className="mt-2" readOnly value={inviteUrl} />}
            {inviteMessage && (
              <p className="mt-2 text-sm text-slate-600">{inviteMessage}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function OrganizationInviteDialog({
  token,
  onClose,
}: {
  token: string;
  onClose: () => void;
}) {
  const invite = useQuery({
    queryKey: ["organization-invite", token],
    queryFn: () =>
      api<{
        invitation: {
          organization: { name: string; description?: string };
          invitedBy: { name: string };
          role: string;
          expiresAt: string;
        };
      }>(`/api/organizations/invites/${token}`),
  });
  const respond = useMutation({
    mutationFn: (accept: boolean) =>
      api(`/api/organizations/invites/${token}/respond`, {
        method: "POST",
        body: JSON.stringify({ accept }),
      }),
    onSuccess: onClose,
  });
  return (
    <Shell title="Convite para organização" onClose={onClose}>
      <div className="mx-auto max-w-xl p-6 text-center">
        <Building2 className="mx-auto text-violet-600" size={48} />
        <h3 className="mt-4 text-2xl font-bold">
          {invite.data?.invitation.organization.name || "Carregando convite..."}
        </h3>
        <p className="mt-2 text-slate-600">
          {invite.data?.invitation.organization.description}
        </p>
        {invite.data && (
          <p className="mt-3 text-sm">
            Convite enviado por{" "}
            <strong>{invite.data.invitation.invitedBy.name}</strong>.
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Button
            type="button"
            className="bg-slate-200 text-slate-800"
            onClick={() => respond.mutate(false)}
          >
            Recusar
          </Button>
          <Button type="button" onClick={() => respond.mutate(true)}>
            <Check size={17} />
            Aceitar
          </Button>
        </div>
      </div>
    </Shell>
  );
}
