import { NextRequest, NextResponse } from "next/server";

const locationStore = new Map<
  string,
  { lat: number; lng: number; riderName?: string; updatedAt: number }
>();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const { lat, lng, riderName } = body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json(
      { error: "lat and lng required" },
      { status: 400 },
    );
  }
  locationStore.set(id, { lat, lng, riderName, updatedAt: Date.now() });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  locationStore.delete(id);
  return NextResponse.json({ ok: true });
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const current = locationStore.get(id);

  if (!current) {
    return NextResponse.json({ type: "waiting" });
  }

  const isStale = Date.now() - current.updatedAt > 45000;
  if (isStale) {
    return NextResponse.json({ type: "stopped" });
  }

  return NextResponse.json({
    type: "location",
    lat: current.lat,
    lng: current.lng,
    riderName: current.riderName,
  });
}
