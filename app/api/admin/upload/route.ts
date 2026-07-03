import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { isAuthed } from "@/lib/adminAuth";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export async function POST(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PNG, JPG, WEBP, GIF or SVG." },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "Empty file." }, { status: 400 });
  }
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 5 MB)." },
      { status: 400 }
    );
  }

  const dir = path.join(process.cwd(), "public", "assets", "uploads");
  try {
    await fs.mkdir(dir, { recursive: true });
    const filename = `cover-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    await fs.writeFile(path.join(dir, filename), bytes);
    const publicPath = `/assets/uploads/${filename}`;
    return NextResponse.json({ ok: true, path: publicPath });
  } catch (err) {
    console.error("[upload] failed:", err);
    return NextResponse.json(
      {
        error:
          "Could not save the image. The server filesystem may be read-only (e.g. on serverless).",
      },
      { status: 500 }
    );
  }
}
