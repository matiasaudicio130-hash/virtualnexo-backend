"""
Seed completo de demo:
- Posts: foto única, carrusel, video, polls
- Interacciones: reacciones, comentarios, follows
- Albums públicos y privados
"""
import sys, asyncio, random, requests
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()

from app.db.supabase import get_supabase
from app.services.storage_service import storage_service

db = get_supabase()

# ── Usuarios de prueba ─────────────────────────────────────
TEST_USERS = [
    "e7a3fad0", "4911908a", "4a62dae9", "dde409b8",
    "0c264ca5", "90fe9458", "59dd51d8", "b2092ea0",
    "703a4402", "d94d8b02", "e69efb8e",
]

# Resolver IDs completos
def resolve_users():
    r = db.table("users").select("id,first_name,last_name,province,profile_type").eq("status","active").execute()
    by_short = {u["id"][:8]: u for u in r.data}
    return [by_short[s] for s in TEST_USERS if s in by_short]

users = resolve_users()
print(f"Loaded {len(users)} users")

# ── Descargar media ────────────────────────────────────────
def fetch_image(seed: int, w=800, h=800) -> bytes:
    url = f"https://picsum.photos/seed/aura{seed}/{w}/{h}"
    print(f"  fetch image seed={seed}", end=" ", flush=True)
    r = requests.get(url, timeout=20, headers={"User-Agent": "AuraSeed/1.0"})
    print(f"-> {len(r.content)} bytes")
    return r.content

def fetch_video() -> tuple[bytes, str]:
    """Devuelve un sample mp4 chiquito (Big Buck Bunny clip ~788KB)."""
    url = "https://www.w3schools.com/html/mov_bbb.mp4"
    print(f"  fetch video {url}", end=" ", flush=True)
    r = requests.get(url, timeout=60)
    print(f"-> {len(r.content)} bytes")
    if len(r.content) < 100000:
        raise RuntimeError(f"video sample too small: {len(r.content)} bytes")
    return r.content, "video/mp4"

# ── Captions y comentarios ─────────────────────────────────
CAPTIONS = [
    "Sábado de relax 🌅",
    "Empezando el finde con buena energía",
    "Probando lugares nuevos por la zona",
    "Nadie le gana al café de la mañana",
    "Compartiendo momentos lindos",
    "Después de una semana así, esto es oro puro",
    "Encontrar tu lugar feliz importa",
    "Momentos que valen la pena guardar",
    "La vida cuando le dejás espacio",
    "Conexiones reales > likes",
]

COMMENTS = [
    "Hermoso 😍", "Qué onda esa luz!", "Te re queda", "Coincido total",
    "Donde fue eso?", "Necesito ir ahí", "Foto top", "Vibes",
    "Buenísimo 🔥", "Pasa info!", "Idem", "Crack",
]

# ── Crear posts ────────────────────────────────────────────
async def upload_image(user_id: str, seed: int) -> dict:
    img_bytes = fetch_image(seed)
    return await storage_service.upload_post_image(
        image_bytes=img_bytes,
        user_id=user_id,
        original_name=f"seed_{seed}.jpg",
    )

async def upload_video(user_id: str) -> dict:
    video_bytes, ctype = fetch_video()
    return await storage_service.upload_post_video(
        video_bytes=video_bytes,
        user_id=user_id,
        content_type=ctype,
        original_name="seed_video.mp4",
    )

def insert_post(user_id: str, type_: str, caption: str, media_url: str | None, storage_path: str | None,
                media_urls: list | None = None, province: str | None = None) -> str:
    payload = {
        "user_id":      user_id,
        "type":         type_,
        "caption":      caption,
        "media_url":    media_url,
        "storage_path": storage_path,
        "media_urls":   media_urls,
        "province":     province,
        "status":       "active",
        "allow_share":  True,
    }
    r = db.table("posts").insert(payload).execute()
    return r.data[0]["id"]

