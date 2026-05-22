"use client";

import {
  AlertCircle,
  ArrowRight,
  BookOpenText,
  Copy,
  LoaderCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

const defaultInput =
  "我们要先对齐目标，把方案颗粒度拉细，再和产品握手，最后形成闭环。";

const emptyResult = {
  translation: "翻译后会显示在这里。",
  intent: "",
  concepts: [],
  followUps: [],
};

const translateEndpoint = "/.netlify/functions/translate";

function buildNonJsonError(response, contentType, responseText) {
  const preview = responseText.slice(0, 300).replace(/\s+/g, " ").trim();

  return [
    "翻译接口没有返回 JSON。",
    `状态码：${response.status}`,
    `Content-Type：${contentType || "未提供"}`,
    `响应前 300 字符：${preview || "空响应"}`,
  ].join(" ");
}

export default function Home() {
  const [sourceText, setSourceText] = useState(defaultInput);
  const [result, setResult] = useState(emptyResult);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleTranslate = async () => {
    const text = sourceText.trim();

    setCopied(false);
    setError("");

    if (!text) {
      setResult(emptyResult);
      setError("先输入一句需要翻译的黑话。");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(translateEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      const responseText = await response.text();
      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.toLowerCase().includes("application/json");

      if (!isJson) {
        throw new Error(buildNonJsonError(response, contentType, responseText));
      }

      let payload;

      try {
        payload = JSON.parse(responseText);
      } catch (parseError) {
        const preview = responseText.slice(0, 300).replace(/\s+/g, " ").trim();
        throw new Error(
          `翻译接口返回了无效 JSON。状态码：${response.status}。解析错误：${parseError.message}。响应前 300 字符：${preview || "空响应"}`
        );
      }

      if (!response.ok) {
        throw new Error(payload.error || "翻译失败，请稍后再试。");
      }

      setResult({
        translation: payload.translation || "模型没有返回翻译结果。",
        intent: payload.intent || "",
        concepts: Array.isArray(payload.concepts) ? payload.concepts : [],
        followUps: Array.isArray(payload.followUps) ? payload.followUps : [],
      });
    } catch (requestError) {
      setResult(emptyResult);
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCopied(false);
    setError("");
    setSourceText("");
    setResult(emptyResult);
  };

  const handleCopy = async () => {
    if (!result.translation || result.translation === emptyResult.translation) return;

    await navigator.clipboard.writeText(result.translation);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main className="page-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Internet Jargon Translator</p>
            <h1>互联网黑话翻译器</h1>
          </div>
          <div className="status-pill">
            <Sparkles size={16} aria-hidden="true" />
            <span>国产大模型翻译</span>
          </div>
        </header>

        <section className="translator-grid" aria-label="黑话翻译工具">
          <div className="panel input-panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">左边输入</p>
                <h2>领导原话</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={handleReset}
                aria-label="清空输入"
                title="清空输入"
              >
                <RotateCcw size={18} aria-hidden="true" />
              </button>
            </div>

            <textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="例如：我们要先对齐目标，把方案颗粒度拉细，再和产品握手，最后形成闭环。"
              aria-label="输入互联网黑话原话"
              disabled={isLoading}
            />

            <button
              className="primary-button"
              type="button"
              onClick={handleTranslate}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoaderCircle className="spin-icon" size={18} aria-hidden="true" />
              ) : (
                <ArrowRight size={18} aria-hidden="true" />
              )}
              <span>{isLoading ? "翻译中" : "翻译"}</span>
            </button>
          </div>

          <div className="panel output-panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">右边输出</p>
                <h2>大白话翻译</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={handleCopy}
                aria-label="复制翻译结果"
                title="复制翻译结果"
                disabled={isLoading || result.translation === emptyResult.translation}
              >
                <Copy size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="translation-box" aria-live="polite">
              <p>{isLoading ? "模型正在判断语境..." : result.translation}</p>
            </div>

            {result.intent ? (
              <div className="intent-box">
                <strong>可能真实意思</strong>
                <p>{result.intent}</p>
              </div>
            ) : (
              <p className="copy-state">
                {copied ? "已复制翻译结果" : "可直接复制给听不懂黑话的同事"}
              </p>
            )}
          </div>
        </section>

        {error ? (
          <div className="error-alert" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="concept-section" aria-labelledby="concept-title">
          <div className="concept-header">
            <div>
              <p className="section-label">概念解析</p>
              <h2 id="concept-title">模型解析到的黑话</h2>
            </div>
            <BookOpenText size={24} aria-hidden="true" />
          </div>

          <div className="concept-list">
            {result.concepts.length > 0 ? (
              result.concepts.map((entry, index) => (
                <article className="concept-card" key={`${entry.term}-${index}`}>
                  <div className="concept-card-title">
                    <strong>{entry.term}</strong>
                    <span>{entry.plain}</span>
                  </div>
                  <p>{entry.explanation}</p>
                  <small>{entry.evidence}</small>
                </article>
              ))
            ) : (
              <article className="empty-state">
                <strong>等待模型解析</strong>
                <p>输入一句黑话后点击翻译，模型会结合整句话判断每个概念的真实含义。</p>
              </article>
            )}
          </div>

          {result.followUps.length > 0 ? (
            <div className="follow-up-box">
              <strong>可以追问领导</strong>
              <ul>
                {result.followUps.map((question, index) => (
                  <li key={`${question}-${index}`}>{question}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
