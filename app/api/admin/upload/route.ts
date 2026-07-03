import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { isAuthed } from "@/lib/adminAuth";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const BUCKET = "eec-assets";
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function supabaseBase(): string | null {
  const url = process.env.SUPABASE_URL;
  return url ? url.replace(/\/$/, "") : null;
}

/** Upload to Supabase Storage; returns the public URL. */
async function uploadToSupabase(
  objectPath: string,
  bytes: Buffer,
  contentType: string
): Promise<string> {
  const base = supabaseBase();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) throw new Error("Supabase is not configured.");

  const res = await fetch(
    `${base}/storage/v1/object/${BUCKET}/${objectPath}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase Storage upload failed (${res.status}). ${body}`);
  }
  return `${base}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

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

  const filename = `cover-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  // Primary: Supabase Storage (works on serverless / Vercel).
  if (supabaseBase() && process.env.SUPABASE_SECRET_KEY) {
    try {
      const url = await uploadToSupabase(`covers/${filename}`, bytes, file.type);
      return NextResponse.json({ ok: true, path: url });
    } catch (err) {
      console.error("[upload] supabase failed:", err);
      return NextResponse.json(
        { error: "Could not upload the image to storage. Please try again." },
        { status: 500 }
      );
    }
  }

  // Fallback: local filesystem (dev only, when Supabase isn't configured).
  try {
    const dir = path.join(process.cwd(), "public", "assets", "uploads");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), bytes);
    return NextResponse.json({ ok: true, path: `/assets/uploads/${filename}` });
  } catch (err) {
    console.error("[upload] fs failed:", err);
    return NextResponse.json(
      {
        error:
          "Could not save the image. Configure Supabase for uploads on serverless.",
      },
      { status: 500 }
    );
  }
}
