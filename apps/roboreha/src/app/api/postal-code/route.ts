import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const responseSchema = z.object({
  status: z.number(),
  message: z.string().nullable(),
  results: z.array(z.object({ address1: z.string(), address2: z.string(), address3: z.string() })).nullable(),
});

export async function GET(request: Request) {
  const postalCode = new URL(request.url).searchParams.get("postalCode")?.replace(/\D/g, "") ?? "";
  if (!/^\d{7}$/.test(postalCode)) return NextResponse.json({ error: "郵便番号は7桁で入力してください。" }, { status: 400 });

  try {
    const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "RoborehaDemo/1.0" },
    });
    if (!response.ok) throw new Error(`postal-code-provider-${response.status}`);
    const parsed = responseSchema.safeParse(await response.json());
    const result = parsed.success ? parsed.data.results?.[0] : undefined;
    if (!result) return NextResponse.json({ error: "該当する住所が見つかりませんでした。" }, { status: 404 });
    return NextResponse.json({
      postalCode,
      address: `${result.address1}${result.address2}${result.address3}`,
      source: "ZipCloud（日本郵便の郵便番号データを使用）",
    });
  } catch (error) {
    console.error("postal code lookup failed", error);
    return NextResponse.json({ error: "住所を検索できませんでした。住所は手入力できます。" }, { status: 502 });
  }
}
