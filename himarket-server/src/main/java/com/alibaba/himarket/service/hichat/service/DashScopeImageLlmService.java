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
import com.alibaba.himarket.service.hichat.service.dashscope.DashScopeImageChatModel;
import com.alibaba.himarket.service.hichat.support.GeneratedImageDownloader;
import com.alibaba.himarket.service.hichat.support.InvokeModelParam;
import com.alibaba.himarket.service.hichat.support.LlmChatRequest;
import com.alibaba.himarket.support.enums.AIProtocol;
import com.alibaba.himarket.support.product.ModelFeature;
import io.agentscope.core.model.GenerateOptions;
import io.agentscope.core.model.Model;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class DashScopeImageLlmService extends AbstractImageLlmService {

    private static final String IMAGE_GENERATION_PATH =
            "/services/aigc/multimodal-generation/generation";

    public DashScopeImageLlmService(
            GatewayService gatewayService,
            ChatBotManager chatBotManager,
            ChatAttachmentService chatAttachmentService,
            GeneratedImageDownloader imageDownloader) {
        super(gatewayService, chatBotManager, chatAttachmentService, imageDownloader);
    }

    @Override
    protected LlmChatRequest composeRequest(InvokeModelParam param) {
        LlmChatRequest request = super.composeRequest(param);
        request.setUri(resolveImageRoute(request, IMAGE_GENERATION_PATH));

        Map<String, Object> bodyParams =
                request.getBodyParams() != null
                        ? new HashMap<>(request.getBodyParams())
                        : new HashMap<>();
        bodyParams.putIfAbsent("n", 1);
        bodyParams.putIfAbsent("prompt_extend", true);
        bodyParams.putIfAbsent("watermark", false);
        request.setBodyParams(bodyParams);
        return request;
    }

    @Override
    public Model newChatModel(LlmChatRequest request) {
        GenerateOptions options =
                GenerateOptions.builder()
                        .additionalHeaders(request.getHeaders())
                        .additionalQueryParams(request.getQueryParams())
                        .additionalBodyParams(request.getBodyParams())
                        .stream(false)
                        .build();

        ModelFeature modelFeature = getOrDefaultModelFeature(request.getProduct());
        log.info("Creating DashScope image model, modelName={}", modelFeature.getModel());

        return DashScopeImageChatModel.builder()
                .apiKey(request.getApiKey())
                .modelName(modelFeature.getModel())
                .enableSearch(modelFeature.getWebSearch())
                .defaultOptions(options)
                .baseUrl(request.getUri().toString())
                .build();
    }

    @Override
    public List<AIProtocol> getProtocols() {
        return List.of(AIProtocol.DASHSCOPE_IMAGE);
    }
}
