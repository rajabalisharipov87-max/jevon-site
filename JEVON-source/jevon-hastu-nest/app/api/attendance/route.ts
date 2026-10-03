import { NextResponse } from "next/server";
const APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbxk6H7ar_7uCjt2cHJ9Sw1_RJKhGg7LOU3F6GpQzRVgUoDojjZFLkxH50m2xBJa1Deh/exec";
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" ||
        !("code" in body) || typeof body.code !== "string" || !/^\d{4}$/.test(body.code) ||
        !("action" in body) || (body.action !== "IN" && body.action !== "OUT") ||
        !("photoData" in body) || typeof body.photoData !== "string" || !body.photoData) {
      return NextResponse.json({ ok: false, message: "Маълумоти зарурӣ нопурра аст." }, { status: 400 });
    }
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ code: body.code, action: body.action, photoData: body.photoData }),
      redirect: "follow",
    });
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("ok" in data) || typeof data.ok !== "boolean") {
      throw new Error("Сервер ҷавоби нодуруст дод.");
    }
    return NextResponse.json(data, { status: data.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Хатогии сервер." }, { status: 500 });
  }
}
