const siliconFlowBaseUrl = (
  process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1"
).replace(/\/$/, "");

const model = process.env.SILICONFLOW_MODEL || "Qwen/Qwen3-8B";
const upstreamUrl = `${siliconFlowBaseUrl}/chat/completions`;

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

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

function json(statusCode, payload) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  };
}

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

exports.handler = async function handler(event) {
  if (event.httpMethod === "GET") {
    return json(200, { ok: true, message: "translate function is alive" });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey) {
    return json(500, { error: "Missing SILICONFLOW_API_KEY" });
  }

  let sourceText = "";

  try {
    const body = JSON.parse(event.body || "{}");
    sourceText = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return json(400, { error: "请求格式不正确。" });
  }

  if (!sourceText) {
    return json(400, { error: "请输入需要翻译的原话。" });
  }

  if (sourceText.length > 2000) {
    return json(400, { error: "原话太长了，请控制在 2000 字以内。" });
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

      return json(502, {
        error: `翻译服务暂时不可用，请稍后再试。上游状态码：${upstreamResponse.status}`,
      });
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

      return json(502, { error: "翻译服务返回格式异常，请稍后再试。" });
    }

    const content = upstreamPayload.choices?.[0]?.message?.content || "{}";
    const parsed = extractJson(content);

    return json(200, {
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

    return json(502, { error: "翻译服务暂时不可用，请稍后再试。" });
  }
};
