import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(`https://labs.google/fx/api/trpc/media.createOrUpdateWorkflow`, {
      method: "POST",
      headers: {
        // 👇 Chỉ server mới được quyền gắn cookie header
        Cookie: process.env.NEXT_PUBLIC_COOKIE_NAME ?? "",
      },
      body: JSON.stringify({
        "json": {
          "clientContext": {
            "tool": "BACKBONE",
            "sessionId": ";" + Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join('')
          },
          "mediaGenerationIdsToCopy": [],
          "workflowMetadata": {
            "workflowName": "workflow_" + Date.now(),
          }
        }
      })
    });

    if (!res.ok) {
      return NextResponse.json({ status: 0, message: "Không có dữ liệu" });
    }

    const data = await res.json();

    return NextResponse.json({ status: 1, workflowId: data.result.data.json.result.workflowId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ status: 0, message: "Lỗi proxy" });
  }
}
