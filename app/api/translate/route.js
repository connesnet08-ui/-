export const runtime = "nodejs";

const siliconFlowBaseUrl = (
  process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1"
).replace(/\/$/, "");

const model = process.env.SILICONFLOW_MODEL || "Qwen/Qwen3-8B";
const upstreamUrl = `${siliconFlowBaseUrl}/chat/completions`;

const systemPrompt = [
  "你是一个中文职场语境翻译专家，专门把互联网公司黑话翻译成直白、具体、可执行的大白话。",
  "不要做机械词典替换，要结合整句话、上下文和常见职场语境判断真实含义。",
  "保留必要的业务名词、人名、项目名和数字；不要把所有词都过度翻译。",
  "如果原话里有空泛表达，要指出它大概率缺少哪些具体信息。",
  "语气要直接、清楚、略带口语，但不要恶意嘲讽。",
  "只解释原话中确实出现或强相关的概念，不要为了凑数量编造。",
  "只返回 JSON，不要返回 Markdown、代码块或额外说明。",
  "JSON 字段必须是 translation、intent、concepts、followUps。",
  "concepts 中每项必须包含 term、plain、explanation、evidence、confidence。",
  "confidence 只能是“高”“中”“低”。",
].join("\n");

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Invalid model JSON");
    }
    return JSON.parse(match[0]);
  }
}

function normalizeResult(parsed) {
  return {
    translation:
      typeof parsed.translation === "string" ? parsed.translation : "",
    intent: typeof parsed.intent === "string" ? parsed.intent : "",
    concepts: Array.isArray(parsed.concepts)
      ? parsed.concepts.slice(0, 6).map((concept) => ({
          term: typeof concept.term === "string" ? concept.term : "",
          plain: typeof concept.plain === "string" ? concept.plain : "",
          explanation:
            typeof concept.explanation === "string" ? concept.explanation : "",
          evidence: typeof concept.evidence === "string" ? concept.evidence : "",
          confidence:
            concept.confidence === "高" ||
            concept.confidence === "中" ||
            concept.confidence === "低"
              ? concept.confidence
              : "中",
        }))
      : [],
    followUps: Array.isArray(parsed.followUps)
      ? parsed.followUps
          .filter((item) => typeof item === "string")
          .slice(0, 3)
      : [],
  };
}

function logUpstreamFailure({ status, body, error }) {
  console.error("SiliconFlow upstream failure", {
    status,
    body,
    model,
    upstreamUrl,
    error: error instanceof Error ? error.message : undefined,
  });
}

export async function POST(request) {
  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "Missing SILICONFLOW_API_KEY" },
      { status: 500 }
    );
  }

  let sourceText = "";

  try {
    const body = await request.json();
    sourceText = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return Response.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  if (!sourceText) {
    return Response.json({ error: "请输入需要翻译的原话。" }, { status: 400 });
  }

  if (sourceText.length > 2000) {
    return Response.json(
      { error: "原话太长了，请控制在 2000 字以内。" },
      { status: 400 }
    );
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `请翻译这句互联网黑话：\n${sourceText}`,
          },
        ],
        max_tokens: 1200,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    const upstreamText = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      logUpstreamFailure({
        status: upstreamResponse.status,
        body: upstreamText,
      });

      return Response.json(
        {
          error: `翻译服务暂时不可用，请稍后再试。上游状态码：${upstreamResponse.status}`,
        },
        { status: 502 }
      );
    }

    let upstreamPayload;

    try {
      upstreamPayload = JSON.parse(upstreamText);
    } catch (error) {
      logUpstreamFailure({
        status: upstreamResponse.status,
        body: upstreamText,
        error,
      });

      return Response.json(
        { error: "翻译服务返回格式异常，请稍后再试。" },
        { status: 502 }
      );
    }

    const content = upstreamPayload.choices?.[0]?.message?.content || "{}";
    const parsed = extractJson(content);

    return Response.json({
      ...normalizeResult(parsed),
      model,
      provider: "SiliconFlow",
    });
  } catch (error) {
    logUpstreamFailure({
      status: "request_failed",
      body: "",
      error,
    });

    return Response.json(
      { error: "翻译服务暂时不可用，请稍后再试。" },
      { status: 502 }
    );
  }
}