async def main():
    # ── 1. Posts de foto única ────────────────────────────
    print("\n=== Single photo posts ===")
    photo_post_ids = []
    for i, u in enumerate(users[:6]):
        result = await upload_image(u["id"], 1000 + i)
        post_id = insert_post(
            user_id=u["id"], type_="photo",
            caption=random.choice(CAPTIONS),
            media_url=result["url"],
            storage_path=result["path"],
            province=u.get("province"),
        )
        photo_post_ids.append(post_id)
        print(f"  [ok] photo post {post_id[:8]} by {u['first_name']}")

    # ── 2. Carrusel de fotos ──────────────────────────────
    print("\n=== Carousel photo posts ===")
    for i, u in enumerate(users[6:9]):
        media_list = []
        for j in range(random.choice([3, 4, 5])):
            result = await upload_image(u["id"], 2000 + i*10 + j)
            media_list.append({"url": result["url"], "path": result["path"], "type": "image"})
        post_id = insert_post(
            user_id=u["id"], type_="photo",
            caption=random.choice(CAPTIONS),
            media_url=media_list[0]["url"],
            storage_path=media_list[0]["path"],
            media_urls=media_list,
            province=u.get("province"),
        )
        photo_post_ids.append(post_id)
        print(f"  [ok] carousel post {post_id[:8]} ({len(media_list)} fotos) by {u['first_name']}")

    # ── 3. Video posts ────────────────────────────────────
    print("\n=== Video posts ===")
    video_post_ids = []
    for u in users[:3]:
        result = await upload_video(u["id"])
        media_list = [{"url": result["url"], "path": result["path"], "type": "video"}]
        post_id = insert_post(
            user_id=u["id"], type_="photo",
            caption="Video del finde 🎬",
            media_url=result["url"],
            storage_path=result["path"],
            media_urls=media_list,
            province=u.get("province"),
        )
        video_post_ids.append(post_id)
        print(f"  [ok] video post {post_id[:8]} by {u['first_name']}")

    # ── 4. Carrusel mixto (fotos + video) ─────────────────
    print("\n=== Mixed carousel (photos + video) ===")
    u = users[3]
    media_list = []
    # 2 fotos
    for j in range(2):
        result = await upload_image(u["id"], 3000 + j)
        media_list.append({"url": result["url"], "path": result["path"], "type": "image"})
    # 1 video
    vresult = await upload_video(u["id"])
    media_list.append({"url": vresult["url"], "path": vresult["path"], "type": "video"})
    post_id = insert_post(
        user_id=u["id"], type_="photo",
        caption="Mix de fotos y un video del lugar",
        media_url=media_list[0]["url"],
        storage_path=media_list[0]["path"],
        media_urls=media_list,
        province=u.get("province"),
    )
    print(f"  [ok] mixed post {post_id[:8]} by {u['first_name']}")
    photo_post_ids.append(post_id)

    # ── 5. Reacciones (likes) ─────────────────────────────
    print("\n=== Reactions ===")
    all_posts = photo_post_ids + video_post_ids
    rx_count = 0
    for post_id in all_posts:
        reactors = random.sample(users, k=random.randint(2, 7))
        for reactor in reactors:
            try:
                db.table("post_reactions").insert({
                    "post_id": post_id,
                    "user_id": reactor["id"],
                    "type":    random.choice(["heart", "fire"]),
                }).execute()
                rx_count += 1
            except Exception:
                pass
    print(f"  [ok] {rx_count} reacciones")

    # ── 6. Comentarios ────────────────────────────────────
    print("\n=== Comments ===")
    cm_count = 0
    for post_id in all_posts:
        commenters = random.sample(users, k=random.randint(1, 4))
        for c in commenters:
            try:
                db.table("post_comments").insert({
                    "post_id": post_id,
                    "user_id": c["id"],
                    "content": random.choice(COMMENTS),
                }).execute()
                cm_count += 1
            except Exception as e:
                pass
    print(f"  [ok] {cm_count} comentarios")

    # ── 7. Follows ────────────────────────────────────────
    print("\n=== Follows ===")
    fw_count = 0
    for u in users:
        followees = random.sample([x for x in users if x["id"] != u["id"]], k=random.randint(2, 5))
        for f in followees:
            try:
                db.table("user_follows").insert({
                    "follower_id":  u["id"],
                    "following_id": f["id"],
                }).execute()
                fw_count += 1
            except Exception:
                pass
    print(f"  [ok] {fw_count} follows")

    # ── 8. Albums (1 público, 1 privado) ──────────────────
    print("\n=== Albums ===")
    al_count = 0
    for u in users[:6]:
        for kind, is_private in [("Momentos públicos", False), ("Galería privada", True)]:
            try:
                r = db.table("albums").insert({
                    "user_id":     u["id"],
                    "title":       kind,
                    "description": "Demo album",
                    "is_private":  is_private,
                }).execute()
                if not r.data:
                    continue
                album_id = r.data[0]["id"]
                # Subir 3 fotos al álbum
                for j in range(3):
                    img = fetch_image(seed=5000 + j + hash(album_id) % 1000)
                    res = await storage_service.upload_post_image(
                        image_bytes=img, user_id=u["id"], original_name=f"album_{j}.jpg"
                    )
                    db.table("album_photos").insert({
                        "album_id":     album_id,
                        "user_id":      u["id"],
                        "photo_url":    res["url"],
                        "storage_path": res["path"],
                        "display_order": j,
                    }).execute()
                al_count += 1
                print(f"  [ok] album '{kind}' by {u['first_name']} ({al_count})")
            except Exception as e:
                print(f"  [err] album err: {e}")

    print(f"\n[ok] Seed completo: {len(all_posts)} posts, {rx_count} reacciones, {cm_count} comentarios, {fw_count} follows, {al_count} albums")

asyncio.run(main())
