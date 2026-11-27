import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

/** InBody(체성분 분석) 결과지 사진에서 추출할 7개 필드 — body_measurements 쓰기 가능 컬럼과 1:1 대응 */
const InBodySchema = z.object({
  measured_at: z
    .string()
    .nullable()
    .describe("측정일, YYYY-MM-DD 형식. 이미지에서 안 보이면 null"),
  weight_kg: z.number().nullable().describe("체중(kg). 안 보이면 null"),
  skeletal_muscle_kg: z.number().nullable().describe("골격근량(kg). 안 보이면 null"),
  body_fat_kg: z.number().nullable().describe("체지방량(kg). 안 보이면 null"),
  body_fat_pct: z.number().nullable().describe("체지방률(%). 안 보이면 null"),
  whr: z.number().nullable().describe("복부지방률 WHR(허리엉덩이둘레비). 안 보이면 null"),
  bmr_kcal: z.number().nullable().describe("기초대사량(kcal). 안 보이면 null"),
});

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "서버에 ANTHROPIC_API_KEY가 설정되어 있지 않습니다. 환경변수를 추가한 뒤 다시 시도해 주세요." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("image");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "이미지 파일이 없습니다" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "빈 파일입니다" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "이미지 파일이 너무 큽니다 (8MB 이하로 올려주세요)" }, { status: 400 });
    }

    const mediaType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const client = new Anthropic({ apiKey });

    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                data: base64,
              },
            },
            {
              type: "text",
              text:
                "이 이미지는 InBody(체성분 분석기) 결과지입니다. " +
                "체중, 골격근량, 체지방량, 체지방률, 복부지방률(WHR), 기초대사량(BMR), 측정일을 읽어서 추출하세요. " +
                "이미지에서 명확히 읽히지 않는 항목은 절대 추측하지 말고 null로 반환하세요.",
            },
          ],
        },
      ],
      output_config: {
        format: zodOutputFormat(InBodySchema),
      },
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return NextResponse.json({ error: "이미지에서 수치를 인식하지 못했습니다. 더 선명한 사진으로 다시 시도해 주세요." }, { status: 422 });
    }

    return NextResponse.json({
      ...parsed,
      measured_at: parsed.measured_at || new Date().toISOString().slice(0, 10),
    });
  } catch (e) {
    return NextResponse.json({ error: "인식 중 오류가 발생했습니다: " + String(e) }, { status: 500 });
  }
}
