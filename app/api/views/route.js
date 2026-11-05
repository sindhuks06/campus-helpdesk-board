import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export async function GET() {
  try {
    const redis = await getRedis();

    const views = await redis.incr("help");

    return NextResponse.json({ success: true, views });

  } catch (error) {
    console.error("Unable to update board views:", error);

    return NextResponse.json(
      {
        success: false,
        views: null,
        error: "Board views are temporarily unavailable",
      },
      { status: 200 }
    );
  }
}