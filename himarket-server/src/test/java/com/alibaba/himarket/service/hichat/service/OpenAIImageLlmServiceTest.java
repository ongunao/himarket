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

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.alibaba.himarket.dto.result.chat.ChatAttachmentResult;
import com.alibaba.himarket.dto.result.chat.LlmInvokeResult;
import com.alibaba.himarket.dto.result.consumer.CredentialContext;
import com.alibaba.himarket.dto.result.httpapi.HttpRouteResult;
import com.alibaba.himarket.dto.result.model.ModelConfigResult;
import com.alibaba.himarket.dto.result.product.ProductResult;
import com.alibaba.himarket.service.ChatAttachmentService;
import com.alibaba.himarket.service.GatewayService;
import com.alibaba.himarket.service.hichat.manager.ChatBotManager;
import com.alibaba.himarket.service.hichat.support.ChatEvent;
import com.alibaba.himarket.service.hichat.support.GeneratedImageDownloader;
import com.alibaba.himarket.service.hichat.support.InvokeModelParam;
import com.alibaba.himarket.service.hichat.support.LlmChatRequest;
import com.alibaba.himarket.support.product.ModelFeature;
import com.alibaba.himarket.support.product.ProductFeature;
import com.sun.net.httpserver.HttpServer;
import io.agentscope.core.message.Base64Source;
import io.agentscope.core.message.ImageBlock;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.message.TextBlock;
import io.agentscope.core.message.URLSource;
import io.agentscope.core.model.ChatResponse;
import io.agentscope.core.model.GenerateOptions;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class OpenAIImageLlmServiceTest {

    private static final String CHAT_ID = "chat-1";
    private static final String USER_ID = "user-1";

    @Test
    void shouldGenerateAndStoreBase64Image() throws InterruptedException {
        ChatAttachmentService attachmentService = mock(ChatAttachmentService.class);
        ChatAttachmentResult attachment = new ChatAttachmentResult();
        attachment.setAttachmentId("attachment-1");
        attachment.setName("generated.webp");
        attachment.setMimeType("image/webp");
        attachment.setSize(5L);
        when(attachmentService.saveGeneratedImage(eq(USER_ID), eq("image/webp"), any(byte[].class)))
                .thenReturn(attachment);

        StubOpenAIImageLlmService service =
                new StubOpenAIImageLlmService(
                        attachmentService,
                        """
                        {
                          "id": "image-1",
                          "data": [{"b64_json": "aW1hZ2U="}],
                          "usage": {"input_tokens": 3, "output_tokens": 4}
                        }
                        """);
        service.request = buildRequest(Map.of("output_format", "webp"));

        AtomicReference<LlmInvokeResult> result = new AtomicReference<>();
        CountDownLatch resultReady = new CountDownLatch(1);
        List<ChatEvent> events =
                service.invokeLlm(
                                InvokeModelParam.builder().chatId(CHAT_ID).build(),
                                value -> {
                                    result.set(value);
                                    resultReady.countDown();
                                })
                        .collectList()
                        .block();

        assertNotNull(events);
        assertEquals(
                List.of(
                        ChatEvent.EventType.START,
                        ChatEvent.EventType.IMAGE,
                        ChatEvent.EventType.DONE),
                events.stream().map(ChatEvent::getType).toList());
        ChatEvent.ImageContent image =
                assertInstanceOf(ChatEvent.ImageContent.class, events.get(1).getContent());
        assertEquals("attachment-1", image.getAttachmentId());
        assertEquals(3, events.get(2).getUsage().getInputTokens());
        assertEquals(4, events.get(2).getUsage().getOutputTokens());
        assertEquals(7, events.get(2).getUsage().getTotalTokens());
        assertEquals("gpt-image-1", service.requestBody.get("model"));
        assertEquals("draw a cat", service.requestBody.get("prompt"));

        assertTrue(resultReady.await(1, TimeUnit.SECONDS));
        assertNotNull(result.get());
        assertTrue(result.get().isSuccess());
        assertEquals("", result.get().getAnswer());
        assertEquals(
                "[{\"type\":\"IMAGE\",\"attachmentId\":\"attachment-1\"}]",
                result.get().getMessageChunks());

        ArgumentCaptor<byte[]> imageData = ArgumentCaptor.forClass(byte[].class);
        verify(attachmentService)
                .saveGeneratedImage(eq(USER_ID), eq("image/webp"), imageData.capture());
        assertArrayEquals("image".getBytes(StandardCharsets.UTF_8), imageData.getValue());
    }

    @Test
    void shouldParseImageUrl() {
        ChatAttachmentService attachmentService = mock(ChatAttachmentService.class);
        OpenAIImageLlmService service =
                new OpenAIImageLlmService(
                        mock(GatewayService.class),
                        mock(ChatBotManager.class),
                        attachmentService,
                        mock(GeneratedImageDownloader.class));

        ChatResponse response =
                service.parseResponse(
                        "{\"data\":[{\"url\":\"https://example.com/image.png\"}]}", "png");

        ImageBlock image = assertInstanceOf(ImageBlock.class, response.getContent().get(0));
        URLSource source = assertInstanceOf(URLSource.class, image.getSource());
        assertEquals("https://example.com/image.png", source.getUrl());
    }

    @Test
    void shouldDownloadAndStoreProviderImageUrl() {
        ChatAttachmentService attachmentService = mock(ChatAttachmentService.class);
        GeneratedImageDownloader downloader = mock(GeneratedImageDownloader.class);
        when(downloader.download("https://example.com/image.png"))
                .thenReturn(
                        new GeneratedImageDownloader.DownloadedImage(
                                "image/png", "image".getBytes(StandardCharsets.UTF_8)));
        ChatAttachmentResult attachment = new ChatAttachmentResult();
        attachment.setAttachmentId("attachment-url");
        attachment.setName("generated.png");
        attachment.setMimeType("image/png");
        attachment.setSize(5L);
        when(attachmentService.saveGeneratedImage(eq(USER_ID), eq("image/png"), any(byte[].class)))
                .thenReturn(attachment);

        StubOpenAIImageLlmService service =
                new StubOpenAIImageLlmService(
                        attachmentService,
                        downloader,
                        "{\"data\":[{\"url\":\"https://example.com/image.png\"}]}");
        service.request = buildRequest(Map.of());

        List<ChatEvent> events =
                service.invokeLlm(InvokeModelParam.builder().chatId(CHAT_ID).build(), ignored -> {})
                        .collectList()
                        .block();

        assertNotNull(events);
        ChatEvent.ImageContent image =
                assertInstanceOf(ChatEvent.ImageContent.class, events.get(1).getContent());
        assertEquals("attachment-url", image.getAttachmentId());
        verify(downloader).download("https://example.com/image.png");
        verify(attachmentService)
                .saveGeneratedImage(eq(USER_ID), eq("image/png"), any(byte[].class));
    }

    @Test
    void shouldMatchOnlyOpenAIImageModels() {
        OpenAIImageLlmService service =
                new OpenAIImageLlmService(
                        mock(GatewayService.class),
                        mock(ChatBotManager.class),
                        mock(ChatAttachmentService.class),
                        mock(GeneratedImageDownloader.class));

        assertTrue(service.match(modelApi("Image", "OpenAI/V1")));
        assertFalse(service.match(modelApi("Text", "OpenAI/V1")));
        assertFalse(service.match(modelApi("Image", "DashScopeImage")));
    }

    @Test
    void shouldResolveOpenAIImageRouteThroughGateway() {
        GatewayService gatewayService = mock(GatewayService.class);
        when(gatewayService.fetchGatewayUris("gateway-1"))
                .thenReturn(List.of(URI.create("https://gateway.example.com")));
        OpenAIImageLlmService service =
                new OpenAIImageLlmService(
                        gatewayService,
                        mock(ChatBotManager.class),
                        mock(ChatAttachmentService.class),
                        mock(GeneratedImageDownloader.class));

        HttpRouteResult route = new HttpRouteResult();
        route.setMatch(
                HttpRouteResult.RouteMatchResult.builder()
                        .path(
                                HttpRouteResult.RouteMatchPath.builder()
                                        .value("/model/api/v1/images/generations")
                                        .type("Exact")
                                        .build())
                        .build());
        ProductResult product = product();
        ModelConfigResult modelConfig = new ModelConfigResult();
        modelConfig.setModelAPIConfig(
                ModelConfigResult.ModelAPIConfig.builder()
                        .modelCategory("Image")
                        .aiProtocols(List.of("OpenAI/V1"))
                        .routes(List.of(route))
                        .build());
        product.setModelConfig(modelConfig);

        LlmChatRequest request =
                service.composeRequest(
                        InvokeModelParam.builder()
                                .chatId(CHAT_ID)
                                .userId(USER_ID)
                                .gatewayId("gateway-1")
                                .product(product)
                                .userMessage(
                                        Msg.builder()
                                                .role(MsgRole.USER)
                                                .textContent("draw a cat")
                                                .build())
                                .credentialContext(CredentialContext.builder().build())
                                .build());

        assertEquals(
                URI.create("https://gateway.example.com/model/api/v1/images/generations"),
                request.getUri());
        assertEquals(1, request.getBodyParams().get("n"));

        HttpRouteResult editRoute = new HttpRouteResult();
        editRoute.setMatch(
                HttpRouteResult.RouteMatchResult.builder()
                        .path(
                                HttpRouteResult.RouteMatchPath.builder()
                                        .value("/model/api/v1/images/edits")
                                        .type("Exact")
                                        .build())
                        .build());
        modelConfig.getModelAPIConfig().setRoutes(List.of(route, editRoute));

        LlmChatRequest editRequest =
                service.composeRequest(
                        InvokeModelParam.builder()
                                .chatId(CHAT_ID)
                                .userId(USER_ID)
                                .gatewayId("gateway-1")
                                .product(product)
                                .userMessage(
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
                                                                        .text("edit the cat")
                                                                        .build()))
                                                .build())
                                .credentialContext(CredentialContext.builder().build())
                                .build());

        assertEquals(
                URI.create("https://gateway.example.com/model/api/v1/images/edits"),
                editRequest.getUri());
    }

    @Test
    void shouldSendMultipartImageEditRequest() throws Exception {
        AtomicReference<String> requestBody = new AtomicReference<>();
        AtomicReference<String> authorization = new AtomicReference<>();
        AtomicReference<String> query = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext(
                "/images/edits",
                exchange -> {
                    requestBody.set(
                            new String(
                                    exchange.getRequestBody().readAllBytes(),
                                    StandardCharsets.ISO_8859_1));
                    authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
                    query.set(exchange.getRequestURI().getQuery());
                    byte[] response =
                            "{\"data\":[{\"b64_json\":\"aW1hZ2U=\"}]}"
                                    .getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, response.length);
                    exchange.getResponseBody().write(response);
                    exchange.close();
                });
        server.start();

        try {
            OpenAIImageLlmService service =
                    new OpenAIImageLlmService(
                            mock(GatewayService.class),
                            mock(ChatBotManager.class),
                            mock(ChatAttachmentService.class),
                            mock(GeneratedImageDownloader.class));
            LlmChatRequest request =
                    LlmChatRequest.builder()
                            .uri(
                                    URI.create(
                                            "http://127.0.0.1:"
                                                    + server.getAddress().getPort()
                                                    + "/images/edits"))
                            .apiKey("test-key")
                            .headers(Map.of())
                            .queryParams(Map.of("api-version", "1"))
                            .build();

            String response =
                    service.callImageEditApi(
                            request,
                            Map.of("model", "gpt-image-1", "prompt", "make it blue"),
                            "image/png",
                            "source".getBytes(StandardCharsets.UTF_8));

            assertTrue(response.contains("b64_json"));
            assertEquals("Bearer test-key", authorization.get());
            assertEquals("api-version=1", query.get());
            assertTrue(requestBody.get().contains("name=\"model\""));
            assertTrue(requestBody.get().contains("gpt-image-1"));
            assertTrue(requestBody.get().contains("name=\"prompt\""));
            assertTrue(requestBody.get().contains("make it blue"));
            assertTrue(requestBody.get().contains("name=\"image[]\""));
            assertTrue(requestBody.get().contains("filename=\"source-image.png\""));
            assertTrue(requestBody.get().contains("source"));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void shouldUseEditRouteAndSourceImage() {
        ChatAttachmentService attachmentService = mock(ChatAttachmentService.class);
        ChatAttachmentResult attachment = new ChatAttachmentResult();
        attachment.setAttachmentId("attachment-2");
        attachment.setName("edited.png");
        attachment.setMimeType("image/png");
        attachment.setSize(5L);
        when(attachmentService.saveGeneratedImage(eq(USER_ID), eq("image/png"), any(byte[].class)))
                .thenReturn(attachment);

        StubOpenAIImageLlmService service =
                new StubOpenAIImageLlmService(
                        attachmentService,
                        """
                        {
                          "data": [{"b64_json": "aW1hZ2U="}]
                        }
                        """);
        service.request = buildRequest(Map.of());
        service.request.setUri(URI.create("https://gateway.example.com/api/v1/images/edits"));
        service.request.setUserMessages(
                Msg.builder()
                        .role(MsgRole.USER)
                        .content(
                                List.of(
                                        ImageBlock.builder()
                                                .source(
                                                        Base64Source.builder()
                                                                .mediaType("image/png")
                                                                .data("c291cmNl")
                                                                .build())
                                                .build(),
                                        TextBlock.builder().text("make it blue").build()))
                        .build());

        service.invokeLlm(InvokeModelParam.builder().chatId(CHAT_ID).build(), ignored -> {})
                .collectList()
                .block();

        assertTrue(service.editCalled);
        assertEquals("image/png", service.sourceMimeType);
        assertArrayEquals("source".getBytes(StandardCharsets.UTF_8), service.sourceImageData);
        assertEquals("make it blue", service.requestBody.get("prompt"));
    }

    private LlmChatRequest buildRequest(Map<String, Object> bodyParams) {
        return LlmChatRequest.builder()
                .chatId(CHAT_ID)
                .userId(USER_ID)
                .product(product())
                .userMessages(Msg.builder().role(MsgRole.USER).textContent("draw a cat").build())
                .uri(URI.create("https://gateway.example.com/api/v1/images/generations"))
                .apiKey("test-key")
                .headers(Map.of())
                .queryParams(Map.of())
                .bodyParams(bodyParams)
                .build();
    }

    private ProductResult product() {
        ProductResult product = new ProductResult();
        product.setFeature(
                ProductFeature.builder()
                        .modelFeature(ModelFeature.builder().model("gpt-image-1").build())
                        .build());
        return product;
    }

    private ModelConfigResult.ModelAPIConfig modelApi(String category, String protocol) {
        return ModelConfigResult.ModelAPIConfig.builder()
                .modelCategory(category)
                .aiProtocols(List.of(protocol))
                .build();
    }

    private static class StubOpenAIImageLlmService extends OpenAIImageLlmService {

        private final String responseBody;
        private LlmChatRequest request;
        private Map<String, Object> requestBody;
        private boolean editCalled;
        private String sourceMimeType;
        private byte[] sourceImageData;

        StubOpenAIImageLlmService(ChatAttachmentService attachmentService, String responseBody) {
            this(attachmentService, mock(GeneratedImageDownloader.class), responseBody);
        }

        StubOpenAIImageLlmService(
                ChatAttachmentService attachmentService,
                GeneratedImageDownloader downloader,
                String responseBody) {
            super(
                    mock(GatewayService.class),
                    mock(ChatBotManager.class),
                    attachmentService,
                    downloader);
            this.responseBody = responseBody;
        }

        @Override
        protected LlmChatRequest composeRequest(InvokeModelParam param) {
            return request;
        }

        @Override
        protected String callImageApi(
                String apiKey,
                String baseUrl,
                String endpoint,
                Map<String, Object> requestBody,
                GenerateOptions options) {
            this.requestBody = requestBody;
            return responseBody;
        }

        @Override
        protected String callImageEditApi(
                LlmChatRequest request,
                Map<String, Object> requestBody,
                String sourceMimeType,
                byte[] sourceData) {
            this.editCalled = true;
            this.requestBody = requestBody;
            this.sourceMimeType = sourceMimeType;
            this.sourceImageData = sourceData;
            return responseBody;
        }
    }
}
