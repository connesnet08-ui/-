const siliconFlowBaseUrl = (
  process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1"
).replace(/\/$/, "");

const model = process.env.SILICONFLOW_MODEL || "Qwen/Qwen3-8B";
const upstreamUrl = `${siliconFlowBaseUrl}/chat/completions`;
const timeoutMs = 18000;

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const systemPrompt =
  "你是一个职场黑话翻译器。把用户输入的领导黑话翻译成简短、直接、普通人能听懂的大白话。只输出翻译结果，不要解释，不要列步骤，不要加标题。";

function json(statusCode, payload) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  };
}

function logUpstreamFailure({ status, body, error, timeout = false }) {
  console.error("SiliconFlow upstream failure", {
    status,
    body: typeof body === "string" ? body.slice(0, 300) : "",
    model,
    timeout,
    error: error instanceof Error ? error.message : undefined,
  });
}

function stripThinkTags(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      signal: controller.signal,
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
            content: sourceText,
          },
        ],
        enable_thinking: false,
        max_tokens: 160,
        temperature: 0.1,
        stream: false,
      }),
    });

    clearTimeout(timeout);

    const upstreamText = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      logUpstreamFailure({
        status: upstreamResponse.status,
        body: upstreamText,
      });

      return json(502, {
        error: "SiliconFlow upstream failure",
        status: upstreamResponse.status,
        detail: upstreamText.slice(0, 300),
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

    const content = upstreamPayload.choices?.[0]?.message?.content;
    const translation =
      typeof content === "string" ? stripThinkTags(content) : "";

    return json(200, {
      translation: translation || "模型没有返回翻译结果。",
      intent: "",
      concepts: [],
      followUps: [],
      model,
      provider: "SiliconFlow",
    });
  } catch (error) {
    clearTimeout(timeout);

    const isTimeout = error instanceof Error && error.name === "AbortError";

    logUpstreamFailure({
      status: isTimeout ? "timeout" : "request_failed",
      body: "",
      error,
      timeout: isTimeout,
    });

    if (isTimeout) {
      return json(504, {
        error: "模型响应超时，请再试一次。",
      });
    }

    return json(502, { error: "翻译服务暂时不可用，请稍后再试。" });
  }
};
