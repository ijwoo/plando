package com.example.llm.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.DefaultResponseErrorHandler;
import org.springframework.web.client.ResponseErrorHandler;

@Configuration
public class OpenAiClientConfig {

    @Bean
    public ResponseErrorHandler responseErrorHandler() {
        // 기본 에러 처리(4xx/5xx면 예외 던짐)
        return new DefaultResponseErrorHandler();
    }
}