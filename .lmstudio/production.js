"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../Users/VU-W11/.lmstudio/extensions/plugins/anhuvdinh/better-searxng-search/src/config.ts
var import_sdk, configSchematics;
var init_config = __esm({
  "../../Users/VU-W11/.lmstudio/extensions/plugins/anhuvdinh/better-searxng-search/src/config.ts"() {
    "use strict";
    import_sdk = require("@lmstudio/sdk");
    configSchematics = (0, import_sdk.createConfigSchematics)().field(
      "searxngUrl",
      "string",
      {
        displayName: "SearXNG URL",
        subtitle: "Base URL of your local SearXNG instance"
      },
      "http://localhost:8081"
      // Default value as 4th parameter
    ).field(
      "defaultPageSize",
      "numeric",
      {
        displayName: "Default Results Count",
        subtitle: "Number of results to return (1-20)",
        min: 1,
        max: 20
      },
      10
      // Default value as 4th parameter
    ).field(
      "timeout",
      "numeric",
      {
        displayName: "Request Timeout (ms)",
        subtitle: "Timeout for SearXNG requests",
        min: 1e3,
        max: 6e4
      },
      1e4
      // Default value as 4th parameter
    ).field(
      "waitCaptchaTimeout",
      "numeric",
      {
        displayName: "Timeout for Captcha Detection (ms)",
        subtitle: "Timeout for SearXNG to detect Captcha and find another source",
        min: 0,
        max: 6e4
      },
      3e3
      // Default value as 4th parameter
    ).build();
  }
});

