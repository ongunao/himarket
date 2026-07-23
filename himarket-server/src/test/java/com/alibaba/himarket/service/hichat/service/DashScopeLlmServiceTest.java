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
package com.alibaba.himarket.service.hichat.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.alibaba.himarket.dto.result.consumer.CredentialContext;
import com.alibaba.himarket.dto.result.httpapi.HttpRouteResult;
import com.alibaba.himarket.dto.result.model.ModelConfigResult;
import com.alibaba.himarket.dto.result.product.ProductResult;
import com.alibaba.himarket.service.GatewayService;
import com.alibaba.himarket.service.hichat.manager.ChatBotManager;
import com.alibaba.himarket.service.hichat.support.InvokeModelParam;
import com.alibaba.himarket.service.hichat.support.LlmChatRequest;
import com.alibaba.himarket.support.product.ModelFeature;
import com.alibaba.himarket.support.product.ProductFeature;
import io.agentscope.extensions.model.dashscope.DashScopeChatModel;
import io.agentscope.extensions.model.dashscope.DashScopeHttpClient;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class DashScopeLlmServiceTest {

    @Test
    void shouldBuildTextModelFromGatewayRouteAndRequestOptions() {
        DashScopeLlmService service = service();
        ProductResult product =
                product(
                        "qwen3.7-max",
                        true,
                        true,
                        "/model-prefix" + DashScopeHttpClient.TEXT_GENERATION_ENDPOINT);

        LlmChatRequest request = service.composeRequest(param(product, false, true));

        assertEquals(URI.create("https://gateway.example.com/model-prefix"), request.getUri());
        assertEquals("gateway-key", request.getApiKey());
        assertEquals("credential", request.getHeaders().get("x-gateway-credential"));
        assertFalse(request.isEnableThinking());
        assertTrue(request.isEnableWebSearch());

        DashScopeChatModel model =
                assertInstanceOf(DashScopeChatModel.class, service.newChatModel(request));
        assertEquals(false, ReflectionTestUtils.getField(model, "enableThinking"));
        assertEquals(true, ReflectionTestUtils.getField(model, "enableSearch"));
        Object httpClient = ReflectionTestUtils.getField(model, "httpClient");
        assertEquals(
                "https://gateway.example.com/model-prefix",
                ReflectionTestUtils.getField(httpClient, "baseUrl"));
        assertEquals("gateway-key", ReflectionTestUtils.getField(httpClient, "apiKey"));
    }

    @Test
    void shouldUseMultimodalRouteAndOmitUnsupportedOptions() {
        DashScopeLlmService service = service();
        ProductResult product =
                product(
                        "qwen3.7-plus",
                        false,
                        false,
                        "/model-prefix" + DashScopeHttpClient.MULTIMODAL_GENERATION_ENDPOINT);

        LlmChatRequest request = service.composeRequest(param(product, true, true));
        DashScopeChatModel model =
                assertInstanceOf(DashScopeChatModel.class, service.newChatModel(request));

        assertEquals(URI.create("https://gateway.example.com/model-prefix"), request.getUri());
        assertNull(ReflectionTestUtils.getField(model, "enableThinking"));
        assertNull(ReflectionTestUtils.getField(model, "enableSearch"));
    }

    @Test
    void shouldRejectRouteThatDoesNotMatchModelEndpoint() {
        DashScopeLlmService service = service();
        ProductResult product =
                product(
                        "qwen3.7-plus",
                        false,
                        false,
                        "/model-prefix" + DashScopeHttpClient.TEXT_GENERATION_ENDPOINT);

        IllegalStateException error =
                assertThrows(
                        IllegalStateException.class,
                        () -> service.composeRequest(param(product, false, false)));

        assertTrue(error.getMessage().contains("required endpoint"));
    }

    private DashScopeLlmService service() {
        GatewayService gatewayService = mock(GatewayService.class);
        when(gatewayService.fetchGatewayUris("gateway-1"))
                .thenReturn(List.of(URI.create("https://gateway.example.com")));
        return new DashScopeLlmService(gatewayService, mock(ChatBotManager.class));
    }

    private InvokeModelParam param(
            ProductResult product, boolean enableThinking, boolean enableWebSearch) {
        return InvokeModelParam.builder()
                .chatId("chat-1")
                .sessionId("session-1")
                .userId("user-1")
                .gatewayId("gateway-1")
                .product(product)
                .enableThinking(enableThinking)
                .enableWebSearch(enableWebSearch)
                .credentialContext(
                        CredentialContext.builder()
                                .apiKey("gateway-key")
                                .headers(Map.of("x-gateway-credential", "credential"))
                                .build())
                .build();
    }

    private ProductResult product(
            String modelName,
            boolean supportsThinking,
            boolean supportsWebSearch,
            String routePath) {
        HttpRouteResult route = new HttpRouteResult();
        route.setMatch(
                HttpRouteResult.RouteMatchResult.builder()
                        .path(
                                HttpRouteResult.RouteMatchPath.builder()
                                        .value(routePath)
                                        .type("Exact")
                                        .build())
                        .build());

        ModelConfigResult modelConfig = new ModelConfigResult();
        modelConfig.setModelAPIConfig(
                ModelConfigResult.ModelAPIConfig.builder()
                        .modelCategory("Text")
                        .aiProtocols(List.of("DashScope"))
                        .routes(List.of(route))
                        .build());

        ProductResult product = new ProductResult();
        product.setModelConfig(modelConfig);
        product.setFeature(
                ProductFeature.builder()
                        .modelFeature(
                                ModelFeature.builder()
                                        .model(modelName)
                                        .enableThinking(supportsThinking)
                                        .webSearch(supportsWebSearch)
                                        .build())
                        .build());
        return product;
    }
}
