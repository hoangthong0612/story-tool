import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { workflowId, prompt, characters }: { workflowId: string; prompt: string; characters: any[];  } = await request.json();
        if (!workflowId || !prompt) {
            return NextResponse.json({ status: 0, message: "Thiếu tham số" }, { status: 400 });
        }

        // Get token server-side from session endpoint with cookie
        const sessionRes = await fetch(`https://labs.google/fx/api/auth/session`, {
            headers: {
                Cookie: process.env.NEXT_PUBLIC_COOKIE_NAME ?? "",
            },
        });
        if (!sessionRes.ok) {
            return NextResponse.json({ status: 0, message: "Không thể lấy token" }, { status: 502 });
        }
        const sessionData = await sessionRes.json();
        const token = sessionData?.access_token as string | undefined;
        if (!token) {
            return NextResponse.json({ status: 0, message: "Token không hợp lệ" }, { status: 401 });
        }
        console.log("Characters for image generation:", characters[0].id);
        const imageParts: any[] = [];
        characters.forEach((character: any) => {
            if (character.refImageBase64) {
                imageParts.push(
                    {
                        "mediaInput": {
                            "mediaCategory": "MEDIA_CATEGORY_SUBJECT",
                            "mediaGenerationId": character.id
                        }
                    }
                );
            }
        });


        const res = await fetch(`https://aisandbox-pa.googleapis.com/v1/whisk:runImageRecipe`, {
            method: "POST",
            headers: {
                authorization: 'Bearer ' + token,
            },
            body: JSON.stringify({
                "clientContext": {
                    "workflowId": workflowId,
                    "tool": "BACKBONE",
                    "sessionId": ";" + Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join('')
                },
                "seed": 1000000,
                "imageModelSettings": {
                    "imageModel": "R2I",
                    "aspectRatio": "IMAGE_ASPECT_RATIO_LANDSCAPE"
                },
                "userInstruction": prompt,
                "recipeMediaInputs": imageParts
            })
        });
        console.log(JSON.stringify({
            "clientContext": {
                "workflowId": workflowId,
                "tool": "BACKBONE",
                "sessionId": ";" + Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join('')
            },
            "seed": 1000000,
            "imageModelSettings": {
                "imageModel": "R2I",
                "aspectRatio": "IMAGE_ASPECT_RATIO_LANDSCAPE"
            },
            "userInstruction": prompt,
            "recipeMediaInputs": imageParts
        }));

        if (!res.ok) {
            return NextResponse.json({ status: 0, message: "Không có dữ liệu" }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        console.log('Error during image generation:', err);
        return NextResponse.json({ status: 0, message: "Lỗi proxy" }, { status: 500 });
    }
}