// ../../Users/VU-W11/.lmstudio/extensions/plugins/anhuvdinh/better-searxng-search/src/toolsProvider.ts
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function normalizeForDetection(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
function detectActiveChallenge(text) {
  const normalized = normalizeForDetection(text);
  const challengePatterns = [
    [
      /verify (?:you'?re|you are) human/,
      "active human verification"
    ],
    [
      /verifying (?:you'?re|you are) human/,
      "active human verification"
    ],
    [
      /please verify (?:you'?re|you are) human/,
      "active human verification"
    ],
    [
      /are you (?:a )?robot/,
      "active robot verification"
    ],
    [
      /prove (?:you'?re|you are) not a robot/,
      "active robot verification"
    ],
    [
      /i am not a robot/,
      "active robot verification"
    ],
    [
      /i'?m not a robot/,
      "active robot verification"
    ],
    [
      /checking your browser/,
      "browser verification"
    ],
    [
      /checking if you'?re human/,
      "human verification"
    ],
    [
      /checking if you are human/,
      "human verification"
    ],
    [
      /please wait while we verify/,
      "verification process"
    ],
    [
      /complete (?:the )?(?:captcha|challenge)/,
      "CAPTCHA/challenge instruction"
    ],
    [
      /complete the security check/,
      "security check"
    ],
    [
      /click to verify/,
      "verification instruction"
    ],
    [
      /press and hold to verify/,
      "press-and-hold verification"
    ],
    [
      /press and hold to continue/,
      "press-and-hold verification"
    ],
    [
      /drag the slider/,
      "slider verification"
    ],
    [
      /drag the handle/,
      "slider verification"
    ],
    [
      /move the puzzle piece/,
      "puzzle verification"
    ],
    [
      /complete the puzzle/,
      "puzzle verification"
    ],
    [
      /select all images/,
      "image verification"
    ],
    [
      /select all squares/,
      "image verification"
    ],
    [
      /select all the (?:images|squares|pictures)/,
      "image verification"
    ],
    [
      /which image matches/,
      "image verification"
    ],
    [
      /which item matches/,
      "selection verification"
    ],
    [
      /which item doesn'?t belong/,
      "selection verification"
    ]
  ];
  for (const [pattern, reason] of challengePatterns) {
    if (pattern.test(normalized)) {
      return reason;
    }
  }
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const explicitChallengeInstruction = /\bverify\s+(?:that\s+)?(?:you(?:'re| are)|yourself)\s+(?:are\s+)?human\b/i.test(normalized) || /\bi\s*(?:am|'m)\s+not\s+a\s+robot\b/i.test(normalized) || /\b(?:select|choose)\s+all\s+(?:the\s+)?(?:images|squares|tiles)\b/i.test(normalized) || /\b(?:move|drag)\s+(?:the\s+)?(?:slider|puzzle\s+piece)\b/i.test(normalized) || /\b(?:press|click)\s+and\s+hold\s+(?:to\s+)?verify\b/i.test(normalized) || /\bcomplete\s+(?:the\s+)?(?:captcha|challenge|verification)\b/i.test(normalized);
  const hasCaptcha = /\b(?:captcha|recaptcha|hcaptcha)\b/i.test(normalized);
  const hasTurnstile = /\bturnstile\b/i.test(normalized);
  const hasChallengeContext = /\b(?:challenge|verification|verify|human|robot)\b/i.test(normalized);
  if (explicitChallengeInstruction) {
    return "active verification challenge detected";
  }
  if (wordCount < 150 && (hasCaptcha && hasChallengeContext || hasTurnstile && hasChallengeContext)) {
    return "active verification challenge detected";
  }
  return null;
}
function selectRelevantContent(content, query, maxLength = 6e3) {
  if (content.length <= maxLength) {
    return content;
  }
  const stopWords = new Set((0, import_datasets_stopwords_en.default)());
  const terms = query.toLowerCase().replace(/[^\p{L}\p{N}\s.-]/gu, " ").split(/\s+/).filter(
    (term) => term.length >= 3 && !stopWords.has(term)
  );
  const queryPhrase = query.toLowerCase().replace(/[^\p{L}\p{N}\s.-]/gu, " ").replace(/\s+/g, " ").trim();
  if (terms.length === 0) {
    return content.substring(0, maxLength).trim() + "\n...[source truncated]";
  }
  const paragraphs = content.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean);
  const scored = paragraphs.map((paragraph, index) => {
    const lower = paragraph.toLowerCase();
    let score = 0;
    if (queryPhrase.length >= 4 && lower.includes(queryPhrase)) {
      score += 5;
    }
    for (const term of terms) {
      const matches = lower.split(term).length - 1;
      score += Math.min(matches, 3);
    }
    return {
      index,
      paragraph,
      score
    };
  });
  const relevant = scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  if (relevant.length === 0) {
    return content.substring(0, maxLength).trim() + "\n...[source truncated]";
  }
  const selected = /* @__PURE__ */ new Set();
  let totalLength = 0;
  for (const item of relevant) {
    const start = Math.max(0, item.index - 1);
    const end = Math.min(
      paragraphs.length - 1,
      item.index + 1
    );
    for (let i = start; i <= end; i++) {
      if (selected.has(i)) continue;
      const addition = paragraphs[i] + "\n\n";
      if (totalLength + addition.length > maxLength) {
        continue;
      }
      selected.add(i);
      totalLength += addition.length;
    }
    if (totalLength >= maxLength * 0.95) {
      break;
    }
  }
  const result = Array.from(selected).sort((a, b) => a - b).map((index) => paragraphs[index]).join("\n\n");
  return result.trim() + (result.length < content.length ? "\n...[source truncated]" : "");
}
function extractText(html) {
  let text = html;
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ").replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ").replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const candidates = [];
  const mainMatches = text.match(
    /<main\b[^>]*>([\s\S]*?)<\/main>/gi
  );
  const articleMatches = text.match(
    /<article\b[^>]*>([\s\S]*?)<\/article>/gi
  );
  if (mainMatches) candidates.push(...mainMatches);
  if (articleMatches) candidates.push(...articleMatches);
  if (candidates.length > 0) {
    text = candidates.sort((a, b) => b.length - a.length)[0];
  }
  text = text.replace(
    /<nav\b[^>]*>[\s\S]*?<\/nav>/gi,
    " "
  ).replace(
    /<footer\b[^>]*>[\s\S]*?<\/footer>/gi,
    " "
  ).replace(
    /<aside\b[^>]*>[\s\S]*?<\/aside>/gi,
    " "
  ).replace(
    /<form\b[^>]*>[\s\S]*?<\/form>/gi,
    " "
  );
  text = text.replace(
    /<\/(?:p|div|section|article|main|h1|h2|h3|h4|h5|h6|li|tr)>/gi,
    "\n"
  ).replace(
    /<br\s*\/?>/gi,
    "\n"
  );
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
  text = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
  return text;
}
async function fetchCandidate(result, timeout, query, sourceIndex, waitCaptcha) {
  let domain;
  try {
    domain = new URL(result.url).hostname;
  } catch {
    return {
      usable: false,
      reason: "invalid URL"
    };
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      timeout
    );
    const response = await fetch(result.url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7"
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (response.status === 401) {
      return {
        usable: false,
        reason: "HTTP 401 Unauthorized"
      };
    }
    if (response.status === 403) {
      return {
        usable: false,
        reason: "HTTP 403 Forbidden \u2014 page inaccessible"
      };
    }
    if (response.status === 429) {
      return {
        usable: false,
        reason: "HTTP 429 Too Many Requests \u2014 rate limited"
      };
    }
    if (response.status >= 500) {
      return {
        usable: false,
        reason: `HTTP ${response.status} ${response.statusText} \u2014 server error`
      };
    }
    if (!response.ok) {
      return {
        usable: false,
        reason: `HTTP ${response.status} ${response.statusText}`
      };
    }
    await sleep(waitCaptcha);
    const html = await response.text();
    const inspectionText = html.substring(0, 1e5);
    const challenge = detectActiveChallenge(
      inspectionText
    );
    if (challenge) {
      return {
        usable: false,
        reason: `active verification challenge detected: ${challenge}`
      };
    }
    let content = extractText(html);
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    if (wordCount < 150) {
      return {
        usable: false,
        reason: `insufficient readable page content (${wordCount} words)`
      };
    }
    const contentLimits = [
      3e3,
      3e3,
      1800,
      1800,
      1800
    ];
    const contentLimit = contentLimits[Math.min(
      sourceIndex,
      contentLimits.length - 1
    )];
    content = selectRelevantContent(
      content,
      query,
      contentLimit
    );
    return {
      usable: true,
      title: result.title,
      url: result.url,
      domain,
      engine: result.engine,
      score: result.score,
      content
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        usable: false,
        reason: `request timed out after ${timeout}ms`
      };
    }
    return {
      usable: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}
async function toolsProvider(ctl) {
  const tools = [];
  const config = ctl.getPluginConfig(
    configSchematics
  );
  const searxngUrl = config.get(
    "searxngUrl"
  );
  const defaultPageSize = config.get(
    "defaultPageSize"
  );
  const timeout = config.get(
    "timeout"
  );
  const waitCaptcha = config.get(
    "waitCaptchaTimeout"
  );
  const searchTool = (0, import_sdk2.tool)({
    name: "search_web",
    description: "Limited web search using SearXNG. Returns snippets only and should be used only when full webpage research is unavailable. For factual, detailed, current, comparative, or research questions, use research_web instead.",
    parameters: {
      query: import_zod.z.string().describe(
        "The search query string"
      ),
      num_results: import_zod.z.number().min(1).max(20).optional().describe(
        `Number of results to return (1-20). Default: ${defaultPageSize}`
      ),
      time_range: import_zod.z.string().optional().describe(
        "Optional time filter: 'day', 'week', 'month', or 'year'"
      ),
      page: import_zod.z.number().int().min(1).optional().describe(
        "SearXNG result page to research. Default: 1."
      )
    },
    implementation: async (params) => {
      try {
        const {
          query,
          num_results,
          time_range,
          page = 1
        } = params;
        const pageSize = num_results ?? defaultPageSize;
        const searchParams = new URLSearchParams({
          q: query,
          format: "json",
          pageno: String(page),
          safesearch: "0"
        });
        const normalizedTimeRange = time_range?.toLowerCase().trim();
        if (normalizedTimeRange) {
          const validRanges = [
            "day",
            "week",
            "month",
            "year"
          ];
          if (validRanges.includes(
            normalizedTimeRange
          )) {
            searchParams.append(
              "time_range",
              normalizedTimeRange
            );
          }
        }
        const searchUrl = `${searxngUrl}/search?${searchParams.toString()}`;
        console.log(
          `Querying SearXNG: ${searchUrl.replace(
            /format=json/,
            "format=..."
          )}`
        );
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          timeout
        );
        const response = await fetch(searchUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "LM-Studio-Plugin/1.0"
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(
            `SearXNG returned status ${response.status}: ${response.statusText}`
          );
        }
        const data = await response.json();
        if (!data.results || data.results.length === 0) {
          return `No results found for query: "${query}"`;
        }
        const formattedResults = data.results.slice(0, pageSize).map(
          (result, index) => `[${index + 1}] ${result.title}
URL: ${result.url}
Snippet: ${result.content.substring(
            0,
            300
          )}${result.content.length > 300 ? "..." : ""}
Source: ${result.engine}`
        ).join("\n\n");
        return `Search results for "${query}" (${Math.min(
          data.results.length,
          pageSize
        )} of ${data.number_of_results} total):

` + formattedResults + "\n\nNote: These results are from SearXNG metasearch engine aggregating multiple sources.";
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return `Error: SearXNG request timed out after ${timeout}ms. Check that SearXNG is running at ${searxngUrl}.`;
        }
        return `Error searching SearXNG: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  });
  const fetchPageTool = (0, import_sdk2.tool)({
    name: "fetch_page_content",
    description: "Fetch and extract text content from a specific URL.",
    parameters: {
      url: import_zod.z.string().url().describe(
        "The URL to fetch"
      ),
      max_length: import_zod.z.number().min(100).max(1e4).optional().describe(
        "Maximum characters to return. Default: 2000."
      )
    },
    implementation: async (params) => {
      try {
        const {
          url,
          max_length
        } = params;
        const maxLength = max_length ?? 2e3;
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LM-Studio-Bot/1.0)"
          }
        });
        if (!response.ok) {
          return `Failed to fetch ${url}: ${response.status} ${response.statusText}`;
        }
        const html = await response.text();
        let text = extractText(html);
        if (text.length > maxLength) {
          text = text.substring(
            0,
            maxLength
          ) + "... [truncated]";
        }
        return `Content from ${url}:

${text}`;
      } catch (error) {
        return `Error fetching page: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  });
  const researchTool = (0, import_sdk2.tool)({
    name: "research_web",
    description: "Primary web research tool using local SearXNG. Use for factual, detailed, current, or comparative questions. Fetches and reads actual webpages, not snippets, and collects up to 5 usable sources. Snippets are primarily only for added context. Rejects inaccessible pages and active verification challenges. Compare multiple sources and answer from the returned SOURCE content. For all factual claims, include a Markdown link to its supporting SOURCE immediately after the claim. Use the SOURCE title as the link text, including the article's date if available. Only link to URLs present in the returned SOURCE list. If no usable webpages are found on page 1, ask whether the user wants the available snippets or the next 15 candidates from page 2. Afterwards, wait for their answer. If the user requests the next results, call this tool again with page 2. Do not automatically use snippets unless the user chooses them. Present distinct news stories separately rather than combining them into a single narrative.",
    parameters: {
      query: import_zod.z.string().describe(
        "The topic or question to research"
      ),
      sources: import_zod.z.number().min(1).max(5).optional().describe(
        "Number of usable webpages to collect. Default: 5."
      ),
      time_range: import_zod.z.string().optional().describe(
        "Optional freshness filter: 'day', 'week', 'month', or 'year'"
      ),
      page: import_zod.z.number().int().min(1).optional().describe(
        "SearXNG result page to research. Default: 1."
      )
    },
    implementation: async (params) => {
      const {
        query,
        sources,
        time_range,
        page = 1
      } = params;
      const targetSources = sources ?? DEFAULT_RESEARCH_SOURCES;
      try {
        const searchParams = new URLSearchParams({
          q: query,
          format: "json",
          pageno: String(page),
          safesearch: "0"
        });
        if (time_range) {
          const validRanges = [
            "day",
            "week",
            "month",
            "year"
          ];
          if (validRanges.includes(
            time_range
          )) {
            searchParams.append(
              "time_range",
              time_range
            );
          }
        }
        const searchUrl = `${searxngUrl}/search?${searchParams.toString()}`;
        console.log(
          `research_web: searching for "${query}"`
        );
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          timeout
        );
        const searchResponse = await fetch(searchUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "LM-Studio-Plugin/1.0"
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!searchResponse.ok) {
          throw new Error(
            `SearXNG returned ${searchResponse.status}: ${searchResponse.statusText}`
          );
        }
        const data = await searchResponse.json();
        if (!data.results || data.results.length === 0) {
          return `No search results found for "${query}".`;
        }
        const candidates = data.results.slice(
          0,
          RESEARCH_CANDIDATES
        );
        console.log(
          `research_web: received ${candidates.length} candidates`
        );
        const accepted = [];
        const rejected = [];
        const seenDomains = /* @__PURE__ */ new Set();
        let candidateIndex = 0;
        while (accepted.length < targetSources && candidateIndex < candidates.length) {
          const candidate = candidates[candidateIndex];
          candidateIndex++;
          let domain;
          try {
            domain = new URL(
              candidate.url
            ).hostname.toLowerCase();
          } catch {
            rejected.push({
              title: candidate.title,
              url: candidate.url,
              reason: "invalid URL"
            });
            continue;
          }
          if (seenDomains.has(
            domain
          )) {
            rejected.push({
              title: candidate.title,
              url: candidate.url,
              reason: "duplicate domain"
            });
            continue;
          }
          console.log(
            `research_web: checking candidate ${candidateIndex}/${candidates.length}: ${candidate.url}`
          );
          const result = await fetchCandidate(
            candidate,
            timeout,
            query,
            accepted.length,
            waitCaptcha
          );
          if (!result.usable) {
            console.log(
              `research_web: REJECTED \u2014 ${candidate.url} \u2014 ${result.reason}`
            );
            rejected.push({
              title: candidate.title,
              url: candidate.url,
              reason: result.reason
            });
            continue;
          }
          seenDomains.add(
            domain
          );
          accepted.push({
            title: result.title,
            url: result.url,
            domain: result.domain,
            engine: result.engine,
            score: result.score,
            contentSource: "FETCHED_PAGE",
            content: result.content
          });
          console.log(
            `research_web: ACCEPTED ${accepted.length}/${targetSources}: ${result.url}`
          );
        }
        if (accepted.length === 0) {
          const snippetResults = candidates.map(
            (candidate, index) => `[${index + 1}] ${candidate.title}
URL: ${candidate.url}
Snippet: ${candidate.content.substring(0, 500)}`
          ).join("\n\n");
          return `I couldn't access any of the current ${candidateIndex} candidate webpages for "${query}".

Would you like me to use the available search snippets, or attempt the next 15 search results?

AVAILABLE SNIPPETS:

` + snippetResults;
        }
        let output = `RESEARCH RESULTS
Query: ${query}
Usable sources: ${accepted.length}/${targetSources}
Candidates checked: ${candidateIndex}

Only sources listed under SOURCE 1 through SOURCE ${accepted.length} were accepted and supplied as research material.

`;
        accepted.forEach(
          (source, index) => {
            output += `SOURCE ${index + 1}
Title: ${source.title}
URL: ${source.url}
${source.content}

`;
          }
        );
        return output;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return `Research request timed out after ${timeout}ms. Check SearXNG at ${searxngUrl}.`;
        }
        return `Error researching "${query}": ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  });
  tools.push(searchTool);
  tools.push(fetchPageTool);
  tools.push(researchTool);
  return tools;
}
var import_sdk2, import_zod, import_datasets_stopwords_en, RESEARCH_CANDIDATES, DEFAULT_RESEARCH_SOURCES;
var init_toolsProvider = __esm({
  "../../Users/VU-W11/.lmstudio/extensions/plugins/anhuvdinh/better-searxng-search/src/toolsProvider.ts"() {
    "use strict";
    import_sdk2 = require("@lmstudio/sdk");
    import_zod = require("zod");
    init_config();
    import_datasets_stopwords_en = __toESM(require("@stdlib/datasets-stopwords-en"));
    RESEARCH_CANDIDATES = 15;
    DEFAULT_RESEARCH_SOURCES = 5;
  }
});

// ../../Users/VU-W11/.lmstudio/extensions/plugins/anhuvdinh/better-searxng-search/src/index.ts
var src_exports = {};
__export(src_exports, {
  main: () => main
});
async function main(context) {
  context.withConfigSchematics(configSchematics);
  context.withToolsProvider(toolsProvider);
  console.log("SearXNG Search Plugin initialized");
}
var init_src = __esm({
  "../../Users/VU-W11/.lmstudio/extensions/plugins/anhuvdinh/better-searxng-search/src/index.ts"() {
    "use strict";
    init_toolsProvider();
    init_config();
  }
});

// ../../Users/VU-W11/.lmstudio/extensions/plugins/anhuvdinh/better-searxng-search/.lmstudio/entry.ts
var import_sdk3 = require("@lmstudio/sdk");
var clientIdentifier = process.env.LMS_PLUGIN_CLIENT_IDENTIFIER;
var clientPasskey = process.env.LMS_PLUGIN_CLIENT_PASSKEY;
var baseUrl = process.env.LMS_PLUGIN_BASE_URL;
var client = new import_sdk3.LMStudioClient({
  clientIdentifier,
  clientPasskey,
  baseUrl
});
globalThis.__LMS_PLUGIN_CONTEXT = true;
var predictionLoopHandlerSet = false;
var promptPreprocessorSet = false;
var configSchematicsSet = false;
var globalConfigSchematicsSet = false;
var toolsProviderSet = false;
var generatorSet = false;
var selfRegistrationHost = client.plugins.getSelfRegistrationHost();
var pluginContext = {
  withPredictionLoopHandler: (generate) => {
    if (predictionLoopHandlerSet) {
      throw new Error("PredictionLoopHandler already registered");
    }
    if (toolsProviderSet) {
      throw new Error("PredictionLoopHandler cannot be used with a tools provider");
    }
    predictionLoopHandlerSet = true;
    selfRegistrationHost.setPredictionLoopHandler(generate);
    return pluginContext;
  },
  withPromptPreprocessor: (preprocess) => {
    if (promptPreprocessorSet) {
      throw new Error("PromptPreprocessor already registered");
    }
    promptPreprocessorSet = true;
    selfRegistrationHost.setPromptPreprocessor(preprocess);
    return pluginContext;
  },
  withConfigSchematics: (configSchematics2) => {
    if (configSchematicsSet) {
      throw new Error("Config schematics already registered");
    }
    configSchematicsSet = true;
    selfRegistrationHost.setConfigSchematics(configSchematics2);
    return pluginContext;
  },
  withGlobalConfigSchematics: (globalConfigSchematics) => {
    if (globalConfigSchematicsSet) {
      throw new Error("Global config schematics already registered");
    }
    globalConfigSchematicsSet = true;
    selfRegistrationHost.setGlobalConfigSchematics(globalConfigSchematics);
    return pluginContext;
  },
  withToolsProvider: (toolsProvider2) => {
    if (toolsProviderSet) {
      throw new Error("Tools provider already registered");
    }
    if (predictionLoopHandlerSet) {
      throw new Error("Tools provider cannot be used with a predictionLoopHandler");
    }
    toolsProviderSet = true;
    selfRegistrationHost.setToolsProvider(toolsProvider2);
    return pluginContext;
  },
  withGenerator: (generator) => {
    if (generatorSet) {
      throw new Error("Generator already registered");
    }
    generatorSet = true;
    selfRegistrationHost.setGenerator(generator);
    return pluginContext;
  }
};
Promise.resolve().then(() => (init_src(), src_exports)).then(async (module2) => {
  return await module2.main(pluginContext);
}).then(() => {
  selfRegistrationHost.initCompleted();
}).catch((error) => {
  console.error("Failed to execute the main function of the plugin.");
  console.error(error);
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2NvbmZpZy50cyIsICIuLi9zcmMvdG9vbHNQcm92aWRlci50cyIsICIuLi9zcmMvaW5kZXgudHMiLCAiZW50cnkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IGNyZWF0ZUNvbmZpZ1NjaGVtYXRpY3MgfSBmcm9tIFwiQGxtc3R1ZGlvL3Nka1wiO1xyXG5cclxuZXhwb3J0IGNvbnN0IGNvbmZpZ1NjaGVtYXRpY3MgPSBjcmVhdGVDb25maWdTY2hlbWF0aWNzKClcclxuICAuZmllbGQoXHJcbiAgICBcInNlYXJ4bmdVcmxcIixcclxuICAgIFwic3RyaW5nXCIsXHJcbiAgICB7XHJcbiAgICAgIGRpc3BsYXlOYW1lOiBcIlNlYXJYTkcgVVJMXCIsXHJcbiAgICAgIHN1YnRpdGxlOiBcIkJhc2UgVVJMIG9mIHlvdXIgbG9jYWwgU2VhclhORyBpbnN0YW5jZVwiLFxyXG4gICAgfSxcclxuICAgIFwiaHR0cDovL2xvY2FsaG9zdDo4MDgxXCIgIC8vIERlZmF1bHQgdmFsdWUgYXMgNHRoIHBhcmFtZXRlclxyXG4gIClcclxuICAuZmllbGQoXHJcbiAgICBcImRlZmF1bHRQYWdlU2l6ZVwiLFxyXG4gICAgXCJudW1lcmljXCIsXHJcbiAgICB7XHJcbiAgICAgIGRpc3BsYXlOYW1lOiBcIkRlZmF1bHQgUmVzdWx0cyBDb3VudFwiLFxyXG4gICAgICBzdWJ0aXRsZTogXCJOdW1iZXIgb2YgcmVzdWx0cyB0byByZXR1cm4gKDEtMjApXCIsXHJcbiAgICAgIG1pbjogMSxcclxuICAgICAgbWF4OiAyMCxcclxuICAgIH0sXHJcbiAgICAxMCAgLy8gRGVmYXVsdCB2YWx1ZSBhcyA0dGggcGFyYW1ldGVyXHJcbiAgKVxyXG4gIC5maWVsZChcclxuICAgIFwidGltZW91dFwiLFxyXG4gICAgXCJudW1lcmljXCIsXHJcbiAgICB7XHJcbiAgICAgIGRpc3BsYXlOYW1lOiBcIlJlcXVlc3QgVGltZW91dCAobXMpXCIsXHJcbiAgICAgIHN1YnRpdGxlOiBcIlRpbWVvdXQgZm9yIFNlYXJYTkcgcmVxdWVzdHNcIixcclxuICAgICAgbWluOiAxMDAwLFxyXG4gICAgICBtYXg6IDYwMDAwLFxyXG4gICAgfSxcclxuICAgIDEwMDAwICAvLyBEZWZhdWx0IHZhbHVlIGFzIDR0aCBwYXJhbWV0ZXJcclxuICApXHJcbiAgIC5maWVsZChcclxuICAgIFwid2FpdENhcHRjaGFUaW1lb3V0XCIsXHJcbiAgICBcIm51bWVyaWNcIixcclxuICAgIHtcclxuICAgICAgZGlzcGxheU5hbWU6IFwiVGltZW91dCBmb3IgQ2FwdGNoYSBEZXRlY3Rpb24gKG1zKVwiLFxyXG4gICAgICBzdWJ0aXRsZTogXCJUaW1lb3V0IGZvciBTZWFyWE5HIHRvIGRldGVjdCBDYXB0Y2hhIGFuZCBmaW5kIGFub3RoZXIgc291cmNlXCIsXHJcbiAgICAgIG1pbjogMCxcclxuICAgICAgbWF4OiA2MDAwMCxcclxuICAgIH0sXHJcbiAgICAzMDAwICAvLyBEZWZhdWx0IHZhbHVlIGFzIDR0aCBwYXJhbWV0ZXJcclxuICApXHJcbiAgLmJ1aWxkKCk7XHJcbiIsICJpbXBvcnQgeyB0b29sLCBUb29sLCBUb29sc1Byb3ZpZGVyQ29udHJvbGxlciB9IGZyb20gXCJAbG1zdHVkaW8vc2RrXCI7XHJcbmltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XHJcbmltcG9ydCB7IGNvbmZpZ1NjaGVtYXRpY3MgfSBmcm9tIFwiLi9jb25maWdcIjtcclxuaW1wb3J0IHN0b3B3b3JkcyBmcm9tIFwiQHN0ZGxpYi9kYXRhc2V0cy1zdG9wd29yZHMtZW5cIjtcclxuXHJcbmludGVyZmFjZSBTZWFyWE5HUmVzdWx0IHtcclxuICB0aXRsZTogc3RyaW5nO1xyXG4gIHVybDogc3RyaW5nO1xyXG4gIGNvbnRlbnQ6IHN0cmluZztcclxuICBlbmdpbmU6IHN0cmluZztcclxuICBzY29yZT86IG51bWJlcjtcclxufVxyXG5cclxuaW50ZXJmYWNlIFNlYXJYTkdSZXNwb25zZSB7XHJcbiAgcXVlcnk6IHN0cmluZztcclxuICBudW1iZXJfb2ZfcmVzdWx0czogbnVtYmVyO1xyXG4gIHJlc3VsdHM6IFNlYXJYTkdSZXN1bHRbXTtcclxufVxyXG5cclxuaW50ZXJmYWNlIEFjY2VwdGVkU291cmNlIHtcclxuICB0aXRsZTogc3RyaW5nO1xyXG4gIHVybDogc3RyaW5nO1xyXG4gIGRvbWFpbjogc3RyaW5nO1xyXG4gIGVuZ2luZTogc3RyaW5nO1xyXG4gIHNjb3JlPzogbnVtYmVyO1xyXG4gIGNvbnRlbnRTb3VyY2U6IFwiRkVUQ0hFRF9QQUdFXCI7XHJcbiAgY29udGVudDogc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgUmVqZWN0ZWRTb3VyY2Uge1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgdXJsOiBzdHJpbmc7XHJcbiAgcmVhc29uOiBzdHJpbmc7XHJcbn1cclxuXHJcbi8vIFJlc2VhcmNoIHBpcGVsaW5lIHNldHRpbmdzLlxyXG5jb25zdCBSRVNFQVJDSF9DQU5ESURBVEVTID0gMTU7XHJcbmNvbnN0IERFRkFVTFRfUkVTRUFSQ0hfU09VUkNFUyA9IDU7XHJcblxyXG4vKipcclxuICogUGF1c2UgYmVmb3JlIGluc3BlY3RpbmcgYSBzdWNjZXNzZnVsbHkgZmV0Y2hlZCBwYWdlLlxyXG4gKlxyXG4gKiBUaGlzIGdpdmVzIHRyYW5zaWVudCBzZWN1cml0eS9jaGFsbGVuZ2UgcGFnZXMgYSBmZXcgc2Vjb25kc1xyXG4gKiB0byByZW5kZXIgYmVmb3JlIHdlIGRlY2lkZSB3aGV0aGVyIHRoZSBwYWdlIGlzIHVzYWJsZS5cclxuICovXHJcbmZ1bmN0aW9uIHNsZWVwKG1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcclxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIE5vcm1hbGl6ZSB0ZXh0IGZvciBjaGFsbGVuZ2UgZGV0ZWN0aW9uLlxyXG4gKi9cclxuZnVuY3Rpb24gbm9ybWFsaXplRm9yRGV0ZWN0aW9uKHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgcmV0dXJuIHRleHRcclxuICAgIC50b0xvd2VyQ2FzZSgpXHJcbiAgICAucmVwbGFjZSgvXFxzKy9nLCBcIiBcIilcclxuICAgIC50cmltKCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBEZXRlY3QgYW4gQUNUSVZFIGh1bWFuLXZlcmlmaWNhdGlvbiBwYWdlLlxyXG4gKlxyXG4gKiBJbXBvcnRhbnQ6XHJcbiAqXHJcbiAqIFdlIGRvIE5PVCByZWplY3QgYSBwYWdlIHNpbXBseSBiZWNhdXNlIGl0IG1lbnRpb25zOlxyXG4gKlxyXG4gKiAgIENsb3VkZmxhcmVcclxuICogICBib3RcclxuICogICBib3QgZGV0ZWN0aW9uXHJcbiAqICAgc2VjdXJpdHlcclxuICogICBDQVBUQ0hBXHJcbiAqICAgdmVyaWZpY2F0aW9uXHJcbiAqXHJcbiAqIFRob3NlIHdvcmRzIGNhbiBuYXR1cmFsbHkgb2NjdXIgaW4gbGVnaXRpbWF0ZSBhcnRpY2xlcy5cclxuICpcclxuICogV2UgYXJlIGxvb2tpbmcgZm9yIGxhbmd1YWdlIHRoYXQgaW5kaWNhdGVzIHRoZSBQQUdFIElTIENVUlJFTlRMWVxyXG4gKiBBU0tJTkcgVEhFIFZJU0lUT1IgVE8gQ09NUExFVEUgQSBIVU1BTi9CT1QgVkVSSUZJQ0FUSU9OLlxyXG4gKi9cclxuZnVuY3Rpb24gZGV0ZWN0QWN0aXZlQ2hhbGxlbmdlKHRleHQ6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xyXG4gIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVGb3JEZXRlY3Rpb24odGV4dCk7XHJcblxyXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gIC8vIEV4cGxpY2l0IGFjdGl2ZSB2ZXJpZmljYXRpb24gaW5zdHJ1Y3Rpb25zLlxyXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuICBjb25zdCBjaGFsbGVuZ2VQYXR0ZXJuczogQXJyYXk8W1JlZ0V4cCwgc3RyaW5nXT4gPSBbXHJcbiAgICBbXHJcbiAgICAgIC92ZXJpZnkgKD86eW91Jz9yZXx5b3UgYXJlKSBodW1hbi8sXHJcbiAgICAgIFwiYWN0aXZlIGh1bWFuIHZlcmlmaWNhdGlvblwiLFxyXG4gICAgXSxcclxuICAgIFtcclxuICAgICAgL3ZlcmlmeWluZyAoPzp5b3UnP3JlfHlvdSBhcmUpIGh1bWFuLyxcclxuICAgICAgXCJhY3RpdmUgaHVtYW4gdmVyaWZpY2F0aW9uXCIsXHJcbiAgICBdLFxyXG4gICAgW1xyXG4gICAgICAvcGxlYXNlIHZlcmlmeSAoPzp5b3UnP3JlfHlvdSBhcmUpIGh1bWFuLyxcclxuICAgICAgXCJhY3RpdmUgaHVtYW4gdmVyaWZpY2F0aW9uXCIsXHJcbiAgICBdLFxyXG4gICAgW1xyXG4gICAgICAvYXJlIHlvdSAoPzphICk/cm9ib3QvLFxyXG4gICAgICBcImFjdGl2ZSByb2JvdCB2ZXJpZmljYXRpb25cIixcclxuICAgIF0sXHJcbiAgICBbXHJcbiAgICAgIC9wcm92ZSAoPzp5b3UnP3JlfHlvdSBhcmUpIG5vdCBhIHJvYm90LyxcclxuICAgICAgXCJhY3RpdmUgcm9ib3QgdmVyaWZpY2F0aW9uXCIsXHJcbiAgICBdLFxyXG4gICAgW1xyXG4gICAgICAvaSBhbSBub3QgYSByb2JvdC8sXHJcbiAgICAgIFwiYWN0aXZlIHJvYm90IHZlcmlmaWNhdGlvblwiLFxyXG4gICAgXSxcclxuICAgIFtcclxuICAgICAgL2knP20gbm90IGEgcm9ib3QvLFxyXG4gICAgICBcImFjdGl2ZSByb2JvdCB2ZXJpZmljYXRpb25cIixcclxuICAgIF0sXHJcbiAgICBbXHJcbiAgICAgIC9jaGVja2luZyB5b3VyIGJyb3dzZXIvLFxyXG4gICAgICBcImJyb3dzZXIgdmVyaWZpY2F0aW9uXCIsXHJcbiAgICBdLFxyXG4gICAgW1xyXG4gICAgICAvY2hlY2tpbmcgaWYgeW91Jz9yZSBodW1hbi8sXHJcbiAgICAgIFwiaHVtYW4gdmVyaWZpY2F0aW9uXCIsXHJcbiAgICBdLFxyXG4gICAgW1xyXG4gICAgICAvY2hlY2tpbmcgaWYgeW91IGFyZSBodW1hbi8sXHJcbiAgICAgIFwiaHVtYW4gdmVyaWZpY2F0aW9uXCIsXHJcbiAgICBdLFxyXG4gICAgW1xyXG4gICAgICAvcGxlYXNlIHdhaXQgd2hpbGUgd2UgdmVyaWZ5LyxcclxuICAgICAgXCJ2ZXJpZmljYXRpb24gcHJvY2Vzc1wiLFxyXG4gICAgXSxcclxuICAgIFtcclxuICAgICAgL2NvbXBsZXRlICg/OnRoZSApPyg/OmNhcHRjaGF8Y2hhbGxlbmdlKS8sXHJcbiAgICAgIFwiQ0FQVENIQS9jaGFsbGVuZ2UgaW5zdHJ1Y3Rpb25cIixcclxuICAgIF0sXHJcbiAgICBbXHJcbiAgICAgIC9jb21wbGV0ZSB0aGUgc2VjdXJpdHkgY2hlY2svLFxyXG4gICAgICBcInNlY3VyaXR5IGNoZWNrXCIsXHJcbiAgICBdLFxyXG4gICAgW1xyXG4gICAgICAvY2xpY2sgdG8gdmVyaWZ5LyxcclxuICAgICAgXCJ2ZXJpZmljYXRpb24gaW5zdHJ1Y3Rpb25cIixcclxuICAgIF0sXHJcbiAgICBbXHJcbiAgICAgIC9wcmVzcyBhbmQgaG9sZCB0byB2ZXJpZnkvLFxyXG4gICAgICBcInByZXNzLWFuZC1ob2xkIHZlcmlmaWNhdGlvblwiLFxyXG4gICAgXSxcclxuICAgIFtcclxuICAgICAgL3ByZXNzIGFuZCBob2xkIHRvIGNvbnRpbnVlLyxcclxuICAgICAgXCJwcmVzcy1hbmQtaG9sZCB2ZXJpZmljYXRpb25cIixcclxuICAgIF0sXHJcbiAgICBbXHJcbiAgICAgIC9kcmFnIHRoZSBzbGlkZXIvLFxyXG4gICAgICBcInNsaWRlciB2ZXJpZmljYXRpb25cIixcclxuICAgIF0sXHJcbiAgICBbXHJcbiAgICAgIC9kcmFnIHRoZSBoYW5kbGUvLFxyXG4gICAgICBcInNsaWRlciB2ZXJpZmljYXRpb25cIixcclxuICAgIF0sXHJcbiAgICBbXHJcbiAgICAgIC9tb3ZlIHRoZSBwdXp6bGUgcGllY2UvLFxyXG4gICAgICBcInB1enpsZSB2ZXJpZmljYXRpb25cIixcclxuICAgIF0sXHJcbiAgICBbXHJcbiAgICAgIC9jb21wbGV0ZSB0aGUgcHV6emxlLyxcclxuICAgICAgXCJwdXp6bGUgdmVyaWZpY2F0aW9uXCIsXHJcbiAgICBdLFxyXG4gICAgW1xyXG4gICAgICAvc2VsZWN0IGFsbCBpbWFnZXMvLFxyXG4gICAgICBcImltYWdlIHZlcmlmaWNhdGlvblwiLFxyXG4gICAgXSxcclxuICAgIFtcclxuICAgICAgL3NlbGVjdCBhbGwgc3F1YXJlcy8sXHJcbiAgICAgIFwiaW1hZ2UgdmVyaWZpY2F0aW9uXCIsXHJcbiAgICBdLFxyXG4gICAgW1xyXG4gICAgICAvc2VsZWN0IGFsbCB0aGUgKD86aW1hZ2VzfHNxdWFyZXN8cGljdHVyZXMpLyxcclxuICAgICAgXCJpbWFnZSB2ZXJpZmljYXRpb25cIixcclxuICAgIF0sXHJcbiAgICBbXHJcbiAgICAgIC93aGljaCBpbWFnZSBtYXRjaGVzLyxcclxuICAgICAgXCJpbWFnZSB2ZXJpZmljYXRpb25cIixcclxuICAgIF0sXHJcbiAgICBbXHJcbiAgICAgIC93aGljaCBpdGVtIG1hdGNoZXMvLFxyXG4gICAgICBcInNlbGVjdGlvbiB2ZXJpZmljYXRpb25cIixcclxuICAgIF0sXHJcbiAgICBbXHJcbiAgICAgIC93aGljaCBpdGVtIGRvZXNuJz90IGJlbG9uZy8sXHJcbiAgICAgIFwic2VsZWN0aW9uIHZlcmlmaWNhdGlvblwiLFxyXG4gICAgXSxcclxuICBdO1xyXG5cclxuICBmb3IgKGNvbnN0IFtwYXR0ZXJuLCByZWFzb25dIG9mIGNoYWxsZW5nZVBhdHRlcm5zKSB7XHJcbiAgICBpZiAocGF0dGVybi50ZXN0KG5vcm1hbGl6ZWQpKSB7XHJcbiAgICAgIHJldHVybiByZWFzb247XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAvLyBDQVBUQ0hBIHN5c3RlbXMuXHJcbiAgLy9cclxuICAvLyBBIHBhZ2Ugc2F5aW5nIFwidGhpcyBhcnRpY2xlIGRpc2N1c3NlcyBDQVBUQ0hBXCIgc2hvdWxkIG5vdCBiZVxyXG4gIC8vIHJlamVjdGVkLiBXZSB0aGVyZWZvcmUgcmVxdWlyZSBhY3RpdmUvaW5zdHJ1Y3Rpb25hbCBjb250ZXh0LlxyXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuY29uc3Qgd29yZENvdW50ID0gbm9ybWFsaXplZFxyXG4gIC5zcGxpdCgvXFxzKy8pXHJcbiAgLmZpbHRlcihCb29sZWFuKVxyXG4gIC5sZW5ndGg7XHJcblxyXG5jb25zdCBleHBsaWNpdENoYWxsZW5nZUluc3RydWN0aW9uID1cclxuICAvXFxidmVyaWZ5XFxzKyg/OnRoYXRcXHMrKT8oPzp5b3UoPzoncmV8IGFyZSl8eW91cnNlbGYpXFxzKyg/OmFyZVxccyspP2h1bWFuXFxiL2kudGVzdChub3JtYWxpemVkKSB8fFxyXG4gIC9cXGJpXFxzKig/OmFtfCdtKVxccytub3RcXHMrYVxccytyb2JvdFxcYi9pLnRlc3Qobm9ybWFsaXplZCkgfHxcclxuICAvXFxiKD86c2VsZWN0fGNob29zZSlcXHMrYWxsXFxzKyg/OnRoZVxccyspPyg/OmltYWdlc3xzcXVhcmVzfHRpbGVzKVxcYi9pLnRlc3Qobm9ybWFsaXplZCkgfHxcclxuICAvXFxiKD86bW92ZXxkcmFnKVxccysoPzp0aGVcXHMrKT8oPzpzbGlkZXJ8cHV6emxlXFxzK3BpZWNlKVxcYi9pLnRlc3Qobm9ybWFsaXplZCkgfHxcclxuICAvXFxiKD86cHJlc3N8Y2xpY2spXFxzK2FuZFxccytob2xkXFxzKyg/OnRvXFxzKyk/dmVyaWZ5XFxiL2kudGVzdChub3JtYWxpemVkKSB8fFxyXG4gIC9cXGJjb21wbGV0ZVxccysoPzp0aGVcXHMrKT8oPzpjYXB0Y2hhfGNoYWxsZW5nZXx2ZXJpZmljYXRpb24pXFxiL2kudGVzdChub3JtYWxpemVkKTtcclxuXHJcbmNvbnN0IGhhc0NhcHRjaGEgPVxyXG4gIC9cXGIoPzpjYXB0Y2hhfHJlY2FwdGNoYXxoY2FwdGNoYSlcXGIvaS50ZXN0KG5vcm1hbGl6ZWQpO1xyXG5cclxuY29uc3QgaGFzVHVybnN0aWxlID1cclxuICAvXFxidHVybnN0aWxlXFxiL2kudGVzdChub3JtYWxpemVkKTtcclxuXHJcbmNvbnN0IGhhc0NoYWxsZW5nZUNvbnRleHQgPVxyXG4gIC9cXGIoPzpjaGFsbGVuZ2V8dmVyaWZpY2F0aW9ufHZlcmlmeXxodW1hbnxyb2JvdClcXGIvaS50ZXN0KG5vcm1hbGl6ZWQpO1xyXG5cclxuaWYgKGV4cGxpY2l0Q2hhbGxlbmdlSW5zdHJ1Y3Rpb24pIHtcclxuICByZXR1cm4gXCJhY3RpdmUgdmVyaWZpY2F0aW9uIGNoYWxsZW5nZSBkZXRlY3RlZFwiO1xyXG59XHJcblxyXG5pZiAoXHJcbiAgd29yZENvdW50IDwgMTUwICYmXHJcbiAgKFxyXG4gICAgKGhhc0NhcHRjaGEgJiYgaGFzQ2hhbGxlbmdlQ29udGV4dCkgfHxcclxuICAgIChoYXNUdXJuc3RpbGUgJiYgaGFzQ2hhbGxlbmdlQ29udGV4dClcclxuICApXHJcbikge1xyXG4gIHJldHVybiBcImFjdGl2ZSB2ZXJpZmljYXRpb24gY2hhbGxlbmdlIGRldGVjdGVkXCI7XHJcbn1cclxuXHJcbiAgcmV0dXJuIG51bGw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNlbGVjdFJlbGV2YW50Q29udGVudChcclxuICBjb250ZW50OiBzdHJpbmcsXHJcbiAgcXVlcnk6IHN0cmluZyxcclxuICBtYXhMZW5ndGggPSA2MDAwXHJcbik6IHN0cmluZyB7XHJcbiAgaWYgKGNvbnRlbnQubGVuZ3RoIDw9IG1heExlbmd0aCkge1xyXG4gICAgcmV0dXJuIGNvbnRlbnQ7XHJcbiAgfVxyXG5cclxuXHRjb25zdCBzdG9wV29yZHMgPSBuZXcgU2V0KHN0b3B3b3JkcygpKTtcclxuXHJcbiAgY29uc3QgdGVybXMgPSBxdWVyeVxyXG4gICAgLnRvTG93ZXJDYXNlKClcclxuICAgIC5yZXBsYWNlKC9bXlxccHtMfVxccHtOfVxccy4tXS9ndSwgXCIgXCIpXHJcbiAgICAuc3BsaXQoL1xccysvKVxyXG4gICAgLmZpbHRlcihcclxuICAgICAgKHRlcm0pID0+XHJcbiAgICAgICAgdGVybS5sZW5ndGggPj0gMyAmJlxyXG4gICAgICAgICFzdG9wV29yZHMuaGFzKHRlcm0pXHJcbiAgICApO1xyXG5cdFxyXG5cdGNvbnN0IHF1ZXJ5UGhyYXNlID0gcXVlcnlcclxuXHQgIC50b0xvd2VyQ2FzZSgpXHJcblx0ICAucmVwbGFjZSgvW15cXHB7TH1cXHB7Tn1cXHMuLV0vZ3UsIFwiIFwiKVxyXG5cdCAgLnJlcGxhY2UoL1xccysvZywgXCIgXCIpXHJcblx0ICAudHJpbSgpO1xyXG5cclxuICBpZiAodGVybXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICByZXR1cm4gY29udGVudC5zdWJzdHJpbmcoMCwgbWF4TGVuZ3RoKS50cmltKCkgK1xyXG4gICAgICBcIlxcbi4uLltzb3VyY2UgdHJ1bmNhdGVkXVwiO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgcGFyYWdyYXBocyA9IGNvbnRlbnRcclxuICAgIC5zcGxpdCgvXFxuXFxzKlxcbi8pXHJcbiAgICAubWFwKCh0ZXh0KSA9PiB0ZXh0LnRyaW0oKSlcclxuICAgIC5maWx0ZXIoQm9vbGVhbik7XHJcblxyXG4gIGNvbnN0IHNjb3JlZCA9IHBhcmFncmFwaHMubWFwKChwYXJhZ3JhcGgsIGluZGV4KSA9PiB7XHJcbiAgICBjb25zdCBsb3dlciA9IHBhcmFncmFwaC50b0xvd2VyQ2FzZSgpO1xyXG5cclxuICAgIGxldCBzY29yZSA9IDA7XHJcblxyXG5cdGlmIChcclxuXHQgIHF1ZXJ5UGhyYXNlLmxlbmd0aCA+PSA0ICYmXHJcblx0ICBsb3dlci5pbmNsdWRlcyhxdWVyeVBocmFzZSlcclxuXHQpIHtcclxuXHQgIHNjb3JlICs9IDU7XHJcblx0fVxyXG5cclxuICAgIGZvciAoY29uc3QgdGVybSBvZiB0ZXJtcykge1xyXG4gICAgICBjb25zdCBtYXRjaGVzID0gbG93ZXIuc3BsaXQodGVybSkubGVuZ3RoIC0gMTtcclxuICAgICAgc2NvcmUgKz0gTWF0aC5taW4obWF0Y2hlcywgMyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgaW5kZXgsXHJcbiAgICAgIHBhcmFncmFwaCxcclxuICAgICAgc2NvcmUsXHJcbiAgICB9O1xyXG4gIH0pO1xyXG5cclxuICBjb25zdCByZWxldmFudCA9IHNjb3JlZFxyXG4gICAgLmZpbHRlcigoaXRlbSkgPT4gaXRlbS5zY29yZSA+IDApXHJcbiAgICAuc29ydCgoYSwgYikgPT4gYi5zY29yZSAtIGEuc2NvcmUpO1xyXG5cclxuICBpZiAocmVsZXZhbnQubGVuZ3RoID09PSAwKSB7XHJcbiAgICByZXR1cm4gY29udGVudC5zdWJzdHJpbmcoMCwgbWF4TGVuZ3RoKS50cmltKCkgK1xyXG4gICAgICBcIlxcbi4uLltzb3VyY2UgdHJ1bmNhdGVkXVwiO1xyXG4gIH1cclxuXHJcbiAgY29uc3Qgc2VsZWN0ZWQgPSBuZXcgU2V0PG51bWJlcj4oKTtcclxuXHJcbiAgbGV0IHRvdGFsTGVuZ3RoID0gMDtcclxuXHJcbiAgZm9yIChjb25zdCBpdGVtIG9mIHJlbGV2YW50KSB7XHJcbiAgICAvLyBJbmNsdWRlIG5laWdoYm9yaW5nIHBhcmFncmFwaHMgc28gY29udGV4dCBpc24ndCBmcmFnbWVudGVkLlxyXG4gICAgY29uc3Qgc3RhcnQgPSBNYXRoLm1heCgwLCBpdGVtLmluZGV4IC0gMSk7XHJcbiAgICBjb25zdCBlbmQgPSBNYXRoLm1pbihcclxuICAgICAgcGFyYWdyYXBocy5sZW5ndGggLSAxLFxyXG4gICAgICBpdGVtLmluZGV4ICsgMVxyXG4gICAgKTtcclxuXHJcbiAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPD0gZW5kOyBpKyspIHtcclxuICAgICAgaWYgKHNlbGVjdGVkLmhhcyhpKSkgY29udGludWU7XHJcblxyXG4gICAgICBjb25zdCBhZGRpdGlvbiA9XHJcbiAgICAgICAgcGFyYWdyYXBoc1tpXSArIFwiXFxuXFxuXCI7XHJcblxyXG4gICAgICBpZiAoXHJcbiAgICAgICAgdG90YWxMZW5ndGggKyBhZGRpdGlvbi5sZW5ndGggPlxyXG4gICAgICAgIG1heExlbmd0aFxyXG4gICAgICApIHtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgc2VsZWN0ZWQuYWRkKGkpO1xyXG4gICAgICB0b3RhbExlbmd0aCArPSBhZGRpdGlvbi5sZW5ndGg7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRvdGFsTGVuZ3RoID49IG1heExlbmd0aCAqIDAuOTUpIHtcclxuICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjb25zdCByZXN1bHQgPSBBcnJheS5mcm9tKHNlbGVjdGVkKVxyXG4gICAgLnNvcnQoKGEsIGIpID0+IGEgLSBiKVxyXG4gICAgLm1hcCgoaW5kZXgpID0+IHBhcmFncmFwaHNbaW5kZXhdKVxyXG4gICAgLmpvaW4oXCJcXG5cXG5cIik7XHJcblxyXG4gIHJldHVybiByZXN1bHQudHJpbSgpICtcclxuICAgIChyZXN1bHQubGVuZ3RoIDwgY29udGVudC5sZW5ndGhcclxuICAgICAgPyBcIlxcbi4uLltzb3VyY2UgdHJ1bmNhdGVkXVwiXHJcbiAgICAgIDogXCJcIik7XHJcbn1cclxuXHJcblxyXG5cclxuLyoqXHJcbiAqIEV4dHJhY3QgcmVhZGFibGUgdGV4dCBmcm9tIEhUTUwuXHJcbiAqXHJcbiAqIFRoaXMgaXMgaW50ZW50aW9uYWxseSBkZXBlbmRlbmN5LWZyZWUgc28gdGhlIHBsdWdpbiBkb2VzIG5vdFxyXG4gKiByZXF1aXJlIGFub3RoZXIgcGFja2FnZSBqdXN0IGZvciBiYXNpYyBwYWdlIGV4dHJhY3Rpb24uXHJcbiAqL1xyXG4gXHJcbmZ1bmN0aW9uIGV4dHJhY3RUZXh0KGh0bWw6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgbGV0IHRleHQgPSBodG1sO1xyXG5cclxuICAvLyBSZW1vdmUgb2J2aW91cyBub24tY29udGVudCBlbGVtZW50cy5cclxuICB0ZXh0ID0gdGV4dFxyXG4gICAgLnJlcGxhY2UoLzxzY3JpcHRcXGJbXj5dKj5bXFxzXFxTXSo/PFxcL3NjcmlwdD4vZ2ksIFwiIFwiKVxyXG4gICAgLnJlcGxhY2UoLzxzdHlsZVxcYltePl0qPltcXHNcXFNdKj88XFwvc3R5bGU+L2dpLCBcIiBcIilcclxuICAgIC5yZXBsYWNlKC88bm9zY3JpcHRcXGJbXj5dKj5bXFxzXFxTXSo/PFxcL25vc2NyaXB0Pi9naSwgXCIgXCIpXHJcbiAgICAucmVwbGFjZSgvPHN2Z1xcYltePl0qPltcXHNcXFNdKj88XFwvc3ZnPi9naSwgXCIgXCIpXHJcbiAgICAucmVwbGFjZSgvPHRlbXBsYXRlXFxiW14+XSo+W1xcc1xcU10qPzxcXC90ZW1wbGF0ZT4vZ2ksIFwiIFwiKVxyXG4gICAgLnJlcGxhY2UoLzwhLS1bXFxzXFxTXSo/LS0+L2csIFwiIFwiKTtcclxuXHJcbiAgLy8gUHJlZmVyIHNlbWFudGljIGFydGljbGUvbWFpbiBjb250YWluZXJzLlxyXG4gIGNvbnN0IGNhbmRpZGF0ZXM6IHN0cmluZ1tdID0gW107XHJcblxyXG4gIGNvbnN0IG1haW5NYXRjaGVzID0gdGV4dC5tYXRjaChcclxuICAgIC88bWFpblxcYltePl0qPihbXFxzXFxTXSo/KTxcXC9tYWluPi9naVxyXG4gICk7XHJcblxyXG4gIGNvbnN0IGFydGljbGVNYXRjaGVzID0gdGV4dC5tYXRjaChcclxuICAgIC88YXJ0aWNsZVxcYltePl0qPihbXFxzXFxTXSo/KTxcXC9hcnRpY2xlPi9naVxyXG4gICk7XHJcblxyXG4gIGlmIChtYWluTWF0Y2hlcykgY2FuZGlkYXRlcy5wdXNoKC4uLm1haW5NYXRjaGVzKTtcclxuICBpZiAoYXJ0aWNsZU1hdGNoZXMpIGNhbmRpZGF0ZXMucHVzaCguLi5hcnRpY2xlTWF0Y2hlcyk7XHJcblxyXG4gIC8vIElmIHdlIGZvdW5kIHNlbWFudGljIGNvbnRlbnQsIHVzZSB0aGUgbGFyZ2VzdCBibG9jay5cclxuICBpZiAoY2FuZGlkYXRlcy5sZW5ndGggPiAwKSB7XHJcbiAgICB0ZXh0ID0gY2FuZGlkYXRlc1xyXG4gICAgICAuc29ydCgoYSwgYikgPT4gYi5sZW5ndGggLSBhLmxlbmd0aClbMF07XHJcbiAgfVxyXG5cclxuICAvLyBSZW1vdmUgY29tbW9uIG5hdmlnYXRpb24gLyBmb290ZXIgLyBzaWRlYmFyIHNlY3Rpb25zLlxyXG4gIHRleHQgPSB0ZXh0XHJcbiAgICAucmVwbGFjZShcclxuICAgICAgLzxuYXZcXGJbXj5dKj5bXFxzXFxTXSo/PFxcL25hdj4vZ2ksXHJcbiAgICAgIFwiIFwiXHJcbiAgICApXHJcbiAgICAucmVwbGFjZShcclxuICAgICAgLzxmb290ZXJcXGJbXj5dKj5bXFxzXFxTXSo/PFxcL2Zvb3Rlcj4vZ2ksXHJcbiAgICAgIFwiIFwiXHJcbiAgICApXHJcbiAgICAucmVwbGFjZShcclxuICAgICAgLzxhc2lkZVxcYltePl0qPltcXHNcXFNdKj88XFwvYXNpZGU+L2dpLFxyXG4gICAgICBcIiBcIlxyXG4gICAgKVxyXG4gICAgLnJlcGxhY2UoXHJcbiAgICAgIC88Zm9ybVxcYltePl0qPltcXHNcXFNdKj88XFwvZm9ybT4vZ2ksXHJcbiAgICAgIFwiIFwiXHJcbiAgICApO1xyXG5cclxuICAvLyBQcmVzZXJ2ZSBwYXJhZ3JhcGgvaGVhZGluZy9saXN0IGJvdW5kYXJpZXMuXHJcbiAgdGV4dCA9IHRleHRcclxuICAgIC5yZXBsYWNlKFxyXG4gICAgICAvPFxcLyg/OnB8ZGl2fHNlY3Rpb258YXJ0aWNsZXxtYWlufGgxfGgyfGgzfGg0fGg1fGg2fGxpfHRyKT4vZ2ksXHJcbiAgICAgIFwiXFxuXCJcclxuICAgIClcclxuICAgIC5yZXBsYWNlKFxyXG4gICAgICAvPGJyXFxzKlxcLz8+L2dpLFxyXG4gICAgICBcIlxcblwiXHJcbiAgICApO1xyXG5cclxuICAvLyBSZW1vdmUgcmVtYWluaW5nIEhUTUwgdGFncy5cclxuICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC88W14+XSs+L2csIFwiIFwiKTtcclxuXHJcbiAgLy8gRGVjb2RlIGNvbW1vbiBIVE1MIGVudGl0aWVzLlxyXG4gIHRleHQgPSB0ZXh0XHJcbiAgICAucmVwbGFjZSgvJm5ic3A7L2dpLCBcIiBcIilcclxuICAgIC5yZXBsYWNlKC8mYW1wOy9naSwgXCImXCIpXHJcbiAgICAucmVwbGFjZSgvJmx0Oy9naSwgXCI8XCIpXHJcbiAgICAucmVwbGFjZSgvJmd0Oy9naSwgXCI+XCIpXHJcbiAgICAucmVwbGFjZSgvJnF1b3Q7L2dpLCAnXCInKVxyXG4gICAgLnJlcGxhY2UoLyYjMzk7L2dpLCBcIidcIik7XHJcblxyXG4gIC8vIE5vcm1hbGl6ZSB3aGl0ZXNwYWNlLlxyXG4gIHRleHQgPSB0ZXh0XHJcbiAgICAucmVwbGFjZSgvXFxyL2csIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvWyBcXHRdKy9nLCBcIiBcIilcclxuICAgIC5yZXBsYWNlKC9bIFxcdF0rXFxuL2csIFwiXFxuXCIpXHJcbiAgICAucmVwbGFjZSgvXFxuWyBcXHRdKy9nLCBcIlxcblwiKVxyXG4gICAgLnJlcGxhY2UoL1xcblxccypcXG5cXHMqXFxuKy9nLCBcIlxcblxcblwiKVxyXG4gICAgLnRyaW0oKTtcclxuXHJcbiAgcmV0dXJuIHRleHQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBGZXRjaCBhbmQgdmFsaWRhdGUgb25lIHJlc2VhcmNoIGNhbmRpZGF0ZS5cclxuICpcclxuICogUGlwZWxpbmU6XHJcbiAqXHJcbiAqICAgRkVUQ0hcclxuICogICAgICBcdTIxOTNcclxuICogICBIVFRQIHN0YXR1cyBjaGVja1xyXG4gKiAgICAgIFx1MjE5M1xyXG4gKiAgIDQtc2Vjb25kIHdhaXRcclxuICogICAgICBcdTIxOTNcclxuICogICBpbnNwZWN0IHJldHVybmVkIHBhZ2VcclxuICogICAgICBcdTIxOTNcclxuICogICBBQ0NFUFQgLyBSRUpFQ1RcclxuICovXHJcbmFzeW5jIGZ1bmN0aW9uIGZldGNoQ2FuZGlkYXRlKFxyXG4gIHJlc3VsdDogU2VhclhOR1Jlc3VsdCxcclxuICB0aW1lb3V0OiBudW1iZXIsXHJcbiAgcXVlcnk6IHN0cmluZyxcclxuICBzb3VyY2VJbmRleDogbnVtYmVyLFxyXG4gIHdhaXRDYXB0Y2hhOiBudW1iZXJcclxuKTpcclxuICBQcm9taXNlPFxyXG4gICAgfCB7XHJcbiAgICAgICAgdXNhYmxlOiB0cnVlO1xyXG4gICAgICAgIHRpdGxlOiBzdHJpbmc7XHJcbiAgICAgICAgdXJsOiBzdHJpbmc7XHJcbiAgICAgICAgZG9tYWluOiBzdHJpbmc7XHJcbiAgICAgICAgZW5naW5lOiBzdHJpbmc7XHJcbiAgICAgICAgc2NvcmU/OiBudW1iZXI7XHJcbiAgICAgICAgY29udGVudDogc3RyaW5nO1xyXG4gICAgICB9XHJcbiAgICB8IHtcclxuICAgICAgICB1c2FibGU6IGZhbHNlO1xyXG4gICAgICAgIHJlYXNvbjogc3RyaW5nO1xyXG4gICAgICB9XHJcbiAgPiB7XHJcbiAgbGV0IGRvbWFpbjogc3RyaW5nO1xyXG5cclxuICB0cnkge1xyXG4gICAgZG9tYWluID1cclxuICAgICAgbmV3IFVSTChyZXN1bHQudXJsKS5ob3N0bmFtZTtcclxuICB9IGNhdGNoIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHVzYWJsZTogZmFsc2UsXHJcbiAgICAgIHJlYXNvbjogXCJpbnZhbGlkIFVSTFwiLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBjb250cm9sbGVyID1cclxuICAgICAgbmV3IEFib3J0Q29udHJvbGxlcigpO1xyXG5cclxuICAgIGNvbnN0IHRpbWVvdXRJZCA9XHJcbiAgICAgIHNldFRpbWVvdXQoXHJcbiAgICAgICAgKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLFxyXG4gICAgICAgIHRpbWVvdXRcclxuICAgICAgKTtcclxuXHJcbiAgICBjb25zdCByZXNwb25zZSA9XHJcbiAgICAgIGF3YWl0IGZldGNoKHJlc3VsdC51cmwsIHtcclxuICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXHJcblxyXG4gICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgIFwiVXNlci1BZ2VudFwiOlxyXG4gICAgICAgICAgICBcIk1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDEwLjA7IFdpbjY0OyB4NjQpIFwiICtcclxuICAgICAgICAgICAgXCJBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBcIiArXHJcbiAgICAgICAgICAgIFwiQ2hyb21lLzEzMS4wIFNhZmFyaS81MzcuMzZcIixcclxuXHJcbiAgICAgICAgICBBY2NlcHQ6XHJcbiAgICAgICAgICAgIFwidGV4dC9odG1sLGFwcGxpY2F0aW9uL3hodG1sK3htbCxcIiArXHJcbiAgICAgICAgICAgIFwiYXBwbGljYXRpb24veG1sO3E9MC45LHRleHQvcGxhaW47cT0wLjgsKi8qO3E9MC43XCIsXHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcclxuICAgICAgfSk7XHJcblxyXG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gSFRUUCBhY2Nlc3NpYmlsaXR5IGNoZWNrcy5cclxuICAgIC8vXHJcbiAgICAvLyBUaGVzZSBhcmUgbXVjaCBzdHJvbmdlciBzaWduYWxzIHRoYW4gc2ltcGx5IGZpbmRpbmcgd29yZHNcclxuICAgIC8vIHN1Y2ggYXMgXCJDbG91ZGZsYXJlXCIgb3IgXCJib3RcIiBpbiBwYWdlIGNvbnRlbnQuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4gICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDAxKSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgdXNhYmxlOiBmYWxzZSxcclxuICAgICAgICByZWFzb246XHJcbiAgICAgICAgICBcIkhUVFAgNDAxIFVuYXV0aG9yaXplZFwiLFxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwMykge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHVzYWJsZTogZmFsc2UsXHJcbiAgICAgICAgcmVhc29uOlxyXG4gICAgICAgICAgXCJIVFRQIDQwMyBGb3JiaWRkZW4gXHUyMDE0IHBhZ2UgaW5hY2Nlc3NpYmxlXCIsXHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDI5KSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgdXNhYmxlOiBmYWxzZSxcclxuICAgICAgICByZWFzb246XHJcbiAgICAgICAgICBcIkhUVFAgNDI5IFRvbyBNYW55IFJlcXVlc3RzIFx1MjAxNCByYXRlIGxpbWl0ZWRcIixcclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID49IDUwMCkge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHVzYWJsZTogZmFsc2UsXHJcbiAgICAgICAgcmVhc29uOlxyXG4gICAgICAgICAgYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9ICR7cmVzcG9uc2Uuc3RhdHVzVGV4dH0gXHUyMDE0IHNlcnZlciBlcnJvcmAsXHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHVzYWJsZTogZmFsc2UsXHJcbiAgICAgICAgcmVhc29uOlxyXG4gICAgICAgICAgYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9ICR7cmVzcG9uc2Uuc3RhdHVzVGV4dH1gLFxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIFRoZSBIVFRQIHJlcXVlc3Qgc3VjY2VlZGVkLlxyXG4gICAgLy9cclxuICAgIC8vIEdpdmUgdGhlIHBhZ2UgNCBzZWNvbmRzIGJlZm9yZSBpbnNwZWN0aW5nIGl0LlxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblx0ICBhd2FpdCBzbGVlcCh3YWl0Q2FwdGNoYSk7XHJcblxyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIFJlYWQgdGhlIHJldHVybmVkIHBhZ2UuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4gICAgY29uc3QgaHRtbCA9XHJcbiAgICAgIGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuXHJcbiAgICAvLyBJbnNwZWN0IGVub3VnaCBvZiB0aGUgcmF3IEhUTUwgdG8gY2F0Y2ggY2hhbGxlbmdlIHBhZ2VzLlxyXG4gICAgY29uc3QgaW5zcGVjdGlvblRleHQgPVxyXG4gICAgICBodG1sXHJcbiAgICAgICAgLnN1YnN0cmluZygwLCAxMDAwMDApO1xyXG5cclxuICAgIGNvbnN0IGNoYWxsZW5nZSA9XHJcbiAgICAgIGRldGVjdEFjdGl2ZUNoYWxsZW5nZShcclxuICAgICAgICBpbnNwZWN0aW9uVGV4dFxyXG4gICAgICApO1xyXG5cclxuICAgIGlmIChjaGFsbGVuZ2UpIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICB1c2FibGU6IGZhbHNlLFxyXG4gICAgICAgIHJlYXNvbjpcclxuICAgICAgICAgIGBhY3RpdmUgdmVyaWZpY2F0aW9uIGNoYWxsZW5nZSBkZXRlY3RlZDogJHtjaGFsbGVuZ2V9YCxcclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBFeHRyYWN0IHJlYWRhYmxlIGNvbnRlbnQuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4gICAgbGV0IGNvbnRlbnQgPVxyXG4gICAgICBleHRyYWN0VGV4dChodG1sKTtcclxuXHJcbiAgICAvLyBBIHBhZ2Ugd2l0aCBhbG1vc3Qgbm8gY29udGVudCBpc24ndCB1c2VmdWwgcmVzZWFyY2guXHJcbiAgICBjb25zdCB3b3JkQ291bnQgPSBjb250ZW50XHJcbiAgICAgIC5zcGxpdCgvXFxzKy8pXHJcbiAgICAgIC5maWx0ZXIoQm9vbGVhbilcclxuICAgICAgLmxlbmd0aDtcclxuXHJcbiAgICBpZiAod29yZENvdW50IDwgMTUwKSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgIHVzYWJsZTogZmFsc2UsXHJcbiAgICAgIHJlYXNvbjpcclxuICAgICAgICBgaW5zdWZmaWNpZW50IHJlYWRhYmxlIHBhZ2UgY29udGVudCAoJHt3b3JkQ291bnR9IHdvcmRzKWAsXHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY29udGVudExpbWl0cyA9IFtcclxuICAgICAgMzAwMCxcclxuICAgICAgMzAwMCxcclxuICAgICAgMTgwMCxcclxuICAgICAgMTgwMCxcclxuICAgICAgMTgwMCxcclxuICAgIF07XHJcblxyXG4gICAgY29uc3QgY29udGVudExpbWl0ID1cclxuICAgICAgY29udGVudExpbWl0c1tcclxuICAgICAgTWF0aC5taW4oXHJcbiAgICAgICAgc291cmNlSW5kZXgsXHJcbiAgICAgICAgY29udGVudExpbWl0cy5sZW5ndGggLSAxXHJcbiAgICAgIClcclxuICAgICAgXTtcclxuXHJcbiAgICBjb250ZW50ID0gc2VsZWN0UmVsZXZhbnRDb250ZW50KFxyXG4gICAgICBjb250ZW50LFxyXG4gICAgICBxdWVyeSxcclxuICAgICAgY29udGVudExpbWl0XHJcbiAgICApO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHVzYWJsZTogdHJ1ZSxcclxuICAgICAgdGl0bGU6IHJlc3VsdC50aXRsZSxcclxuICAgICAgdXJsOiByZXN1bHQudXJsLFxyXG4gICAgICBkb21haW4sXHJcbiAgICAgIGVuZ2luZTogcmVzdWx0LmVuZ2luZSxcclxuICAgICAgc2NvcmU6IHJlc3VsdC5zY29yZSxcclxuICAgICAgY29udGVudCxcclxuICAgIH07XHJcbiAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgIGlmIChcclxuICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciAmJlxyXG4gICAgICBlcnJvci5uYW1lID09PSBcIkFib3J0RXJyb3JcIlxyXG4gICAgKSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgdXNhYmxlOiBmYWxzZSxcclxuICAgICAgICByZWFzb246XHJcbiAgICAgICAgICBgcmVxdWVzdCB0aW1lZCBvdXQgYWZ0ZXIgJHt0aW1lb3V0fW1zYCxcclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICB1c2FibGU6IGZhbHNlLFxyXG4gICAgICByZWFzb246XHJcbiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvclxyXG4gICAgICAgICAgPyBlcnJvci5tZXNzYWdlXHJcbiAgICAgICAgICA6IFN0cmluZyhlcnJvciksXHJcbiAgICB9O1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRvb2xzUHJvdmlkZXIoXHJcbiAgY3RsOiBUb29sc1Byb3ZpZGVyQ29udHJvbGxlclxyXG4pOiBQcm9taXNlPFRvb2xbXT4ge1xyXG4gIGNvbnN0IHRvb2xzOiBUb29sW10gPSBbXTtcclxuXHJcbiAgY29uc3QgY29uZmlnID1cclxuICAgIGN0bC5nZXRQbHVnaW5Db25maWcoXHJcbiAgICAgIGNvbmZpZ1NjaGVtYXRpY3NcclxuICAgICk7XHJcblxyXG4gIGNvbnN0IHNlYXJ4bmdVcmwgPVxyXG4gICAgY29uZmlnLmdldChcclxuICAgICAgXCJzZWFyeG5nVXJsXCJcclxuICAgICkgYXMgc3RyaW5nO1xyXG5cclxuICBjb25zdCBkZWZhdWx0UGFnZVNpemUgPVxyXG4gICAgY29uZmlnLmdldChcclxuICAgICAgXCJkZWZhdWx0UGFnZVNpemVcIlxyXG4gICAgKSBhcyBudW1iZXI7XHJcblxyXG4gIGNvbnN0IHRpbWVvdXQgPVxyXG4gICAgY29uZmlnLmdldChcclxuICAgICAgXCJ0aW1lb3V0XCJcclxuICAgICkgYXMgbnVtYmVyO1xyXG5cclxuICBjb25zdCB3YWl0Q2FwdGNoYSA9XHJcbiAgY29uZmlnLmdldChcclxuICAgIFwid2FpdENhcHRjaGFUaW1lb3V0XCJcclxuICApIGFzIG51bWJlcjtcclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gIC8vIHNlYXJjaF93ZWJcclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIGNvbnN0IHNlYXJjaFRvb2wgPSB0b29sKHtcclxuICAgIG5hbWU6IFwic2VhcmNoX3dlYlwiLFxyXG5cclxuICAgIGRlc2NyaXB0aW9uOlxyXG5cdCAgXCJMaW1pdGVkIHdlYiBzZWFyY2ggdXNpbmcgU2VhclhORy4gXCIgK1xyXG5cdCAgXCJSZXR1cm5zIHNuaXBwZXRzIG9ubHkgYW5kIHNob3VsZCBiZSB1c2VkIG9ubHkgd2hlbiBmdWxsIHdlYnBhZ2UgcmVzZWFyY2ggaXMgdW5hdmFpbGFibGUuIFwiICtcclxuXHQgIFwiRm9yIGZhY3R1YWwsIGRldGFpbGVkLCBjdXJyZW50LCBjb21wYXJhdGl2ZSwgb3IgcmVzZWFyY2ggcXVlc3Rpb25zLCB1c2UgcmVzZWFyY2hfd2ViIGluc3RlYWQuXCIsXHJcblxyXG4gICAgcGFyYW1ldGVyczoge1xyXG4gICAgICBxdWVyeTogelxyXG4gICAgICAgIC5zdHJpbmcoKVxyXG4gICAgICAgIC5kZXNjcmliZShcclxuICAgICAgICAgIFwiVGhlIHNlYXJjaCBxdWVyeSBzdHJpbmdcIlxyXG4gICAgICAgICksXHJcblxyXG4gICAgICBudW1fcmVzdWx0czogelxyXG4gICAgICAgIC5udW1iZXIoKVxyXG4gICAgICAgIC5taW4oMSlcclxuICAgICAgICAubWF4KDIwKVxyXG4gICAgICAgIC5vcHRpb25hbCgpXHJcbiAgICAgICAgLmRlc2NyaWJlKFxyXG4gICAgICAgICAgYE51bWJlciBvZiByZXN1bHRzIHRvIHJldHVybiAoMS0yMCkuIERlZmF1bHQ6ICR7ZGVmYXVsdFBhZ2VTaXplfWBcclxuICAgICAgICApLFxyXG5cclxuICAgICAgdGltZV9yYW5nZTogelxyXG4gICAgICAgIC5zdHJpbmcoKVxyXG4gICAgICAgIC5vcHRpb25hbCgpXHJcbiAgICAgICAgLmRlc2NyaWJlKFxyXG4gICAgICAgICAgXCJPcHRpb25hbCB0aW1lIGZpbHRlcjogJ2RheScsICd3ZWVrJywgJ21vbnRoJywgb3IgJ3llYXInXCJcclxuICAgICAgICApLFxyXG5cclxuICAgICAgcGFnZTogelxyXG4gICAgICAgIC5udW1iZXIoKVxyXG4gICAgICAgIC5pbnQoKVxyXG4gICAgICAgIC5taW4oMSlcclxuICAgICAgICAub3B0aW9uYWwoKVxyXG4gICAgICAgIC5kZXNjcmliZShcclxuICAgICAgICBcIlNlYXJYTkcgcmVzdWx0IHBhZ2UgdG8gcmVzZWFyY2guIERlZmF1bHQ6IDEuXCJcclxuICAgICAgKSxcclxuICAgIH0sXHJcblxyXG4gICAgaW1wbGVtZW50YXRpb246IGFzeW5jIChwYXJhbXM6IHtcclxuICAgICAgcXVlcnk6IHN0cmluZztcclxuICAgICAgbnVtX3Jlc3VsdHM/OiBudW1iZXI7XHJcbiAgICAgIHRpbWVfcmFuZ2U/OiBzdHJpbmc7XHJcbiAgICAgIHBhZ2U/OiBudW1iZXI7XHJcbiAgICB9KSA9PiB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3Qge1xyXG4gICAgICAgICAgcXVlcnksXHJcbiAgICAgICAgICBudW1fcmVzdWx0cyxcclxuICAgICAgICAgIHRpbWVfcmFuZ2UsXHJcbiAgICAgICAgICBwYWdlID0gMSxcclxuICAgICAgICB9ID0gcGFyYW1zO1xyXG5cclxuICAgICAgICBjb25zdCBwYWdlU2l6ZSA9XHJcbiAgICAgICAgICBudW1fcmVzdWx0cyA/P1xyXG4gICAgICAgICAgZGVmYXVsdFBhZ2VTaXplO1xyXG5cclxuICAgICAgICBjb25zdCBzZWFyY2hQYXJhbXMgPVxyXG4gICAgICAgICAgbmV3IFVSTFNlYXJjaFBhcmFtcyh7XHJcbiAgICAgICAgICAgIHE6IHF1ZXJ5LFxyXG4gICAgICAgICAgICBmb3JtYXQ6IFwianNvblwiLFxyXG4gICAgICAgICAgICBwYWdlbm86IFN0cmluZyhwYWdlKSxcclxuICAgICAgICAgICAgc2FmZXNlYXJjaDogXCIwXCIsXHJcbiAgICAgICAgICB9KTtcclxuXHJcblx0XHRjb25zdCBub3JtYWxpemVkVGltZVJhbmdlID1cclxuXHRcdCAgdGltZV9yYW5nZT8udG9Mb3dlckNhc2UoKS50cmltKCk7XHJcblxyXG5cdFx0aWYgKG5vcm1hbGl6ZWRUaW1lUmFuZ2UpIHtcclxuXHRcdCAgY29uc3QgdmFsaWRSYW5nZXMgPSBbXHJcblx0XHRcdFwiZGF5XCIsXHJcblx0XHRcdFwid2Vla1wiLFxyXG5cdFx0XHRcIm1vbnRoXCIsXHJcblx0XHRcdFwieWVhclwiLFxyXG5cdFx0ICBdO1xyXG5cclxuXHRcdCAgaWYgKFxyXG5cdFx0XHR2YWxpZFJhbmdlcy5pbmNsdWRlcyhcclxuXHRcdFx0ICBub3JtYWxpemVkVGltZVJhbmdlXHJcblx0XHRcdClcclxuXHRcdCAgKSB7XHJcblx0XHRcdHNlYXJjaFBhcmFtcy5hcHBlbmQoXHJcblx0XHRcdCAgXCJ0aW1lX3JhbmdlXCIsXHJcblx0XHRcdCAgbm9ybWFsaXplZFRpbWVSYW5nZVxyXG5cdFx0XHQpO1xyXG5cdFx0ICB9XHJcblx0XHR9XHJcblxyXG4gICAgICAgIGNvbnN0IHNlYXJjaFVybCA9XHJcbiAgICAgICAgICBgJHtzZWFyeG5nVXJsfS9zZWFyY2g/JHtzZWFyY2hQYXJhbXMudG9TdHJpbmcoKX1gO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhcclxuICAgICAgICAgIGBRdWVyeWluZyBTZWFyWE5HOiAke3NlYXJjaFVybC5yZXBsYWNlKFxyXG4gICAgICAgICAgICAvZm9ybWF0PWpzb24vLFxyXG4gICAgICAgICAgICBcImZvcm1hdD0uLi5cIlxyXG4gICAgICAgICAgKX1gXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgY29udHJvbGxlciA9XHJcbiAgICAgICAgICBuZXcgQWJvcnRDb250cm9sbGVyKCk7XHJcblxyXG4gICAgICAgIGNvbnN0IHRpbWVvdXRJZCA9XHJcbiAgICAgICAgICBzZXRUaW1lb3V0KFxyXG4gICAgICAgICAgICAoKSA9PiBjb250cm9sbGVyLmFib3J0KCksXHJcbiAgICAgICAgICAgIHRpbWVvdXRcclxuICAgICAgICAgICk7XHJcblxyXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID1cclxuICAgICAgICAgIGF3YWl0IGZldGNoKHNlYXJjaFVybCwge1xyXG4gICAgICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXHJcblxyXG4gICAgICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICAgICAgQWNjZXB0OlxyXG4gICAgICAgICAgICAgICAgXCJhcHBsaWNhdGlvbi9qc29uXCIsXHJcbiAgICAgICAgICAgICAgXCJVc2VyLUFnZW50XCI6XHJcbiAgICAgICAgICAgICAgICBcIkxNLVN0dWRpby1QbHVnaW4vMS4wXCIsXHJcbiAgICAgICAgICAgIH0sXHJcblxyXG4gICAgICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xyXG5cclxuICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBTZWFyWE5HIHJldHVybmVkIHN0YXR1cyAke3Jlc3BvbnNlLnN0YXR1c306IGAgK1xyXG4gICAgICAgICAgICBgJHtyZXNwb25zZS5zdGF0dXNUZXh0fWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBkYXRhID1cclxuICAgICAgICAgIChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzIFNlYXJYTkdSZXNwb25zZTtcclxuXHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgIWRhdGEucmVzdWx0cyB8fFxyXG4gICAgICAgICAgZGF0YS5yZXN1bHRzLmxlbmd0aCA9PT0gMFxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgcmV0dXJuIGBObyByZXN1bHRzIGZvdW5kIGZvciBxdWVyeTogXCIke3F1ZXJ5fVwiYDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGZvcm1hdHRlZFJlc3VsdHMgPVxyXG4gICAgICAgICAgZGF0YS5yZXN1bHRzXHJcbiAgICAgICAgICAgIC5zbGljZSgwLCBwYWdlU2l6ZSlcclxuICAgICAgICAgICAgLm1hcChcclxuICAgICAgICAgICAgICAocmVzdWx0LCBpbmRleCkgPT5cclxuICAgICAgICAgICAgICAgIGBbJHtpbmRleCArIDF9XSAke3Jlc3VsdC50aXRsZX1cXG5gICtcclxuICAgICAgICAgICAgICAgIGBVUkw6ICR7cmVzdWx0LnVybH1cXG5gICtcclxuICAgICAgICAgICAgICAgIGBTbmlwcGV0OiAke3Jlc3VsdC5jb250ZW50LnN1YnN0cmluZyhcclxuICAgICAgICAgICAgICAgICAgMCxcclxuICAgICAgICAgICAgICAgICAgMzAwXHJcbiAgICAgICAgICAgICAgICApfSR7XHJcbiAgICAgICAgICAgICAgICAgIHJlc3VsdC5jb250ZW50Lmxlbmd0aCA+IDMwMFxyXG4gICAgICAgICAgICAgICAgICAgID8gXCIuLi5cIlxyXG4gICAgICAgICAgICAgICAgICAgIDogXCJcIlxyXG4gICAgICAgICAgICAgICAgfVxcbmAgK1xyXG4gICAgICAgICAgICAgICAgYFNvdXJjZTogJHtyZXN1bHQuZW5naW5lfWBcclxuICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICAuam9pbihcIlxcblxcblwiKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgIGBTZWFyY2ggcmVzdWx0cyBmb3IgXCIke3F1ZXJ5fVwiIGAgK1xyXG4gICAgICAgICAgYCgke01hdGgubWluKFxyXG4gICAgICAgICAgICBkYXRhLnJlc3VsdHMubGVuZ3RoLFxyXG4gICAgICAgICAgICBwYWdlU2l6ZVxyXG4gICAgICAgICAgKX0gb2YgJHtkYXRhLm51bWJlcl9vZl9yZXN1bHRzfSB0b3RhbCk6XFxuXFxuYCArXHJcbiAgICAgICAgICBmb3JtYXR0ZWRSZXN1bHRzICtcclxuICAgICAgICAgIFwiXFxuXFxuTm90ZTogVGhlc2UgcmVzdWx0cyBhcmUgZnJvbSBTZWFyWE5HIFwiICtcclxuICAgICAgICAgIFwibWV0YXNlYXJjaCBlbmdpbmUgYWdncmVnYXRpbmcgbXVsdGlwbGUgc291cmNlcy5cIlxyXG4gICAgICAgICk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciAmJlxyXG4gICAgICAgICAgZXJyb3IubmFtZSA9PT0gXCJBYm9ydEVycm9yXCJcclxuICAgICAgICApIHtcclxuICAgICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIGBFcnJvcjogU2VhclhORyByZXF1ZXN0IHRpbWVkIG91dCBhZnRlciBgICtcclxuICAgICAgICAgICAgYCR7dGltZW91dH1tcy4gQ2hlY2sgdGhhdCBTZWFyWE5HIGlzIHJ1bm5pbmcgYXQgYCArXHJcbiAgICAgICAgICAgIGAke3NlYXJ4bmdVcmx9LmBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgYEVycm9yIHNlYXJjaGluZyBTZWFyWE5HOiBgICtcclxuICAgICAgICAgIGAke1xyXG4gICAgICAgICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yXHJcbiAgICAgICAgICAgICAgPyBlcnJvci5tZXNzYWdlXHJcbiAgICAgICAgICAgICAgOiBTdHJpbmcoZXJyb3IpXHJcbiAgICAgICAgICB9YFxyXG4gICAgICAgICk7XHJcbiAgICAgIH1cclxuICAgIH0sXHJcbiAgfSk7XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAvLyBmZXRjaF9wYWdlX2NvbnRlbnRcclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIGNvbnN0IGZldGNoUGFnZVRvb2wgPSB0b29sKHtcclxuICAgIG5hbWU6IFwiZmV0Y2hfcGFnZV9jb250ZW50XCIsXHJcblxyXG4gICAgZGVzY3JpcHRpb246XHJcbiAgICAgIFwiRmV0Y2ggYW5kIGV4dHJhY3QgdGV4dCBjb250ZW50IGZyb20gYSBzcGVjaWZpYyBVUkwuXCIsXHJcblxyXG4gICAgcGFyYW1ldGVyczoge1xyXG4gICAgICB1cmw6IHpcclxuICAgICAgICAuc3RyaW5nKClcclxuICAgICAgICAudXJsKClcclxuICAgICAgICAuZGVzY3JpYmUoXHJcbiAgICAgICAgICBcIlRoZSBVUkwgdG8gZmV0Y2hcIlxyXG4gICAgICAgICksXHJcblxyXG4gICAgICBtYXhfbGVuZ3RoOiB6XHJcbiAgICAgICAgLm51bWJlcigpXHJcbiAgICAgICAgLm1pbigxMDApXHJcbiAgICAgICAgLm1heCgxMDAwMClcclxuICAgICAgICAub3B0aW9uYWwoKVxyXG4gICAgICAgIC5kZXNjcmliZShcclxuICAgICAgICAgIFwiTWF4aW11bSBjaGFyYWN0ZXJzIHRvIHJldHVybi4gRGVmYXVsdDogMjAwMC5cIlxyXG4gICAgICAgICksXHJcbiAgICB9LFxyXG5cclxuICAgIGltcGxlbWVudGF0aW9uOiBhc3luYyAocGFyYW1zOiB7XHJcbiAgICAgIHVybDogc3RyaW5nO1xyXG4gICAgICBtYXhfbGVuZ3RoPzogbnVtYmVyO1xyXG4gICAgfSkgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHtcclxuICAgICAgICAgIHVybCxcclxuICAgICAgICAgIG1heF9sZW5ndGgsXHJcbiAgICAgICAgfSA9IHBhcmFtcztcclxuXHJcbiAgICAgICAgY29uc3QgbWF4TGVuZ3RoID1cclxuICAgICAgICAgIG1heF9sZW5ndGggPz8gMjAwMDtcclxuXHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPVxyXG4gICAgICAgICAgYXdhaXQgZmV0Y2godXJsLCB7XHJcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICAgICBcIlVzZXItQWdlbnRcIjpcclxuICAgICAgICAgICAgICAgIFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IExNLVN0dWRpby1Cb3QvMS4wKVwiLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIGBGYWlsZWQgdG8gZmV0Y2ggJHt1cmx9OiBgICtcclxuICAgICAgICAgICAgYCR7cmVzcG9uc2Uuc3RhdHVzfSAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGh0bWwgPVxyXG4gICAgICAgICAgYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xyXG5cclxuICAgICAgICBsZXQgdGV4dCA9XHJcbiAgICAgICAgICBleHRyYWN0VGV4dChodG1sKTtcclxuXHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgdGV4dC5sZW5ndGggPlxyXG4gICAgICAgICAgbWF4TGVuZ3RoXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICB0ZXh0ID1cclxuICAgICAgICAgICAgdGV4dC5zdWJzdHJpbmcoXHJcbiAgICAgICAgICAgICAgMCxcclxuICAgICAgICAgICAgICBtYXhMZW5ndGhcclxuICAgICAgICAgICAgKSArXHJcbiAgICAgICAgICAgIFwiLi4uIFt0cnVuY2F0ZWRdXCI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgYENvbnRlbnQgZnJvbSAke3VybH06XFxuXFxuJHt0ZXh0fWBcclxuICAgICAgICApO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICBgRXJyb3IgZmV0Y2hpbmcgcGFnZTogYCArXHJcbiAgICAgICAgICBgJHtcclxuICAgICAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvclxyXG4gICAgICAgICAgICAgID8gZXJyb3IubWVzc2FnZVxyXG4gICAgICAgICAgICAgIDogU3RyaW5nKGVycm9yKVxyXG4gICAgICAgICAgfWBcclxuICAgICAgICApO1xyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gIH0pO1xyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgLy8gcmVzZWFyY2hfd2ViXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICBjb25zdCByZXNlYXJjaFRvb2wgPSB0b29sKHtcclxuICAgIG5hbWU6IFwicmVzZWFyY2hfd2ViXCIsXHJcblxyXG4gICAgZGVzY3JpcHRpb246XHJcblx0XHRcIlByaW1hcnkgd2ViIHJlc2VhcmNoIHRvb2wgdXNpbmcgbG9jYWwgU2VhclhORy4gXCIgK1xyXG5cdFx0XCJVc2UgZm9yIGZhY3R1YWwsIGRldGFpbGVkLCBjdXJyZW50LCBvciBjb21wYXJhdGl2ZSBxdWVzdGlvbnMuIFwiICtcclxuXHRcdFwiRmV0Y2hlcyBhbmQgcmVhZHMgYWN0dWFsIHdlYnBhZ2VzLCBub3Qgc25pcHBldHMsIGFuZCBjb2xsZWN0cyB1cCB0byA1IHVzYWJsZSBzb3VyY2VzLiBcIiArXHJcbiAgICBcIlNuaXBwZXRzIGFyZSBwcmltYXJpbHkgb25seSBmb3IgYWRkZWQgY29udGV4dC4gXCIgK1xyXG5cdFx0XCJSZWplY3RzIGluYWNjZXNzaWJsZSBwYWdlcyBhbmQgYWN0aXZlIHZlcmlmaWNhdGlvbiBjaGFsbGVuZ2VzLiBcIiArXHJcblx0XHRcIkNvbXBhcmUgbXVsdGlwbGUgc291cmNlcyBhbmQgYW5zd2VyIGZyb20gdGhlIHJldHVybmVkIFNPVVJDRSBjb250ZW50LiBcIiArXHJcblx0XHRcIkZvciBhbGwgZmFjdHVhbCBjbGFpbXMsIGluY2x1ZGUgYSBNYXJrZG93biBsaW5rIHRvIGl0cyBzdXBwb3J0aW5nIFNPVVJDRSBcIiArXHJcblx0XHRcImltbWVkaWF0ZWx5IGFmdGVyIHRoZSBjbGFpbS4gVXNlIHRoZSBTT1VSQ0UgdGl0bGUgYXMgdGhlIGxpbmsgdGV4dCwgaW5jbHVkaW5nIHRoZSBhcnRpY2xlJ3MgZGF0ZSBpZiBhdmFpbGFibGUuIFwiICtcclxuXHRcdFwiT25seSBsaW5rIHRvIFVSTHMgcHJlc2VudCBpbiB0aGUgcmV0dXJuZWQgU09VUkNFIGxpc3QuIFwiICtcclxuXHRcdFwiSWYgbm8gdXNhYmxlIHdlYnBhZ2VzIGFyZSBmb3VuZCBvbiBwYWdlIDEsIGFzayB3aGV0aGVyIHRoZSB1c2VyIHdhbnRzIFwiICtcclxuXHRcdFwidGhlIGF2YWlsYWJsZSBzbmlwcGV0cyBvciB0aGUgbmV4dCAxNSBjYW5kaWRhdGVzIGZyb20gcGFnZSAyLiBcIiArXHJcbiAgICBcIkFmdGVyd2FyZHMsIHdhaXQgZm9yIHRoZWlyIGFuc3dlci4gXCIgK1xyXG5cdFx0XCJJZiB0aGUgdXNlciByZXF1ZXN0cyB0aGUgbmV4dCByZXN1bHRzLCBjYWxsIHRoaXMgdG9vbCBhZ2FpbiB3aXRoIHBhZ2UgMi4gXCIgK1xyXG5cdFx0XCJEbyBub3QgYXV0b21hdGljYWxseSB1c2Ugc25pcHBldHMgdW5sZXNzIHRoZSB1c2VyIGNob29zZXMgdGhlbS4gXCIgK1xyXG5cdFx0XCJQcmVzZW50IGRpc3RpbmN0IG5ld3Mgc3RvcmllcyBzZXBhcmF0ZWx5IHJhdGhlciB0aGFuIGNvbWJpbmluZyB0aGVtIGludG8gYSBzaW5nbGUgbmFycmF0aXZlLlwiLFxyXG5cclxuICAgIHBhcmFtZXRlcnM6IHtcclxuICAgICAgcXVlcnk6IHpcclxuICAgICAgICAuc3RyaW5nKClcclxuICAgICAgICAuZGVzY3JpYmUoXHJcbiAgICAgICAgICBcIlRoZSB0b3BpYyBvciBxdWVzdGlvbiB0byByZXNlYXJjaFwiXHJcbiAgICAgICAgKSxcclxuXHJcbiAgICAgIHNvdXJjZXM6IHpcclxuICAgICAgICAubnVtYmVyKClcclxuICAgICAgICAubWluKDEpXHJcbiAgICAgICAgLm1heCg1KVxyXG4gICAgICAgIC5vcHRpb25hbCgpXHJcbiAgICAgICAgLmRlc2NyaWJlKFxyXG4gICAgICAgICAgXCJOdW1iZXIgb2YgdXNhYmxlIHdlYnBhZ2VzIHRvIGNvbGxlY3QuIERlZmF1bHQ6IDUuXCJcclxuICAgICAgICApLFxyXG5cclxuICAgICAgdGltZV9yYW5nZTogelxyXG4gICAgICAgIC5zdHJpbmcoKVxyXG4gICAgICAgIC5vcHRpb25hbCgpXHJcbiAgICAgICAgLmRlc2NyaWJlKFxyXG4gICAgICAgICAgXCJPcHRpb25hbCBmcmVzaG5lc3MgZmlsdGVyOiAnZGF5JywgJ3dlZWsnLCAnbW9udGgnLCBvciAneWVhcidcIlxyXG4gICAgICAgICksXHJcblx0XHRcclxuICAgICAgcGFnZTogelxyXG4gICAgICAgIC5udW1iZXIoKVxyXG4gICAgICAgIC5pbnQoKVxyXG4gICAgICAgIC5taW4oMSlcclxuICAgICAgICAub3B0aW9uYWwoKVxyXG4gICAgICAgIC5kZXNjcmliZShcclxuICAgICAgICBcIlNlYXJYTkcgcmVzdWx0IHBhZ2UgdG8gcmVzZWFyY2guIERlZmF1bHQ6IDEuXCJcclxuICAgICAgKSxcclxuXHRcdFxyXG4gICAgfSxcclxuXHJcbiAgICBpbXBsZW1lbnRhdGlvbjogYXN5bmMgKHBhcmFtczoge1xyXG4gICAgICBxdWVyeTogc3RyaW5nO1xyXG4gICAgICBzb3VyY2VzPzogbnVtYmVyO1xyXG4gICAgICB0aW1lX3JhbmdlPzogc3RyaW5nO1xyXG5cdCAgICBwYWdlPzogbnVtYmVyO1xyXG4gICAgfSkgPT4ge1xyXG4gICAgICBjb25zdCB7XHJcbiAgICAgICAgcXVlcnksXHJcbiAgICAgICAgc291cmNlcyxcclxuICAgICAgICB0aW1lX3JhbmdlLFxyXG5cdFx0ICAgIHBhZ2UgPSAxLFxyXG4gICAgICB9ID0gcGFyYW1zO1xyXG5cclxuICAgICAgY29uc3QgdGFyZ2V0U291cmNlcyA9XHJcbiAgICAgICAgc291cmNlcyA/P1xyXG4gICAgICAgIERFRkFVTFRfUkVTRUFSQ0hfU09VUkNFUztcclxuXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgICAgIC8vIFNURVAgMTogQXNrIFNlYXJYTkcgZm9yIDEwIGNhbmRpZGF0ZXMuXHJcbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuICAgICAgICBjb25zdCBzZWFyY2hQYXJhbXMgPVxyXG4gICAgICAgICAgbmV3IFVSTFNlYXJjaFBhcmFtcyh7XHJcbiAgICAgICAgICAgIHE6IHF1ZXJ5LFxyXG4gICAgICAgICAgICBmb3JtYXQ6IFwianNvblwiLFxyXG4gICAgICAgICAgICBwYWdlbm86IFN0cmluZyhwYWdlKSxcclxuICAgICAgICAgICAgc2FmZXNlYXJjaDogXCIwXCIsXHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKHRpbWVfcmFuZ2UpIHtcclxuICAgICAgICAgIGNvbnN0IHZhbGlkUmFuZ2VzID0gW1xyXG4gICAgICAgICAgICBcImRheVwiLFxyXG4gICAgICAgICAgICBcIndlZWtcIixcclxuICAgICAgICAgICAgXCJtb250aFwiLFxyXG4gICAgICAgICAgICBcInllYXJcIixcclxuICAgICAgICAgIF07XHJcblxyXG4gICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICB2YWxpZFJhbmdlcy5pbmNsdWRlcyhcclxuICAgICAgICAgICAgICB0aW1lX3JhbmdlXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICAgICkge1xyXG4gICAgICAgICAgICBzZWFyY2hQYXJhbXMuYXBwZW5kKFxyXG4gICAgICAgICAgICAgIFwidGltZV9yYW5nZVwiLFxyXG4gICAgICAgICAgICAgIHRpbWVfcmFuZ2VcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHNlYXJjaFVybCA9XHJcbiAgICAgICAgICBgJHtzZWFyeG5nVXJsfS9zZWFyY2g/JHtzZWFyY2hQYXJhbXMudG9TdHJpbmcoKX1gO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhcclxuICAgICAgICAgIGByZXNlYXJjaF93ZWI6IHNlYXJjaGluZyBmb3IgXCIke3F1ZXJ5fVwiYFxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPVxyXG4gICAgICAgICAgbmV3IEFib3J0Q29udHJvbGxlcigpO1xyXG5cclxuICAgICAgICBjb25zdCB0aW1lb3V0SWQgPVxyXG4gICAgICAgICAgc2V0VGltZW91dChcclxuICAgICAgICAgICAgKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLFxyXG4gICAgICAgICAgICB0aW1lb3V0XHJcbiAgICAgICAgICApO1xyXG5cclxuICAgICAgICBjb25zdCBzZWFyY2hSZXNwb25zZSA9XHJcbiAgICAgICAgICBhd2FpdCBmZXRjaChzZWFyY2hVcmwsIHtcclxuICAgICAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxyXG5cclxuICAgICAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICAgIEFjY2VwdDpcclxuICAgICAgICAgICAgICAgIFwiYXBwbGljYXRpb24vanNvblwiLFxyXG4gICAgICAgICAgICAgIFwiVXNlci1BZ2VudFwiOlxyXG4gICAgICAgICAgICAgICAgXCJMTS1TdHVkaW8tUGx1Z2luLzEuMFwiLFxyXG4gICAgICAgICAgICB9LFxyXG5cclxuICAgICAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcclxuICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcclxuXHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgIXNlYXJjaFJlc3BvbnNlLm9rXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBTZWFyWE5HIHJldHVybmVkICR7c2VhcmNoUmVzcG9uc2Uuc3RhdHVzfTogYCArXHJcbiAgICAgICAgICAgIGAke3NlYXJjaFJlc3BvbnNlLnN0YXR1c1RleHR9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGRhdGEgPVxyXG4gICAgICAgICAgKGF3YWl0IHNlYXJjaFJlc3BvbnNlLmpzb24oKSkgYXMgU2VhclhOR1Jlc3BvbnNlO1xyXG5cclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAhZGF0YS5yZXN1bHRzIHx8XHJcbiAgICAgICAgICBkYXRhLnJlc3VsdHMubGVuZ3RoID09PSAwXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICBgTm8gc2VhcmNoIHJlc3VsdHMgZm91bmQgZm9yIFwiJHtxdWVyeX1cIi5gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgY2FuZGlkYXRlcyA9XHJcbiAgICAgICAgICBkYXRhLnJlc3VsdHMuc2xpY2UoXHJcbiAgICAgICAgICAgIDAsXHJcbiAgICAgICAgICAgIFJFU0VBUkNIX0NBTkRJREFURVNcclxuICAgICAgICAgICk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKFxyXG4gICAgICAgICAgYHJlc2VhcmNoX3dlYjogcmVjZWl2ZWQgJHtjYW5kaWRhdGVzLmxlbmd0aH0gY2FuZGlkYXRlc2BcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAgICAgLy8gU1RFUCAyOiBDaGVjayBjYW5kaWRhdGVzIHNlcXVlbnRpYWxseS5cclxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4gICAgICAgIGNvbnN0IGFjY2VwdGVkOiBBY2NlcHRlZFNvdXJjZVtdID1cclxuICAgICAgICAgIFtdO1xyXG5cclxuICAgICAgICBjb25zdCByZWplY3RlZDogUmVqZWN0ZWRTb3VyY2VbXSA9XHJcbiAgICAgICAgICBbXTtcclxuXHJcbiAgICAgICAgY29uc3Qgc2VlbkRvbWFpbnMgPVxyXG4gICAgICAgICAgbmV3IFNldDxzdHJpbmc+KCk7XHJcblxyXG4gICAgICAgIGxldCBjYW5kaWRhdGVJbmRleCA9IDA7XHJcblxyXG4gICAgICAgIHdoaWxlIChcclxuICAgICAgICAgIGFjY2VwdGVkLmxlbmd0aCA8XHJcbiAgICAgICAgICAgIHRhcmdldFNvdXJjZXMgJiZcclxuICAgICAgICAgIGNhbmRpZGF0ZUluZGV4IDxcclxuICAgICAgICAgICAgY2FuZGlkYXRlcy5sZW5ndGhcclxuICAgICAgICApIHtcclxuICAgICAgICAgIGNvbnN0IGNhbmRpZGF0ZSA9XHJcbiAgICAgICAgICAgIGNhbmRpZGF0ZXNbXHJcbiAgICAgICAgICAgICAgY2FuZGlkYXRlSW5kZXhcclxuICAgICAgICAgICAgXTtcclxuXHJcbiAgICAgICAgICBjYW5kaWRhdGVJbmRleCsrO1xyXG5cclxuICAgICAgICAgIGxldCBkb21haW46IHN0cmluZztcclxuXHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBkb21haW4gPVxyXG4gICAgICAgICAgICAgIG5ldyBVUkwoXHJcbiAgICAgICAgICAgICAgICBjYW5kaWRhdGUudXJsXHJcbiAgICAgICAgICAgICAgKS5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIHJlamVjdGVkLnB1c2goe1xyXG4gICAgICAgICAgICAgIHRpdGxlOlxyXG4gICAgICAgICAgICAgICAgY2FuZGlkYXRlLnRpdGxlLFxyXG4gICAgICAgICAgICAgIHVybDpcclxuICAgICAgICAgICAgICAgIGNhbmRpZGF0ZS51cmwsXHJcbiAgICAgICAgICAgICAgcmVhc29uOlxyXG4gICAgICAgICAgICAgICAgXCJpbnZhbGlkIFVSTFwiLFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIEtlZXAgdGhlIHNvdXJjZSBzZXQgZGl2ZXJzZS5cclxuICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgc2VlbkRvbWFpbnMuaGFzKFxyXG4gICAgICAgICAgICAgIGRvbWFpblxyXG4gICAgICAgICAgICApXHJcbiAgICAgICAgICApIHtcclxuICAgICAgICAgICAgcmVqZWN0ZWQucHVzaCh7XHJcbiAgICAgICAgICAgICAgdGl0bGU6XHJcbiAgICAgICAgICAgICAgICBjYW5kaWRhdGUudGl0bGUsXHJcbiAgICAgICAgICAgICAgdXJsOlxyXG4gICAgICAgICAgICAgICAgY2FuZGlkYXRlLnVybCxcclxuICAgICAgICAgICAgICByZWFzb246XHJcbiAgICAgICAgICAgICAgICBcImR1cGxpY2F0ZSBkb21haW5cIixcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhcclxuICAgICAgICAgICAgYHJlc2VhcmNoX3dlYjogY2hlY2tpbmcgY2FuZGlkYXRlIGAgK1xyXG4gICAgICAgICAgICBgJHtjYW5kaWRhdGVJbmRleH0vJHtjYW5kaWRhdGVzLmxlbmd0aH06IGAgK1xyXG4gICAgICAgICAgICBgJHtjYW5kaWRhdGUudXJsfWBcclxuICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgY29uc3QgcmVzdWx0ID1cclxuICAgICAgICAgICAgYXdhaXQgZmV0Y2hDYW5kaWRhdGUoXHJcbiAgICAgICAgICAgICAgY2FuZGlkYXRlLFxyXG4gICAgICAgICAgICAgIHRpbWVvdXQsXHJcblx0XHRcdCAgICAgICAgcXVlcnksXHJcblx0XHRcdCAgICAgICAgYWNjZXB0ZWQubGVuZ3RoLFxyXG4gICAgICAgICAgICAgIHdhaXRDYXB0Y2hhXHJcbiAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgaWYgKCFyZXN1bHQudXNhYmxlKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFxyXG4gICAgICAgICAgICAgIGByZXNlYXJjaF93ZWI6IFJFSkVDVEVEIFx1MjAxNCBgICtcclxuICAgICAgICAgICAgICBgJHtjYW5kaWRhdGUudXJsfSBcdTIwMTQgJHtyZXN1bHQucmVhc29ufWBcclxuICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICAgIHJlamVjdGVkLnB1c2goe1xyXG4gICAgICAgICAgICAgIHRpdGxlOlxyXG4gICAgICAgICAgICAgICAgY2FuZGlkYXRlLnRpdGxlLFxyXG4gICAgICAgICAgICAgIHVybDpcclxuICAgICAgICAgICAgICAgIGNhbmRpZGF0ZS51cmwsXHJcbiAgICAgICAgICAgICAgcmVhc29uOlxyXG4gICAgICAgICAgICAgICAgcmVzdWx0LnJlYXNvbixcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAvLyBDYW5kaWRhdGUgaXMgZGlzY2FyZGVkLlxyXG4gICAgICAgICAgICAvLyBNb3ZlIGRpcmVjdGx5IHRvIHRoZSBuZXh0IFNlYXJYTkcgcmVzdWx0LlxyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgICAgICAgLy8gQUNDRVBURUQgU09VUkNFLlxyXG4gICAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbiAgICAgICAgICBzZWVuRG9tYWlucy5hZGQoXHJcbiAgICAgICAgICAgIGRvbWFpblxyXG4gICAgICAgICAgKTtcclxuXHJcblx0XHRcdGFjY2VwdGVkLnB1c2goe1xyXG5cdFx0XHQgIHRpdGxlOiByZXN1bHQudGl0bGUsXHJcblx0XHRcdCAgdXJsOiByZXN1bHQudXJsLFxyXG5cdFx0XHQgIGRvbWFpbjogcmVzdWx0LmRvbWFpbixcclxuXHRcdFx0ICBlbmdpbmU6IHJlc3VsdC5lbmdpbmUsXHJcblx0XHRcdCAgc2NvcmU6IHJlc3VsdC5zY29yZSxcclxuXHRcdFx0ICBjb250ZW50U291cmNlOiBcIkZFVENIRURfUEFHRVwiLFxyXG5cdFx0XHQgIGNvbnRlbnQ6IHJlc3VsdC5jb250ZW50LFxyXG5cdFx0XHR9KTtcclxuXHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhcclxuICAgICAgICAgICAgYHJlc2VhcmNoX3dlYjogQUNDRVBURUQgYCArXHJcbiAgICAgICAgICAgIGAke2FjY2VwdGVkLmxlbmd0aH0vJHt0YXJnZXRTb3VyY2VzfTogYCArXHJcbiAgICAgICAgICAgIGAke3Jlc3VsdC51cmx9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgICAgICAvLyBTVEVQIDM6IFJldHVybiByZXNlYXJjaCBwYWNrYWdlLlxyXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHRpZiAoYWNjZXB0ZWQubGVuZ3RoID09PSAwKSB7XHJcblx0XHQgIGNvbnN0IHNuaXBwZXRSZXN1bHRzID0gY2FuZGlkYXRlc1xyXG5cdFx0XHQubWFwKFxyXG5cdFx0XHQgIChjYW5kaWRhdGUsIGluZGV4KSA9PlxyXG5cdFx0XHRcdGBbJHtpbmRleCArIDF9XSAke2NhbmRpZGF0ZS50aXRsZX1cXG5gICtcclxuXHRcdFx0XHRgVVJMOiAke2NhbmRpZGF0ZS51cmx9XFxuYCArXHJcblx0XHRcdFx0YFNuaXBwZXQ6ICR7Y2FuZGlkYXRlLmNvbnRlbnQuc3Vic3RyaW5nKDAsIDUwMCl9YFxyXG5cdFx0XHQpXHJcblx0XHRcdC5qb2luKFwiXFxuXFxuXCIpO1xyXG5cclxuXHRcdCAgcmV0dXJuIChcclxuXHRcdFx0YEkgY291bGRuJ3QgYWNjZXNzIGFueSBvZiB0aGUgY3VycmVudCBgICtcclxuXHRcdFx0YCR7Y2FuZGlkYXRlSW5kZXh9IGNhbmRpZGF0ZSB3ZWJwYWdlcyBmb3IgXCIke3F1ZXJ5fVwiLlxcblxcbmAgK1xyXG5cdFx0XHRgV291bGQgeW91IGxpa2UgbWUgdG8gdXNlIHRoZSBhdmFpbGFibGUgc2VhcmNoIHNuaXBwZXRzLCBgICtcclxuXHRcdFx0YG9yIGF0dGVtcHQgdGhlIG5leHQgMTUgc2VhcmNoIHJlc3VsdHM/XFxuXFxuYCArXHJcblx0XHRcdGBBVkFJTEFCTEUgU05JUFBFVFM6XFxuXFxuYCArXHJcblx0XHRcdHNuaXBwZXRSZXN1bHRzXHJcblx0XHQgICk7XHJcblx0XHR9XHJcblxyXG4gICAgICAgIGxldCBvdXRwdXQgPVxyXG4gICAgICAgICAgYFJFU0VBUkNIIFJFU1VMVFNcXG5gICtcclxuICAgICAgICAgIGBRdWVyeTogJHtxdWVyeX1cXG5gICtcclxuICAgICAgICAgIGBVc2FibGUgc291cmNlczogJHthY2NlcHRlZC5sZW5ndGh9LyR7dGFyZ2V0U291cmNlc31cXG5gICtcclxuICAgICAgICAgIGBDYW5kaWRhdGVzIGNoZWNrZWQ6ICR7Y2FuZGlkYXRlSW5kZXh9XFxuXFxuYCArXHJcbiAgICAgICAgICBgT25seSBzb3VyY2VzIGxpc3RlZCB1bmRlciBTT1VSQ0UgMSB0aHJvdWdoIGAgK1xyXG4gICAgICAgICAgYFNPVVJDRSAke2FjY2VwdGVkLmxlbmd0aH0gd2VyZSBhY2NlcHRlZCBhbmQgc3VwcGxpZWQgYCArXHJcbiAgICAgICAgICBgYXMgcmVzZWFyY2ggbWF0ZXJpYWwuXFxuXFxuYDtcclxuXHJcbiAgICAgICAgYWNjZXB0ZWQuZm9yRWFjaChcclxuICAgICAgICAgIChzb3VyY2UsIGluZGV4KSA9PiB7XHJcbiAgICAgICAgICAgIG91dHB1dCArPVxyXG4gICAgICAgICAgICAgIGBTT1VSQ0UgJHtpbmRleCArIDF9XFxuYCArXHJcbiAgICAgICAgICAgICAgYFRpdGxlOiAke3NvdXJjZS50aXRsZX1cXG5gICtcclxuICAgICAgICAgICAgICBgVVJMOiAke3NvdXJjZS51cmx9XFxuYCArXHJcbiAgICAgICAgICAgICAgYCR7c291cmNlLmNvbnRlbnR9XFxuXFxuYDtcclxuICAgICAgICAgIH1cclxuICAgICAgICApO1xyXG5cclxuICAgICAgICByZXR1cm4gb3V0cHV0O1xyXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgJiZcclxuICAgICAgICAgIGVycm9yLm5hbWUgPT09IFwiQWJvcnRFcnJvclwiXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICBgUmVzZWFyY2ggcmVxdWVzdCB0aW1lZCBvdXQgYWZ0ZXIgYCArXHJcbiAgICAgICAgICAgIGAke3RpbWVvdXR9bXMuIENoZWNrIFNlYXJYTkcgYXQgJHtzZWFyeG5nVXJsfS5gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgIGBFcnJvciByZXNlYXJjaGluZyBcIiR7cXVlcnl9XCI6IGAgK1xyXG4gICAgICAgICAgYCR7XHJcbiAgICAgICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3JcclxuICAgICAgICAgICAgICA/IGVycm9yLm1lc3NhZ2VcclxuICAgICAgICAgICAgICA6IFN0cmluZyhlcnJvcilcclxuICAgICAgICAgIH1gXHJcbiAgICAgICAgKTtcclxuICAgICAgfVxyXG4gICAgfSxcclxuICB9KTtcclxuXHJcbiAgdG9vbHMucHVzaChzZWFyY2hUb29sKTtcclxuICB0b29scy5wdXNoKGZldGNoUGFnZVRvb2wpO1xyXG4gIHRvb2xzLnB1c2gocmVzZWFyY2hUb29sKTtcclxuXHJcbiAgcmV0dXJuIHRvb2xzO1xyXG59IiwgImltcG9ydCB7IFBsdWdpbkNvbnRleHQgfSBmcm9tIFwiQGxtc3R1ZGlvL3Nka1wiO1xyXG5pbXBvcnQgeyB0b29sc1Byb3ZpZGVyIH0gZnJvbSBcIi4vdG9vbHNQcm92aWRlclwiO1xyXG5pbXBvcnQgeyBjb25maWdTY2hlbWF0aWNzIH0gZnJvbSBcIi4vY29uZmlnXCI7XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWFpbihjb250ZXh0OiBQbHVnaW5Db250ZXh0KSB7XHJcbiAgLy8gUmVnaXN0ZXIgY29uZmlndXJhdGlvbiBzY2hlbWF0aWNzXHJcbiAgY29udGV4dC53aXRoQ29uZmlnU2NoZW1hdGljcyhjb25maWdTY2hlbWF0aWNzKTtcclxuXHJcbiAgLy8gUmVnaXN0ZXIgdGhlIHRvb2xzIHByb3ZpZGVyXHJcbiAgY29udGV4dC53aXRoVG9vbHNQcm92aWRlcih0b29sc1Byb3ZpZGVyKTtcclxuXHJcbiAgLy8gVXNlIGNvbnNvbGUubG9nIGluc3RlYWQgb2YgY29udGV4dC5sb2dcclxuICBjb25zb2xlLmxvZyhcIlNlYXJYTkcgU2VhcmNoIFBsdWdpbiBpbml0aWFsaXplZFwiKTtcclxufVxyXG4iLCAiaW1wb3J0IHsgTE1TdHVkaW9DbGllbnQsIHR5cGUgUGx1Z2luQ29udGV4dCB9IGZyb20gXCJAbG1zdHVkaW8vc2RrXCI7XG5cbmRlY2xhcmUgdmFyIHByb2Nlc3M6IGFueTtcblxuLy8gV2UgcmVjZWl2ZSBydW50aW1lIGluZm9ybWF0aW9uIGluIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMuXG5jb25zdCBjbGllbnRJZGVudGlmaWVyID0gcHJvY2Vzcy5lbnYuTE1TX1BMVUdJTl9DTElFTlRfSURFTlRJRklFUjtcbmNvbnN0IGNsaWVudFBhc3NrZXkgPSBwcm9jZXNzLmVudi5MTVNfUExVR0lOX0NMSUVOVF9QQVNTS0VZO1xuY29uc3QgYmFzZVVybCA9IHByb2Nlc3MuZW52LkxNU19QTFVHSU5fQkFTRV9VUkw7XG5cbmNvbnN0IGNsaWVudCA9IG5ldyBMTVN0dWRpb0NsaWVudCh7XG4gIGNsaWVudElkZW50aWZpZXIsXG4gIGNsaWVudFBhc3NrZXksXG4gIGJhc2VVcmwsXG59KTtcblxuKGdsb2JhbFRoaXMgYXMgYW55KS5fX0xNU19QTFVHSU5fQ09OVEVYVCA9IHRydWU7XG5cbmxldCBwcmVkaWN0aW9uTG9vcEhhbmRsZXJTZXQgPSBmYWxzZTtcbmxldCBwcm9tcHRQcmVwcm9jZXNzb3JTZXQgPSBmYWxzZTtcbmxldCBjb25maWdTY2hlbWF0aWNzU2V0ID0gZmFsc2U7XG5sZXQgZ2xvYmFsQ29uZmlnU2NoZW1hdGljc1NldCA9IGZhbHNlO1xubGV0IHRvb2xzUHJvdmlkZXJTZXQgPSBmYWxzZTtcbmxldCBnZW5lcmF0b3JTZXQgPSBmYWxzZTtcblxuY29uc3Qgc2VsZlJlZ2lzdHJhdGlvbkhvc3QgPSBjbGllbnQucGx1Z2lucy5nZXRTZWxmUmVnaXN0cmF0aW9uSG9zdCgpO1xuXG5jb25zdCBwbHVnaW5Db250ZXh0OiBQbHVnaW5Db250ZXh0ID0ge1xuICB3aXRoUHJlZGljdGlvbkxvb3BIYW5kbGVyOiAoZ2VuZXJhdGUpID0+IHtcbiAgICBpZiAocHJlZGljdGlvbkxvb3BIYW5kbGVyU2V0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJQcmVkaWN0aW9uTG9vcEhhbmRsZXIgYWxyZWFkeSByZWdpc3RlcmVkXCIpO1xuICAgIH1cbiAgICBpZiAodG9vbHNQcm92aWRlclNldCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUHJlZGljdGlvbkxvb3BIYW5kbGVyIGNhbm5vdCBiZSB1c2VkIHdpdGggYSB0b29scyBwcm92aWRlclwiKTtcbiAgICB9XG5cbiAgICBwcmVkaWN0aW9uTG9vcEhhbmRsZXJTZXQgPSB0cnVlO1xuICAgIHNlbGZSZWdpc3RyYXRpb25Ib3N0LnNldFByZWRpY3Rpb25Mb29wSGFuZGxlcihnZW5lcmF0ZSk7XG4gICAgcmV0dXJuIHBsdWdpbkNvbnRleHQ7XG4gIH0sXG4gIHdpdGhQcm9tcHRQcmVwcm9jZXNzb3I6IChwcmVwcm9jZXNzKSA9PiB7XG4gICAgaWYgKHByb21wdFByZXByb2Nlc3NvclNldCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUHJvbXB0UHJlcHJvY2Vzc29yIGFscmVhZHkgcmVnaXN0ZXJlZFwiKTtcbiAgICB9XG4gICAgcHJvbXB0UHJlcHJvY2Vzc29yU2V0ID0gdHJ1ZTtcbiAgICBzZWxmUmVnaXN0cmF0aW9uSG9zdC5zZXRQcm9tcHRQcmVwcm9jZXNzb3IocHJlcHJvY2Vzcyk7XG4gICAgcmV0dXJuIHBsdWdpbkNvbnRleHQ7XG4gIH0sXG4gIHdpdGhDb25maWdTY2hlbWF0aWNzOiAoY29uZmlnU2NoZW1hdGljcykgPT4ge1xuICAgIGlmIChjb25maWdTY2hlbWF0aWNzU2V0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb25maWcgc2NoZW1hdGljcyBhbHJlYWR5IHJlZ2lzdGVyZWRcIik7XG4gICAgfVxuICAgIGNvbmZpZ1NjaGVtYXRpY3NTZXQgPSB0cnVlO1xuICAgIHNlbGZSZWdpc3RyYXRpb25Ib3N0LnNldENvbmZpZ1NjaGVtYXRpY3MoY29uZmlnU2NoZW1hdGljcyk7XG4gICAgcmV0dXJuIHBsdWdpbkNvbnRleHQ7XG4gIH0sXG4gIHdpdGhHbG9iYWxDb25maWdTY2hlbWF0aWNzOiAoZ2xvYmFsQ29uZmlnU2NoZW1hdGljcykgPT4ge1xuICAgIGlmIChnbG9iYWxDb25maWdTY2hlbWF0aWNzU2V0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJHbG9iYWwgY29uZmlnIHNjaGVtYXRpY3MgYWxyZWFkeSByZWdpc3RlcmVkXCIpO1xuICAgIH1cbiAgICBnbG9iYWxDb25maWdTY2hlbWF0aWNzU2V0ID0gdHJ1ZTtcbiAgICBzZWxmUmVnaXN0cmF0aW9uSG9zdC5zZXRHbG9iYWxDb25maWdTY2hlbWF0aWNzKGdsb2JhbENvbmZpZ1NjaGVtYXRpY3MpO1xuICAgIHJldHVybiBwbHVnaW5Db250ZXh0O1xuICB9LFxuICB3aXRoVG9vbHNQcm92aWRlcjogKHRvb2xzUHJvdmlkZXIpID0+IHtcbiAgICBpZiAodG9vbHNQcm92aWRlclNldCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVG9vbHMgcHJvdmlkZXIgYWxyZWFkeSByZWdpc3RlcmVkXCIpO1xuICAgIH1cbiAgICBpZiAocHJlZGljdGlvbkxvb3BIYW5kbGVyU2V0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUb29scyBwcm92aWRlciBjYW5ub3QgYmUgdXNlZCB3aXRoIGEgcHJlZGljdGlvbkxvb3BIYW5kbGVyXCIpO1xuICAgIH1cblxuICAgIHRvb2xzUHJvdmlkZXJTZXQgPSB0cnVlO1xuICAgIHNlbGZSZWdpc3RyYXRpb25Ib3N0LnNldFRvb2xzUHJvdmlkZXIodG9vbHNQcm92aWRlcik7XG4gICAgcmV0dXJuIHBsdWdpbkNvbnRleHQ7XG4gIH0sXG4gIHdpdGhHZW5lcmF0b3I6IChnZW5lcmF0b3IpID0+IHtcbiAgICBpZiAoZ2VuZXJhdG9yU2V0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJHZW5lcmF0b3IgYWxyZWFkeSByZWdpc3RlcmVkXCIpO1xuICAgIH1cblxuICAgIGdlbmVyYXRvclNldCA9IHRydWU7XG4gICAgc2VsZlJlZ2lzdHJhdGlvbkhvc3Quc2V0R2VuZXJhdG9yKGdlbmVyYXRvcik7XG4gICAgcmV0dXJuIHBsdWdpbkNvbnRleHQ7XG4gIH0sXG59O1xuXG5pbXBvcnQoXCIuLy4uL3NyYy9pbmRleC50c1wiKS50aGVuKGFzeW5jIG1vZHVsZSA9PiB7XG4gIHJldHVybiBhd2FpdCBtb2R1bGUubWFpbihwbHVnaW5Db250ZXh0KTtcbn0pLnRoZW4oKCkgPT4ge1xuICBzZWxmUmVnaXN0cmF0aW9uSG9zdC5pbml0Q29tcGxldGVkKCk7XG59KS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byBleGVjdXRlIHRoZSBtYWluIGZ1bmN0aW9uIG9mIHRoZSBwbHVnaW4uXCIpO1xuICBjb25zb2xlLmVycm9yKGVycm9yKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxnQkFFYTtBQUZiO0FBQUE7QUFBQTtBQUFBLGlCQUF1QztBQUVoQyxJQUFNLHVCQUFtQixtQ0FBdUIsRUFDcEQ7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxRQUNFLGFBQWE7QUFBQSxRQUNiLFVBQVU7QUFBQSxNQUNaO0FBQUEsTUFDQTtBQUFBO0FBQUEsSUFDRixFQUNDO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsUUFDRSxhQUFhO0FBQUEsUUFDYixVQUFVO0FBQUEsUUFDVixLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsTUFDUDtBQUFBLE1BQ0E7QUFBQTtBQUFBLElBQ0YsRUFDQztBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLFFBQ0UsYUFBYTtBQUFBLFFBQ2IsVUFBVTtBQUFBLFFBQ1YsS0FBSztBQUFBLFFBQ0wsS0FBSztBQUFBLE1BQ1A7QUFBQSxNQUNBO0FBQUE7QUFBQSxJQUNGLEVBQ0U7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxRQUNFLGFBQWE7QUFBQSxRQUNiLFVBQVU7QUFBQSxRQUNWLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxNQUNQO0FBQUEsTUFDQTtBQUFBO0FBQUEsSUFDRixFQUNDLE1BQU07QUFBQTtBQUFBOzs7QUNBVCxTQUFTLE1BQU0sSUFBMkI7QUFDeEMsU0FBTyxJQUFJLFFBQVEsQ0FBQyxZQUFZLFdBQVcsU0FBUyxFQUFFLENBQUM7QUFDekQ7QUFLQSxTQUFTLHNCQUFzQixNQUFzQjtBQUNuRCxTQUFPLEtBQ0osWUFBWSxFQUNaLFFBQVEsUUFBUSxHQUFHLEVBQ25CLEtBQUs7QUFDVjtBQXFCQSxTQUFTLHNCQUFzQixNQUE2QjtBQUMxRCxRQUFNLGFBQWEsc0JBQXNCLElBQUk7QUFNN0MsUUFBTSxvQkFBNkM7QUFBQSxJQUNqRDtBQUFBLE1BQ0U7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFBQSxNQUNFO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxJQUNBO0FBQUEsTUFDRTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsSUFDQTtBQUFBLE1BQ0U7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFBQSxNQUNFO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxJQUNBO0FBQUEsTUFDRTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsSUFDQTtBQUFBLE1BQ0U7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFBQSxNQUNFO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxJQUNBO0FBQUEsTUFDRTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsSUFDQTtBQUFBLE1BQ0U7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFBQSxNQUNFO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxJQUNBO0FBQUEsTUFDRTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsSUFDQTtBQUFBLE1BQ0U7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFBQSxNQUNFO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxJQUNBO0FBQUEsTUFDRTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsSUFDQTtBQUFBLE1BQ0U7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFBQSxNQUNFO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxJQUNBO0FBQUEsTUFDRTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsSUFDQTtBQUFBLE1BQ0U7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFBQSxNQUNFO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxJQUNBO0FBQUEsTUFDRTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsSUFDQTtBQUFBLE1BQ0U7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFBQSxNQUNFO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxJQUNBO0FBQUEsTUFDRTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsSUFDQTtBQUFBLE1BQ0U7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFBQSxNQUNFO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBRUEsYUFBVyxDQUFDLFNBQVMsTUFBTSxLQUFLLG1CQUFtQjtBQUNqRCxRQUFJLFFBQVEsS0FBSyxVQUFVLEdBQUc7QUFDNUIsYUFBTztBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBU0YsUUFBTSxZQUFZLFdBQ2YsTUFBTSxLQUFLLEVBQ1gsT0FBTyxPQUFPLEVBQ2Q7QUFFSCxRQUFNLCtC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cEMsUUFBSSxrQkFBa0I7QUFDcEIsWUFBTSxJQUFJLE1BQU0sbUNBQW1DO0FBQUEsSUFDckQ7QUFDQSxRQUFJLDBCQUEwQjtBQUM1QixZQUFNLElBQUksTUFBTSw0REFBNEQ7QUFBQSxJQUM5RTtBQUVBLHVCQUFtQjtBQUNuQix5QkFBcUIsaUJBQWlCQSxjQUFhO0FBQ25ELFdBQU87QUFBQSxFQUNUO0FBQUEsRUFDQSxlQUFlLENBQUMsY0FBYztBQUM1QixRQUFJLGNBQWM7QUFDaEIsWUFBTSxJQUFJLE1BQU0sOEJBQThCO0FBQUEsSUFDaEQ7QUFFQSxtQkFBZTtBQUNmLHlCQUFxQixhQUFhLFNBQVM7QUFDM0MsV0FBTztBQUFBLEVBQ1Q7QUFDRjtBQUVBLHdEQUE0QixLQUFLLE9BQU1DLFlBQVU7QUFDL0MsU0FBTyxNQUFNQSxRQUFPLEtBQUssYUFBYTtBQUN4QyxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ1osdUJBQXFCLGNBQWM7QUFDckMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxVQUFVO0FBQ2xCLFVBQVEsTUFBTSxvREFBb0Q7QUFDbEUsVUFBUSxNQUFNLEtBQUs7QUFDckIsQ0FBQzsiLAogICJuYW1lcyI6IFsic3RvcHdvcmRzIiwgImltcG9ydF9zZGsiLCAiaW1wb3J0X3NkayIsICJjb25maWdTY2hlbWF0aWNzIiwgInRvb2xzUHJvdmlkZXIiLCAibW9kdWxlIl0KfQo=
