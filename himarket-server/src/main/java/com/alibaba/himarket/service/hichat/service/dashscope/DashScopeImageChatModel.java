/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
package com.alibaba.himarket.service.hichat.service.dashscope;

import io.agentscope.core.message.Msg;
import io.agentscope.core.model.ChatModelBase;
import io.agentscope.core.model.ChatResponse;
import io.agentscope.core.model.GenerateOptions;
import io.agentscope.core.model.ModelUtils;
import io.agentscope.core.model.ToolChoice;
import io.agentscope.core.model.ToolSchema;
import io.agentscope.core.model.transport.HttpTransport;
import io.agentscope.core.model.transport.HttpTransportFactory;
import io.agentscope.extensions.model.dashscope.DashScopeHttpClient;
import io.agentscope.extensions.model.dashscope.EndpointType;
import io.agentscope.extensions.model.dashscope.dto.DashScopeMessage;
import io.agentscope.extensions.model.dashscope.dto.DashScopeRequest;
import io.agentscope.extensions.model.dashscope.dto.DashScopeResponse;
import java.time.Instant;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Flux;

/**
 * DashScope chat model for image generation.
 *
 * <p>This class adapts DashScope synchronous image generation models. Unlike standard text models,
 * image generation models require:
 * <ul>
 *   <li>Multimodal API endpoint ({@code /multimodal-generation/generation})
 *   <li>Specialized response parsing to extract image URLs from {@code content} field
 * </ul>
 *
 * <p>For text-only models, use {@code
 * io.agentscope.extensions.model.dashscope.DashScopeChatModel} instead.
 *
 * @see DashScopeImageFormatter
 */
@Slf4j
public class DashScopeImageChatModel extends ChatModelBase {

    private final String modelName;
    private final Boolean enableSearch; // nullable
    private final GenerateOptions defaultOptions;
    private final DashScopeImageFormatter formatter;
    private final DashScopeHttpClient httpClient;

    /**
     * Create a new DashScope image generation model.
     *
     * @param apiKey         DashScope API key
     * @param modelName      model name
     * @param enableSearch   whether search enhancement should be enabled
     * @param defaultOptions default generation options
     * @param baseUrl       DashScopeImageChatModel full API URL
     * @param httpTransport  optional HTTP transport
     */
    public DashScopeImageChatModel(
            String apiKey,
            String modelName,
            Boolean enableSearch,
            GenerateOptions defaultOptions,
            String baseUrl,
            HttpTransport httpTransport) {
        this.modelName = modelName;
        this.enableSearch = enableSearch;
        this.defaultOptions =
                defaultOptions != null ? defaultOptions : GenerateOptions.builder().build();

        // Image generation will use DashScopeImageFormatter
        this.formatter = new DashScopeImageFormatter();

        // Use ImageHttpClient with full URL from baseUrl
        HttpTransport transport =
                httpTransport != null ? httpTransport : HttpTransportFactory.getDefault();
        this.httpClient = new DashScopeImageHttpClient(transport, apiKey, baseUrl);
    }

    public static Builder builder() {
        return new Builder();
    }

    @Override
    protected Flux<ChatResponse> doStream(
            List<Msg> messages, List<ToolSchema> tools, GenerateOptions options) {
        Flux<ChatResponse> responseFlux = streamWithHttpClient(messages, tools, options);

        return ModelUtils.applyTimeoutAndRetry(
                responseFlux, options, defaultOptions, modelName, "dashscope");
    }

    private Flux<ChatResponse> streamWithHttpClient(
            List<Msg> messages, List<ToolSchema> tools, GenerateOptions options) {
        Instant start = Instant.now();

        GenerateOptions effectiveOptions = options != null ? options : defaultOptions;
        ToolChoice toolChoice = effectiveOptions.getToolChoice();

        // Use multimodal format for image generation
        List<DashScopeMessage> dashScopeMessages = formatter.formatMultiModal(messages);

        // Build request
        DashScopeRequest request =
                formatter.buildRequest(
                        modelName,
                        dashScopeMessages,
                        false,
                        options,
                        defaultOptions,
                        tools,
                        toolChoice);

        if (Boolean.TRUE.equals(enableSearch)) {
            request.getParameters().setEnableSearch(true);
        }

        return Flux.defer(
                () -> {
                    try {
                        DashScopeResponse response =
                                httpClient.call(
                                        request,
                                        effectiveOptions.getAdditionalHeaders(),
                                        effectiveOptions.getAdditionalBodyParams(),
                                        effectiveOptions.getAdditionalQueryParams());
                        log.debug("Received DashScope HTTP response, response={}", response);
                        ChatResponse chatResponse = formatter.parseResponse(response, start);
                        return Flux.just(chatResponse);
                    } catch (Exception e) {
                        log.error(
                                "DashScope image generation HTTP client error, errorMessage={}",
                                e.getMessage(),
                                e);
                        return Flux.error(
                                new RuntimeException(
                                        "DashScope image generation API call failed: "
                                                + e.getMessage(),
                                        e));
                    }
                });
    }

    @Override
    public String getModelName() {
        return modelName;
    }

    /**
     * Custom HTTP client for image generation models.
     * Returns empty endpoint to use the full URL from baseUrl directly.
     */
    public static class DashScopeImageHttpClient extends DashScopeHttpClient {

        public DashScopeImageHttpClient(HttpTransport transport, String apiKey, String baseUrl) {
            super(transport, apiKey, baseUrl, null, null);
        }

        /**
         * Return empty endpoint to use the full URL from baseUrl directly.
         *
         * @param modelName the model name (ignored)
         * @return empty string to use baseUrl as-is
         */
        @Override
        public String selectEndpoint(String modelName) {
            return "";
        }

        @Override
        public String selectEndpoint(String modelName, EndpointType endpointType) {
            return "";
        }
    }

    public static class Builder {
        private String apiKey;
        private String modelName;
        private Boolean enableSearch;
        private GenerateOptions defaultOptions = null;
        private String baseUrl;
        private HttpTransport httpTransport;

        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        public Builder modelName(String modelName) {
            this.modelName = modelName;
            return this;
        }

        /**
         * Enable or disable search enhancement for image generation.
         *
         * <p>When enabled, the model can leverage internet search to enhance
         * image generation with up-to-date visual references and information.
         *
         * @param enableSearch true to enable search mode, false to disable, null for default (disabled)
         * @return this builder instance
         */
        public Builder enableSearch(Boolean enableSearch) {
            this.enableSearch = enableSearch;
            return this;
        }

        public Builder defaultOptions(GenerateOptions options) {
            this.defaultOptions = options;
            return this;
        }

        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        public Builder httpTransport(HttpTransport httpTransport) {
            this.httpTransport = httpTransport;
            return this;
        }

        /**
         * Build the DashScopeImageChatModel instance.
         *
         * @return configured image generation model
         */
        public DashScopeImageChatModel build() {
            GenerateOptions effectiveOptions =
                    ModelUtils.ensureDefaultExecutionConfig(defaultOptions);

            return new DashScopeImageChatModel(
                    apiKey, modelName, enableSearch, effectiveOptions, baseUrl, httpTransport);
        }
    }
}
