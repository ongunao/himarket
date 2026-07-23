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

import com.alibaba.himarket.service.ChatAttachmentService;
import com.alibaba.himarket.service.GatewayService;
import com.alibaba.himarket.service.hichat.manager.ChatBotManager;
import com.alibaba.himarket.service.hichat.support.GeneratedImageDownloader;
import com.alibaba.himarket.service.hichat.support.InvokeModelParam;
import com.alibaba.himarket.service.hichat.support.LlmChatRequest;
import com.alibaba.himarket.support.common.Strings;
import com.alibaba.himarket.support.enums.AIProtocol;
import com.alibaba.himarket.support.product.ModelFeature;
import com.alibaba.himarket.utils.JsonUtil;
import com.fasterxml.jackson.databind.JsonNode;
import io.agentscope.core.message.Base64Source;
import io.agentscope.core.message.ContentBlock;
import io.agentscope.core.message.ImageBlock;
import io.agentscope.core.message.URLSource;
import io.agentscope.core.model.ChatResponse;
import io.agentscope.core.model.ChatUsage;
import io.agentscope.core.model.GenerateOptions;
import io.agentscope.extensions.model.openai.OpenAIClient;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Service
public class OpenAIImageLlmService extends AbstractImageLlmService {

    private static final String IMAGE_GENERATION_PATH = "/images/generations";
    private static final String IMAGE_EDIT_PATH = "/images/edits";

    private final OpenAIClient openAIClient = new OpenAIClient();
    private final OkHttpClient httpClient =
            new OkHttpClient.Builder()
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(60, TimeUnit.SECONDS)
                    .readTimeout(5, TimeUnit.MINUTES)
                    .callTimeout(5, TimeUnit.MINUTES)
                    .build();

    public OpenAIImageLlmService(
            GatewayService gatewayService,
            ChatBotManager chatBotManager,
            ChatAttachmentService chatAttachmentService,
            GeneratedImageDownloader imageDownloader) {
        super(gatewayService, chatBotManager, chatAttachmentService, imageDownloader);
    }

    @Override
    protected LlmChatRequest composeRequest(InvokeModelParam param) {
        LlmChatRequest request = super.composeRequest(param);
        request.setUri(
                resolveImageRoute(
                        request,
                        request.getUserMessages().getFirstContentBlock(ImageBlock.class) != null
                                ? IMAGE_EDIT_PATH
                                : IMAGE_GENERATION_PATH));

        Map<String, Object> bodyParams =
                request.getBodyParams() != null
                        ? new HashMap<>(request.getBodyParams())
                        : new HashMap<>();
        bodyParams.putIfAbsent("n", 1);
        request.setBodyParams(bodyParams);
        return request;
    }

    @Override
    protected Mono<ChatResponse> generateImage(LlmChatRequest request) {
        ModelFeature modelFeature = getOrDefaultModelFeature(request.getProduct());
        Map<String, Object> requestBody =
                request.getBodyParams() != null
                        ? new LinkedHashMap<>(request.getBodyParams())
                        : new LinkedHashMap<>();
        requestBody.put("model", modelFeature.getModel());
        requestBody.put("prompt", request.getUserMessages().getTextContent());

        GenerateOptions options =
                GenerateOptions.builder().stream(false)
                        .additionalHeaders(request.getHeaders())
                        .additionalQueryParams(request.getQueryParams())
                        .build();
        URI uri = request.getUri();
        String baseUrl = uri.getScheme() + "://" + uri.getRawAuthority();

        return Mono.fromCallable(
                        () -> {
                            if (request.getUserMessages().getFirstContentBlock(ImageBlock.class)
                                    != null) {
                                ImageSource source = getSourceImage(request);
                                return callImageEditApi(
                                        request, requestBody, source.mimeType(), source.data());
                            }
                            return callImageApi(
                                    request.getApiKey(),
                                    baseUrl,
                                    uri.getRawPath(),
                                    requestBody,
                                    options);
                        })
                .map(
                        response ->
                                parseResponse(
                                        response,
                                        String.valueOf(
                                                requestBody.getOrDefault("output_format", "png"))))
                .subscribeOn(Schedulers.boundedElastic());
    }

    protected String callImageApi(
            String apiKey,
            String baseUrl,
            String endpoint,
            Map<String, Object> requestBody,
            GenerateOptions options) {
        return openAIClient.callApi(apiKey, baseUrl, endpoint, requestBody, options);
    }

