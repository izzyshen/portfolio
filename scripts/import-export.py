"""Bake a browser export (scripts/export-content.js output) into the repo.

  python3 scripts/import-export.py ~/Downloads/portfolio-export.json

Writes public/media/<key>.<ext> for every uploaded file, rewrites `idb:` refs to
those paths, and writes content/seed.json = { home, projects, articles }, which
the templates use as the default content every visitor sees.
"""
import base64, json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXT = {"image/png": "png", "image/webp": "webp", "image/jpeg": "jpg", "image/gif": "gif",
       "video/quicktime": "mov", "video/mp4": "mp4", "video/webm": "webm"}

d = json.load(open(sys.argv[1]))
text, media = d["text"], d["media"]

# 1. media → public/media
paths = {}
for key, data_url in media.items():
    m = re.match(r"data:([^;]+);base64,(.*)$", data_url, re.S)
    ext = EXT.get(m.group(1), "bin")
    out = ROOT / "public" / "media" / f"{key}.{ext}"
    out.write_bytes(base64.b64decode(m.group(2)))
    paths[key] = f"/media/{key}.{ext}"

def rewrite(s: str) -> str:
    return re.sub(r"idb:([a-z0-9]+-[a-z0-9]+)", lambda m: paths.get(m.group(1), m.group(0)), s)

# 2. text → seed
seed = {"home": None, "projects": {}, "articles": {}}
for key, raw in text.items():
    val = json.loads(rewrite(raw))
    if key == "portfolio-home":
        for s in val["sections"]:
            if s["id"] == "thoughts" and s["label"] == "Thoughts": s["label"] = "Blog"
            if s["id"] == "creatives" and s["label"] == "Creatives": s["label"] = "Exploration"
            # a row with no label renders as a blank line — drop it
            s["items"] = [it for it in s["items"] if it["label"].strip()]
        seed["home"] = val
    elif key.startswith("portfolio-project-"):
        seed["projects"][key[len("portfolio-project-"):]] = val
    elif key.startswith("portfolio-article-"):
        seed["articles"][key[len("portfolio-article-"):]] = val

(ROOT / "content" / "seed.json").write_text(json.dumps(seed, indent=1, ensure_ascii=False) + "\n")
print(f"media: {len(paths)} files → public/media; projects: {len(seed['projects'])}; articles: {len(seed['articles'])}; home: {bool(seed['home'])}")
leftover = re.findall(r"idb:[a-z0-9-]+", json.dumps(seed))
print("unresolved idb refs:", leftover or "none")
