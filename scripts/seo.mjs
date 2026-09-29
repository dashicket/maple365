// 정적 HTML과 사이트맵을 함께 갱신합니다. 외부 패키지나 브라우저 실행이 필요 없습니다.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const flags = new Set(process.argv.slice(2));
const checking = flags.has("--check");
const managed = /^[ \t]*<!-- SEO:START -->\r?\n[\s\S]*?^[ \t]*<!-- SEO:END -->\r?\n?/gm;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readOptional(file) {
  try {
    return await readFile(join(root, file), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function attribute(tag, name) {
  const attrs = [...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)];
  return attrs.find((match) => match[1].toLowerCase() === name)?.[3];
}

function plainText(value) {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (entity) => ({
      "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'"
    })[entity]);
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[char]);
}

function productionOrigin(value) {
  assert(typeof value === "string", "seo.config.json의 siteUrl은 문자열이어야 합니다.");
  if (!value.trim()) return "";
  const url = new URL(value.trim());
  const hostname = url.hostname.toLowerCase();
  assert(url.protocol === "https:" && !url.username && !url.password && !url.port &&
    url.pathname === "/" && !url.search && !url.hash,
    "siteUrl에는 경로·쿼리·포트 없는 실제 HTTPS 운영 도메인을 입력하세요.");
  assert(hostname.includes(".") && !hostname.endsWith(".") && !isIP(hostname) &&
    !/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(hostname) &&
    !/(^|\.)example\.(com|net|org)$/.test(hostname),
    "siteUrl에는 로컬·테스트·예시 주소 대신 실제 운영 도메인이 필요합니다.");
  return url.origin;
}