    protected String callImageEditApi(
            LlmChatRequest request,
            Map<String, Object> requestBody,
            String sourceMimeType,
            byte[] sourceData) {
        HttpUrl.Builder url = HttpUrl.get(request.getUri()).newBuilder();
        if (request.getQueryParams() != null) {
            request.getQueryParams().forEach(url::addQueryParameter);
        }

        MultipartBody.Builder body = new MultipartBody.Builder().setType(MultipartBody.FORM);
        requestBody.forEach(
                (name, value) -> {
                    if (value != null) {
                        body.addFormDataPart(name, formatFormValue(value));
                    }
                });
        body.addFormDataPart(
                "image[]",
                "source-image." + getExtension(sourceMimeType),
                RequestBody.create(sourceData, MediaType.get(sourceMimeType)));

        Request.Builder requestBuilder = new Request.Builder().url(url.build()).post(body.build());
        if (request.getHeaders() != null) {
            request.getHeaders()
                    .forEach(
                            (name, value) -> {
                                if (!"content-type".equalsIgnoreCase(name)
                                        && !"content-length".equalsIgnoreCase(name)) {
                                    requestBuilder.header(name, value);
                                }
                            });
        }
        boolean hasAuthorization =
                request.getHeaders() != null
                        && request.getHeaders().keySet().stream()
                                .anyMatch("authorization"::equalsIgnoreCase);
        if (!hasAuthorization && Strings.isNotBlank(request.getApiKey())) {
            requestBuilder.header("Authorization", "Bearer " + request.getApiKey());
        }

        try (Response response = httpClient.newCall(requestBuilder.build()).execute()) {
            ResponseBody responseBody = response.body();
            if (responseBody == null) {
                throw new IllegalStateException("OpenAI image editing returned an empty response");
            }
            if (!response.isSuccessful()) {
                throw new IllegalStateException(
                        "OpenAI image editing failed, status=" + response.code());
            }
            return responseBody.string();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to invoke OpenAI image editing", e);
        }
    }

    ChatResponse parseResponse(String responseBody, String outputFormat) {
        JsonNode response = JsonUtil.readTree(responseBody);
        if (response == null) {
            throw new IllegalStateException("OpenAI image generation returned an empty response");
        }
        JsonNode imageData = response.get("data");
        if (imageData == null || !imageData.isArray() || imageData.isEmpty()) {
            throw new IllegalStateException("OpenAI image generation returned no image data");
        }

        String mediaType = getMediaType(outputFormat);
        List<ContentBlock> content = new ArrayList<>();
        for (JsonNode image : imageData) {
            String imageUrl = image.path("url").asText();
            String base64Data = image.path("b64_json").asText();
            if (Strings.isNotBlank(imageUrl)) {
                content.add(
                        ImageBlock.builder()
                                .source(URLSource.builder().url(imageUrl).build())
                                .build());
            } else if (Strings.isNotBlank(base64Data)) {
                content.add(
                        ImageBlock.builder()
                                .source(
                                        Base64Source.builder()
                                                .mediaType(mediaType)
                                                .data(base64Data)
                                                .build())
                                .build());
            }
        }
        if (content.isEmpty()) {
            throw new IllegalStateException(
                    "OpenAI image generation returned no supported image content");
        }

        return ChatResponse.builder()
                .id(response.path("id").asText(null))
                .content(content)
                .usage(parseUsage(response.get("usage")))
                .build();
    }

    private ChatUsage parseUsage(JsonNode usage) {
        if (usage == null || usage.isNull()) {
            return null;
        }
        int inputTokens =
                usage.has("input_tokens")
                        ? usage.path("input_tokens").asInt()
                        : usage.path("prompt_tokens").asInt();
        int outputTokens =
                usage.has("output_tokens")
                        ? usage.path("output_tokens").asInt()
                        : usage.path("completion_tokens").asInt();
        return ChatUsage.builder().inputTokens(inputTokens).outputTokens(outputTokens).build();
    }

    private String getMediaType(String outputFormat) {
        return switch (outputFormat.toLowerCase(Locale.ROOT)) {
            case "jpeg", "jpg" -> "image/jpeg";
            case "webp" -> "image/webp";
            default -> "image/png";
        };
    }

    private ImageSource getSourceImage(LlmChatRequest request) {
        ImageBlock imageBlock = request.getUserMessages().getFirstContentBlock(ImageBlock.class);
        if (imageBlock == null || !(imageBlock.getSource() instanceof Base64Source source)) {
            throw new IllegalStateException("Image editing requires a source image attachment");
        }
        try {
            return new ImageSource(
                    source.getMediaType(), Base64.getDecoder().decode(source.getData()));
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Source image attachment contains invalid data", e);
        }
    }

    private String formatFormValue(Object value) {
        return value instanceof String || value instanceof Number || value instanceof Boolean
                ? String.valueOf(value)
                : JsonUtil.toJson(value);
    }

    private String getExtension(String mimeType) {
        return switch (mimeType) {
            case "image/jpeg" -> "jpg";
            case "image/webp" -> "webp";
            default -> "png";
        };
    }

    private record ImageSource(String mimeType, byte[] data) {}

    @Override
    public List<AIProtocol> getProtocols() {
        return List.of(AIProtocol.OPENAI);
    }
}
