package com.example.todo.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class KakaoGeocodingService {

    @Value("${kakao.maps.api-key:}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    public GeoResult geocode(String query) {
        if (query == null || query.isBlank() || apiKey.isBlank()) return null;

        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl("https://dapi.kakao.com/v2/local/search/keyword.json")
                    .queryParam("query", query)
                    .queryParam("size", 1)
                    .build()
                    .toUriString();

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "KakaoAK " + apiKey);

            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);

            if (response.getBody() == null) return null;

            List<Map<String, Object>> documents = (List<Map<String, Object>>) response.getBody().get("documents");
            if (documents == null || documents.isEmpty()) return null;

            Map<String, Object> doc = documents.get(0);
            double lng = Double.parseDouble(String.valueOf(doc.get("x")));
            double lat = Double.parseDouble(String.valueOf(doc.get("y")));
            String address = doc.get("address_name") != null
                    ? String.valueOf(doc.get("address_name"))
                    : String.valueOf(doc.get("road_address_name"));
            String placeName = doc.get("place_name") != null
                    ? String.valueOf(doc.get("place_name"))
                    : query;

            return new GeoResult(lat, lng, address, placeName);
        } catch (Exception e) {
            log.warn("[Geocoding] 변환 실패: query={}, error={}", query, e.getMessage());
            return null;
        }
    }

    public record GeoResult(double lat, double lng, String address, String placeName) {}
}
