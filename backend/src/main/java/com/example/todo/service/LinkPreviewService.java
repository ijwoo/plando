package com.example.todo.service;

import com.example.todo.dto.LinkPreviewResponse;
import com.example.todo.exception.ApiException;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 링크 미리보기(unfurl) — URL의 OpenGraph/메타 태그를 읽어 제목/설명/이미지 추출.
 * - JDK HttpClient 사용(외부 의존성 없음), HTML만 파싱
 * - 메모리 캐시(간단한 상한), SSRF 방지(사설/루프백 IP 차단)
 */
@Service
public class LinkPreviewService {

    private static final int MAX_BYTES = 512 * 1024;   // 512KB까지만 읽음
    private static final int MAX_CACHE = 500;
    private static final int MAX_REDIRECTS = 5;

    /*
     * 리다이렉트를 HttpClient 에 맡기지 않는다(Redirect.NEVER).
     * 예전엔 NORMAL 이라 **처음 호스트만 검사하고 그 뒤는 무조건 따라갔다.** 공격자가 자기
     * 도메인에서 302 → http://169.254.169.254/... 로 넘기면 사설망 주소를 그대로 가져왔다.
     * (text/html 만 파싱하므로 내부 HTML 페이지에 한정된 blind SSRF 였지만 구멍은 구멍이다.)
     * 이제 hop 마다 직접 검사한다.
     */
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    private final Map<String, LinkPreviewResponse> cache = new ConcurrentHashMap<>();

    public LinkPreviewResponse fetch(String url) {
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            throw new ApiException(400, "유효하지 않은 링크입니다.");
        }
        LinkPreviewResponse cached = cache.get(url);
        if (cached != null) return cached;

        LinkPreviewResponse result;
        try {
            HttpResponse<InputStream> resp = fetchFollowingRedirects(URI.create(url));
            if (resp == null) {
                result = empty(url);
            } else {
                String ctype = resp.headers().firstValue("content-type").orElse("").toLowerCase();
                if (!ctype.isEmpty() && !ctype.contains("text/html") && !ctype.contains("xhtml")) {
                    // HTML이 아니면 미리보기 없음(빈 결과 캐시)
                    resp.body().close();
                    result = empty(url);
                } else {
                    String html = readLimited(resp.body());
                    result = parse(url, html);
                }
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            result = empty(url);
        }

        if (cache.size() >= MAX_CACHE) cache.clear();
        cache.put(url, result);
        return result;
    }

    /** 리다이렉트를 직접 따라가며 **매 hop 마다** 목적지를 검사한다. 최종 응답(또는 null)을 돌려준다. */
    private HttpResponse<InputStream> fetchFollowingRedirects(URI start) throws Exception {
        URI current = start;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            requireSafeTarget(current);

            HttpRequest req = HttpRequest.newBuilder(current)
                    .timeout(Duration.ofSeconds(5))
                    .header("User-Agent", "Mozilla/5.0 (compatible; PlandoBot/1.0; +https://plando.app)")
                    .header("Accept", "text/html,application/xhtml+xml")
                    .GET()
                    .build();

            HttpResponse<InputStream> resp = http.send(req, HttpResponse.BodyHandlers.ofInputStream());
            int status = resp.statusCode();
            if (status < 300 || status >= 400) return resp;

            String location = resp.headers().firstValue("location").orElse(null);
            resp.body().close(); // 본문은 버리고 연결 반환
            if (location == null || location.isBlank()) return null;

            URI next = current.resolve(location.trim());
            String scheme = next.getScheme() == null ? "" : next.getScheme().toLowerCase();
            if (!scheme.equals("http") && !scheme.equals("https")) {
                // file:, gopher: 등으로 튀는 리다이렉트는 따라가지 않는다
                throw new ApiException(400, "허용되지 않는 링크입니다.");
            }
            current = next;
        }
        return null; // 리다이렉트 루프
    }

    /** SSRF 방지 — 내부망/루프백/링크로컬 차단. 호스트가 여러 주소로 풀리면 하나라도 걸리면 거부. */
    private void requireSafeTarget(URI uri) throws Exception {
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new ApiException(400, "유효하지 않은 링크입니다.");
        }
        for (InetAddress addr : InetAddress.getAllByName(host)) {
            if (addr.isLoopbackAddress() || addr.isAnyLocalAddress()
                    || addr.isSiteLocalAddress() || addr.isLinkLocalAddress()
                    || addr.isMulticastAddress()) {
                throw new ApiException(400, "허용되지 않는 링크입니다.");
            }
        }
    }

    private LinkPreviewResponse empty(String url) {
        return LinkPreviewResponse.builder().url(url).build();
    }

    private String readLimited(InputStream in) throws Exception {
        try (in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int total = 0, n;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
                total += n;
                if (total >= MAX_BYTES) break;
            }
            return out.toString(StandardCharsets.UTF_8);
        }
    }

    private LinkPreviewResponse parse(String url, String html) {
        String title = firstNonBlank(meta(html, "og:title"), meta(html, "twitter:title"), titleTag(html));
        String desc = firstNonBlank(meta(html, "og:description"), meta(html, "twitter:description"), meta(html, "description"));
        String image = firstNonBlank(meta(html, "og:image"), meta(html, "twitter:image"));
        String site = firstNonBlank(meta(html, "og:site_name"));

        if (image != null && !image.isBlank()) {
            try { image = URI.create(url).resolve(image.trim()).toString(); } catch (Exception ignore) {}
        }
        if (site == null) {
            try { site = URI.create(url).getHost(); } catch (Exception ignore) {}
        }
        return LinkPreviewResponse.builder()
                .url(url)
                .title(trimTo(title, 200))
                .description(trimTo(desc, 300))
                .image(image)
                .siteName(site)
                .build();
    }

    private String meta(String html, String prop) {
        String q = Pattern.quote(prop);
        Matcher m = Pattern.compile(
                "<meta[^>]*(?:property|name)\\s*=\\s*[\"']" + q + "[\"'][^>]*content\\s*=\\s*[\"']([^\"']*)[\"']",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL).matcher(html);
        if (m.find()) return unescape(m.group(1));
        Matcher m2 = Pattern.compile(
                "<meta[^>]*content\\s*=\\s*[\"']([^\"']*)[\"'][^>]*(?:property|name)\\s*=\\s*[\"']" + q + "[\"']",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL).matcher(html);
        if (m2.find()) return unescape(m2.group(1));
        return null;
    }

    private String titleTag(String html) {
        Matcher m = Pattern.compile("<title[^>]*>(.*?)</title>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL).matcher(html);
        return m.find() ? unescape(m.group(1)).trim() : null;
    }

    private String firstNonBlank(String... vals) {
        for (String v : vals) if (v != null && !v.isBlank()) return v.trim();
        return null;
    }

    private String trimTo(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) + "…" : t;
    }

    private String unescape(String s) {
        if (s == null) return null;
        return s.replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'")
                .replace("&apos;", "'").replace("&lt;", "<").replace("&gt;", ">").replace("&nbsp;", " ");
    }
}
