import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("key") !== process.env.USAGE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const db = mongoose.connection.db!;

  // ── MongoDB stats ──────────────────────────────────────────────────────────
  const dbStats = (await db.command({ dbStats: 1 })) as Record<string, number>;
  const collections = [
    "orders",
    "menuitems",
    "redemptions",
    "posts",
    "accounts",
  ];

  const colStats = await Promise.all(
    collections.map(async (name) => {
      try {
        const s = (await db.command({ collStats: name })) as Record<
          string,
          number
        >;
        const sizeKB = Math.round((s.size ?? 0) / 1024);
        return {
          name,
          count: s.count ?? 0,
          sizeKB,
          avgDocKB: s.count ? Math.round((s.size ?? 0) / s.count / 1024) : 0,
        };
      } catch {
        return { name, count: 0, sizeKB: 0, avgDocKB: 0 };
      }
    }),
  );

  // ── R2 stats ───────────────────────────────────────────────────────────────
  let r2Files = 0;
  let r2Bytes = 0;
  let continuationToken: string | undefined;

  try {
    do {
      const res = await r2.send(
        new ListObjectsV2Command({
          Bucket: process.env.R2_BUCKET_NAME!,
          ContinuationToken: continuationToken,
        }),
      );
      r2Files += res.KeyCount ?? 0;
      for (const obj of res.Contents ?? []) r2Bytes += obj.Size ?? 0;
      continuationToken = res.IsTruncated
        ? res.NextContinuationToken
        : undefined;
    } while (continuationToken);
  } catch (err) {
    console.error("R2 list error:", err);
  }

  // ── Order age breakdown ────────────────────────────────────────────────────
  const now = new Date();
  const cutoffs = [7, 14, 30, 60, 90];
  const ageBuckets = await Promise.all(
    cutoffs.map(async (days) => {
      const before = new Date(now.getTime() - days * 86_400_000);
      const count = await db
        .collection("orders")
        .countDocuments({ createdAt: { $lt: before } });
      return { days, count };
    }),
  );

  return NextResponse.json({
    mongo: {
      storageMB: Math.round((dbStats.dataSize ?? 0) / (1024 * 1024)),
      limitMB: 512,
      collections: colStats,
    },
    r2: {
      files: r2Files,
      sizeMB: Math.round(r2Bytes / (1024 * 1024)),
      limitMB: 10240,
    },
    ageBuckets,
    ts: Date.now(),
  });
}
