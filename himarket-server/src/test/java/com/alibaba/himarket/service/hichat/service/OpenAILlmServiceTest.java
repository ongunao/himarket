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
import static org.junit.jupiter.api.Assertions.assertNull;
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
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;

class OpenAILlmServiceTest {

    @Test
    void shouldDisableThinkingForSupportedModel() {
        LlmChatRequest request = composeRequest(true, false);

        assertFalse(request.isEnableThinking());
        assertEquals(false, request.getBodyParams().get("enable_thinking"));
    }

    @Test
    void shouldNotSendThinkingParameterForUnsupportedModel() {
        LlmChatRequest request = composeRequest(false, false);

        assertNull(request.getBodyParams());
    }

    private LlmChatRequest composeRequest(boolean supportsThinking, boolean enableThinking) {
        GatewayService gatewayService = mock(GatewayService.class);
        when(gatewayService.fetchGatewayUris("gateway-1"))
                .thenReturn(List.of(URI.create("https://gateway.example.com")));

        OpenAILlmService service = new OpenAILlmService(gatewayService, mock(ChatBotManager.class));

        HttpRouteResult route = new HttpRouteResult();
        route.setMatch(
                HttpRouteResult.RouteMatchResult.builder()
                        .path(
                                HttpRouteResult.RouteMatchPath.builder()
                                        .value("/model/v1/chat/completions")
                                        .type("Exact")
                                        .build())
                        .build());

        ProductResult product = new ProductResult();
        product.setFeature(
                ProductFeature.builder()
                        .modelFeature(
                                ModelFeature.builder()
                                        .model("qwen3.7-max")
                                        .enableThinking(supportsThinking)
                                        .build())
                        .build());
        ModelConfigResult modelConfig = new ModelConfigResult();
        modelConfig.setModelAPIConfig(
                ModelConfigResult.ModelAPIConfig.builder()
                        .modelCategory("Text")
                        .aiProtocols(List.of("OpenAI/V1"))
                        .routes(List.of(route))
                        .build());
        product.setModelConfig(modelConfig);

        return service.composeRequest(
                InvokeModelParam.builder()
                        .chatId("chat-1")
                        .sessionId("session-1")
                        .userId("user-1")
                        .gatewayId("gateway-1")
                        .product(product)
                        .enableThinking(enableThinking)
                        .credentialContext(CredentialContext.builder().build())
                        .build());
    }
}
