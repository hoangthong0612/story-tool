import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(`https://labs.google/fx/api/auth/session`, {
      headers: {
        // 👇 Chỉ server mới được quyền gắn cookie header
        Cookie: process.env.NEXT_PUBLIC_COOKIE_NAME ?? "",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ status: 0, message: "Không có dữ liệu" });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ status: 0, message: "Lỗi proxy" });
  }
}
