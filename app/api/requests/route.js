import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getRedis } from "@/lib/redis";

export async function POST(req) {
  try {
    const body = await req.json();
    const studentName =
      typeof body?.student_name === "string" ? body.student_name.trim() : "";
    const requestMessage =
      typeof body?.message === "string" ? body.message.trim() : "";

    if (!studentName || !requestMessage) {
      return NextResponse.json(
        {
          success: false,
          error: "student_name and message are required",
        },
        { status: 400 }
      );
    }

    if (studentName.length > 50 || requestMessage.length > 200) {
      return NextResponse.json(
        {
          success: false,
          error: "Student name must be 50 characters or fewer and message must be 200 characters or fewer",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO help_requests
       (student_name, message)
       VALUES ($1, $2)
       RETURNING id`,
      [studentName, requestMessage]
    );

    try {
      const redis = await getRedis();
      await redis.del("help:latest");
    } catch (error) {
      console.error("Redis invalidation failed:", error.message);
    }

    return NextResponse.json({
      success: true,
      id: result.rows[0].id,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to post request",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    try {
      const redis = await getRedis();
      const cached = await redis.get("help:latest");

      if (cached) {
        return NextResponse.json({
          source: "Redis",
          requests: JSON.parse(cached),
        });
      }
    } catch (error) {
      console.error("Redis read failed:", error);
    }

    const result = await pool.query(
      `SELECT id, student_name, message, created_at
       FROM help_requests
       ORDER BY created_at DESC
       LIMIT 10`
    );

    try {
      const redis = await getRedis();

      await redis.set(
        "help:latest",
        JSON.stringify(result.rows),
        { EX: 60 }
      );
    } catch (error) {
      console.error("Redis cache failed:", error);
    }

    return NextResponse.json({
      source: "PostgreSQL",
      requests: result.rows,
    });

  } catch (error) {
    console.error("Unable to fetch requests:", error);

    return NextResponse.json(
      { success: false, error: "Unable to fetch requests" },
      { status: 500 }
    );
  }
}