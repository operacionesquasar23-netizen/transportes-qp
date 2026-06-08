import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams.toString();
  const res = await fetch(`${API_URL}?${params}`, { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { action, ...body } = await req.json();
  const res = await fetch(`${API_URL}?action=${action}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data);
}