function inspectPage(source, page, config, titles, descriptions) {
  const head = source.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  assert(head, `${page.file}: head가 없습니다.`);
  const titleTags = [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
  assert(titleTags.length === 1, `${page.file}: title이 하나 있어야 합니다.`);
  const title = plainText(titleTags[0][1]);
  const metas = head.match(/<meta\b[^>]*>/gi) || [];
  const meta = (key) => {
    const found = metas.filter((tag) => attribute(tag, "name") === key || attribute(tag, "property") === key);
    assert(found.length === 1, `${page.file}: ${key} 메타정보가 하나 있어야 합니다.`);
    return plainText(attribute(found[0], "content") || "");
  };
  const description = meta("description");
  assert(title && !titles.has(title), `${page.file}: title이 비었거나 다른 페이지와 같습니다.`);
  assert(description && !descriptions.has(description), `${page.file}: 설명이 비었거나 다른 페이지와 같습니다.`);
  titles.add(title);
  descriptions.add(description);
  assert(meta("og:title") === title && meta("og:description") === description,
    `${page.file}: 검색 제목·설명과 Open Graph 제목·설명을 맞춰 주세요.`);
  assert(meta("og:site_name") === config.siteName, `${page.file}: og:site_name을 확인하세요.`);
  assert(attribute(source.match(/<html\b[^>]*>/i)?.[0] || "", "lang") === "ko",
    `${page.file}: 문서 언어 lang="ko"를 확인하세요.`);
  const headings = [...source.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  assert(headings.length === 1 && plainText(headings[0][1]), `${page.file}: 내용이 있는 H1이 하나 있어야 합니다.`);
  for (const image of source.match(/<img\b[^>]*>/gi) || []) {
    assert(attribute(image, "alt") !== undefined, `${page.file}: 이미지의 alt 속성이 빠졌습니다.`);
  }
  assert(!/\bhref=["']index\.html(?:["'#?])/i.test(source),
    `${page.file}: 홈 링크는 중복 URL 대신 ./를 사용하세요.`);
  const outside = source.replace(managed, "");
  const unmanagedTags = outside.match(/<(?:meta|link)\b[^>]*>/gi) || [];
  assert(!unmanagedTags.some((tag) => attribute(tag, "name") === "robots" ||
    attribute(tag, "rel") === "canonical" || attribute(tag, "property") === "og:url"),
    `${page.file}: robots·canonical·og:url은 SEO 관리 블록에서만 관리하세요.`);
}

function structuredData(source, page, config, origin, url) {
  if (!page.indexable) return null;
  if (page.file === "index.html") {
    return {
      "@context": "https://schema.org", "@type": "WebSite",
      name: config.siteName, alternateName: config.alternateName,
      url, inLanguage: "ko-KR"
    };
  }
  const breadcrumb = source.match(/<nav\b[^>]*class=["'][^"']*\bbreadcrumb\b[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i)?.[1];
  const current = breadcrumb?.match(/<span\b[^>]*aria-current=["']page["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
  assert(current && plainText(current), `${page.file}: 화면에 표시되는 현재 위치 안내를 확인하세요.`);
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: plainText(current), item: url }
    ]
  };
}

function updateHead(source, page, config, origin) {
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = ["    <!-- SEO:START -->",
    `    <meta name="robots" content="${page.indexable ? "index,follow,max-image-preview:large" : "noindex,follow"}" />`];
  if (origin && page.file !== "404.html") {
    const url = `${origin}/${page.file === "index.html" ? "" : page.file}`;
    lines.push(`    <link rel="canonical" href="${escapeXml(url)}" />`,
      `    <meta property="og:url" content="${escapeXml(url)}" />`);
    const data = structuredData(source, page, config, origin, url);
    if (data) {
      lines.push('    <script type="application/ld+json" id="seo-schema">',
        ...JSON.stringify(data, null, 2).replace(/</g, "\\u003c").split("\n").map((line) => `      ${line}`),
        "    </script>");
    }
  }
  lines.push("    <!-- SEO:END -->");
  const block = lines.join(eol) + eol;
  const blocks = [...source.matchAll(managed)];
  assert(blocks.length <= 1, `${page.file}: SEO 관리 블록이 중복되었습니다.`);
  if (blocks.length) return source.replace(managed, () => block);
  assert(/^[ \t]*<\/head>/m.test(source), `${page.file}: head 닫는 태그를 확인하세요.`);
  return source.replace(/^[ \t]*<\/head>/m, (closing) => block + closing);
}

async function main() {
  assert([...flags].every((flag) => ["--check", "--require-domain"].includes(flag)),
    "사용법: node scripts/seo.mjs [--check] [--require-domain]");
  const config = JSON.parse(await readFile(join(root, "seo.config.json"), "utf8"));
  const origin = productionOrigin(config.siteUrl);
  assert(origin || !flags.has("--require-domain"), "배포 전에 seo.config.json의 siteUrl에 실제 운영 도메인을 등록하세요.");
  assert(typeof config.siteName === "string" && config.siteName.trim() &&
    typeof config.alternateName === "string" && config.alternateName.trim(), "사이트 이름을 확인하세요.");
  assert(Array.isArray(config.pages) && config.pages.length, "검색 설정에 페이지 목록이 필요합니다.");
  const configured = new Set();
  for (const page of config.pages) {
    assert(typeof page.file === "string" && /^[a-z0-9-]+\.html$/.test(page.file) &&
      typeof page.indexable === "boolean" && !configured.has(page.file), "페이지 파일명·검색 허용 여부·중복을 확인하세요.");
    configured.add(page.file);
  }
  const actual = (await readdir(root)).filter((file) => file.endsWith(".html"));
  const missing = actual.filter((file) => !configured.has(file));
  assert(!missing.length, `seo.config.json에 새 페이지를 등록하세요: ${missing.join(", ")}`);
  assert(config.pages.some((page) => page.file === "index.html" && page.indexable), "메인은 검색 허용 상태여야 합니다.");
  assert(config.pages.some((page) => page.file === "404.html" && !page.indexable), "404 페이지는 검색 제외 상태여야 합니다.");
  const existingSitemap = await readOptional("sitemap.xml");
  const existingLocations = [...(existingSitemap || "").matchAll(/<loc>(.*?)<\/loc>/g)];
  const isTemplate = existingLocations.length > 0 &&
    existingLocations.every((match) => match[1].startsWith("{{SITE_URL}}/"));
  assert(origin || existingSitemap === null || isTemplate,
    "운영 주소가 들어 있는 sitemap.xml이 있습니다. siteUrl에 운영 도메인을 다시 설정하세요.");

  // 모든 입력 검증이 끝난 뒤에만 파일을 씁니다.
  const outputs = new Map();
  const titles = new Set();
  const descriptions = new Set();
  for (const page of config.pages) {
    const source = await readFile(join(root, page.file), "utf8");
    inspectPage(source, page, config, titles, descriptions);
    outputs.set(page.file, updateHead(source, page, config, origin));
  }
  const indexable = config.pages.filter((page) => page.indexable);
  outputs.set("robots.txt", "# Generated by node scripts/seo.mjs\nUser-agent: *\nAllow: /\n" +
    (origin ? `\nSitemap: ${origin}/sitemap.xml\n` : "\n# Sitemap is pending the production domain in seo.config.json.\n"));
  const sitemapOrigin = origin || "{{SITE_URL}}";
  const entries = indexable.map((page) => {
    const url = `${sitemapOrigin}/${page.file === "index.html" ? "" : page.file}`;
    return `  <url><loc>${escapeXml(url)}</loc></url>`;
  });
  outputs.set("sitemap.xml", ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...entries, "</urlset>", ""].join("\n"));
  const changed = [];
  for (const [file, content] of outputs) {
    if (await readOptional(file) !== content) changed.push(file);
  }
  if (checking) {
    assert(!changed.length, `SEO 파일을 갱신하세요: ${changed.join(", ")}\n실행: node scripts/seo.mjs`);
  } else {
    for (const file of changed) await writeFile(join(root, file), outputs.get(file), "utf8");
  }
  console.log(`SEO ${checking ? "검사" : "적용"} 완료: ${config.pages.length}개 페이지, 검색 대상 ${indexable.length}개.`);
  if (!origin) console.log("사이트맵 도메인: {{SITE_URL}}");
  else console.log(`사이트맵: ${origin}/sitemap.xml`);
}

main().catch((error) => {
  console.error(`SEO: ${error.message}`);
  process.exitCode = 1;
});
