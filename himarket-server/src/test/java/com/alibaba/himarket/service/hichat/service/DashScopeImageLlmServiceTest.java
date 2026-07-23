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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.alibaba.himarket.dto.result.model.ModelConfigResult;
import com.alibaba.himarket.service.ChatAttachmentService;
import com.alibaba.himarket.service.GatewayService;
import com.alibaba.himarket.service.hichat.manager.ChatBotManager;
import com.alibaba.himarket.service.hichat.service.dashscope.DashScopeImageChatModel;
import com.alibaba.himarket.service.hichat.service.dashscope.DashScopeImageFormatter;
import com.alibaba.himarket.service.hichat.support.GeneratedImageDownloader;
import com.alibaba.himarket.utils.JsonUtil;
import com.fasterxml.jackson.databind.JsonNode;
import io.agentscope.core.message.Base64Source;
import io.agentscope.core.message.ImageBlock;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.message.TextBlock;
import io.agentscope.core.message.URLSource;
import io.agentscope.core.model.ChatResponse;
import io.agentscope.core.model.GenerateOptions;
import io.agentscope.core.model.transport.HttpRequest;
import io.agentscope.core.model.transport.HttpResponse;
import io.agentscope.core.model.transport.HttpTransport;
import io.agentscope.extensions.model.dashscope.dto.DashScopeChoice;
import io.agentscope.extensions.model.dashscope.dto.DashScopeContentPart;
import io.agentscope.extensions.model.dashscope.dto.DashScopeMessage;
import io.agentscope.extensions.model.dashscope.dto.DashScopeOutput;
import io.agentscope.extensions.model.dashscope.dto.DashScopeResponse;
import io.agentscope.extensions.model.dashscope.dto.DashScopeUsage;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

class DashScopeImageLlmServiceTest {

    @Test
    void shouldParseDashScopeTextAndImageContent() {
        DashScopeMessage message = new DashScopeMessage();
        message.setContent(
                List.of(
                        DashScopeContentPart.text("generated"),
                        DashScopeContentPart.image("https://example.com/image.png")));
        DashScopeChoice choice = new DashScopeChoice();
        choice.setMessage(message);
        choice.setFinishReason("stop");
        DashScopeOutput output = new DashScopeOutput();
        output.setChoices(List.of(choice));
        DashScopeUsage usage = new DashScopeUsage();
        usage.setInputTokens(2);
        usage.setOutputTokens(1);
        DashScopeResponse response = new DashScopeResponse();
        response.setRequestId("request-1");
        response.setOutput(output);
        response.setUsage(usage);

        ChatResponse chatResponse =
                new DashScopeImageFormatter().parseResponse(response, Instant.now());

        TextBlock text = assertInstanceOf(TextBlock.class, chatResponse.getContent().get(0));
        ImageBlock image = assertInstanceOf(ImageBlock.class, chatResponse.getContent().get(1));
        URLSource source = assertInstanceOf(URLSource.class, image.getSource());
        assertEquals("generated", text.getText());
        assertEquals("https://example.com/image.png", source.getUrl());
        assertEquals(2, chatResponse.getUsage().getInputTokens());
        assertEquals(1, chatResponse.getUsage().getOutputTokens());
    }

    @Test
    void shouldMatchOnlyDashScopeImageModels() {
        DashScopeImageLlmService service =
                new DashScopeImageLlmService(
                        mock(GatewayService.class),
                        mock(ChatBotManager.class),
                        mock(ChatAttachmentService.class),
                        mock(GeneratedImageDownloader.class));

        assertTrue(service.match(modelApi("Image", "DashScopeImage")));
        assertFalse(service.match(modelApi("Text", "DashScopeImage")));
        assertFalse(service.match(modelApi("Image", "DashScope")));
    }

    @Test
    void shouldSendDashScopeParametersToConfiguredRoute() {
        CapturingHttpTransport transport = new CapturingHttpTransport();
        DashScopeImageChatModel model =
                DashScopeImageChatModel.builder()
                        .apiKey("test-key")
                        .modelName("qwen-image-2.0")
                        .baseUrl(
                                "https://gateway.example.com/api/v1/services/aigc/"
                                        + "multimodal-generation/generation")
                        .defaultOptions(
                                GenerateOptions.builder().stream(false)
                                        .additionalBodyParams(
                                                Map.of(
                                                        "n", 1,
                                                        "prompt_extend", true,
                                                        "watermark", false))
                                        .build())
                        .httpTransport(transport)
                        .build();

        ChatResponse response =
                model.stream(
                                List.of(
                                        Msg.builder()
                                                .role(MsgRole.USER)
                                                .content(
                                                        List.of(
                                                                ImageBlock.builder()
                                                                        .source(
                                                                                Base64Source
                                                                                        .builder()
                                                                                        .mediaType(
                                                                                                "image/png")
                                                                                        .data(
                                                                                                "c291cmNl")
                                                                                        .build())
                                                                        .build(),
                                                                TextBlock.builder()
                                                                        .text("make it blue")
                                                                        .build()))
                                                .build()),
                                null,
                                null)
                        .blockFirst();

        assertEquals(
                "https://gateway.example.com/api/v1/services/aigc/"
                        + "multimodal-generation/generation",
                transport.request.getUrl());
        assertEquals("Bearer test-key", transport.request.getHeaders().get("Authorization"));
        JsonNode body = JsonUtil.readTree(transport.request.getBody());
        assertEquals("qwen-image-2.0", body.path("model").asText());
        assertEquals(1, body.path("parameters").path("n").asInt());
        assertTrue(body.path("parameters").path("prompt_extend").asBoolean());
        assertFalse(body.path("parameters").path("watermark").asBoolean());
        assertFalse(body.path("parameters").has("parameters"));
        assertEquals(
                "data:image/png;base64,c291cmNl",
                body.path("input")
                        .path("messages")
                        .get(0)
                        .path("content")
                        .get(0)
                        .path("image")
                        .asText());
        assertEquals(
                "make it blue",
                body.path("input")
                        .path("messages")
                        .get(0)
                        .path("content")
                        .get(1)
                        .path("text")
                        .asText());
        assertInstanceOf(ImageBlock.class, response.getContent().get(0));
    }

    private ModelConfigResult.ModelAPIConfig modelApi(String category, String protocol) {
        return ModelConfigResult.ModelAPIConfig.builder()
                .modelCategory(category)
                .aiProtocols(List.of(protocol))
                .build();
    }

    private static class CapturingHttpTransport implements HttpTransport {

        private HttpRequest request;

        @Override
        public HttpResponse execute(HttpRequest request) {
            this.request = request;
            return HttpResponse.builder()
                    .statusCode(200)
                    .body(
                            """
                            {
                              "request_id": "request-1",
                              "output": {
                                "choices": [{
                                  "message": {
                                    "role": "assistant",
                                    "content": [{"image": "https://example.com/image.png"}]
                                  },
                                  "finish_reason": "stop"
                                }]
                              }
                            }
                            """)
                    .build();
        }

        @Override
        public Flux<String> stream(HttpRequest request) {
            return Flux.empty();
        }

        @Override
        public void close() {}
    }
}
