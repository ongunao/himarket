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

import com.alibaba.himarket.dto.result.model.ModelConfigResult;
import com.alibaba.himarket.dto.result.product.ProductResult;
import com.alibaba.himarket.service.GatewayService;
import com.alibaba.himarket.service.hichat.manager.ChatBotManager;
import com.alibaba.himarket.service.hichat.support.InvokeModelParam;
import com.alibaba.himarket.service.hichat.support.LlmChatRequest;
import com.alibaba.himarket.support.enums.AIProtocol;
import com.alibaba.himarket.support.product.ModelFeature;
import io.agentscope.core.model.GenerateOptions;
import io.agentscope.core.model.Model;
import io.agentscope.extensions.model.dashscope.DashScopeChatModel;
import io.agentscope.extensions.model.dashscope.DashScopeHttpClient;
import java.net.URI;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class DashScopeLlmService extends AbstractLlmService {

    public DashScopeLlmService(GatewayService gatewayService, ChatBotManager chatBotManager) {
        super(gatewayService, chatBotManager);
    }

    @Override
    protected LlmChatRequest composeRequest(InvokeModelParam param) {
        LlmChatRequest request = super.composeRequest(param);
        request.setUri(resolveBaseUri(request));

        return request;
    }

    @Override
    public Model newChatModel(LlmChatRequest request) {
        ModelFeature modelFeature = getOrDefaultModelFeature(request.getProduct());
        GenerateOptions options =
                GenerateOptions.builder().stream(true)
                        .temperature(modelFeature.getTemperature())
                        .maxTokens(modelFeature.getMaxTokens())
                        .additionalHeaders(request.getHeaders())
                        .additionalQueryParams(request.getQueryParams())
                        .additionalBodyParams(request.getBodyParams())
                        .build();

        return DashScopeChatModel.builder()
                .baseUrl(request.getUri().toString())
                .apiKey(request.getApiKey())
                .modelName(modelFeature.getModel())
                .enableThinking(
                        Boolean.TRUE.equals(modelFeature.getEnableThinking())
                                ? request.isEnableThinking()
                                : null)
                .enableSearch(
                        Boolean.TRUE.equals(modelFeature.getWebSearch())
                                ? request.isEnableWebSearch()
                                : null)
                .stream(true)
                .defaultOptions(options)
                .build();
    }

    private URI resolveBaseUri(LlmChatRequest request) {
        ProductResult product = request.getProduct();
        ModelConfigResult modelConfig = product != null ? product.getModelConfig() : null;
        if (modelConfig == null) {
            throw new IllegalStateException("The DashScope model does not provide route config");
        }

        String modelName = getOrDefaultModelFeature(product).getModel();
        String endpoint =
                DashScopeHttpClient.isMultimodalModel(modelName)
                        ? DashScopeHttpClient.MULTIMODAL_GENERATION_ENDPOINT
                        : DashScopeHttpClient.TEXT_GENERATION_ENDPOINT;
        URI uri =
                buildUri(
                        modelConfig,
                        request.getGatewayUris(),
                        endpoint,
                        (pathValue, pathType) -> {
                            if (pathValue == null) {
                                throw new IllegalStateException(
                                        "The DashScope model route path is missing");
                            }
                            String path =
                                    pathValue.endsWith("/")
                                            ? pathValue.substring(0, pathValue.length() - 1)
                                            : pathValue;
                            if (!path.endsWith(endpoint)) {
                                throw new IllegalStateException(
                                        "The DashScope model does not provide the required"
                                                + " endpoint: "
                                                + endpoint);
                            }
                            return path.substring(0, path.length() - endpoint.length());
                        });
        if (uri == null) {
            throw new IllegalStateException("Failed to resolve the DashScope model route");
        }
        return uri;
    }

    @Override
    public List<AIProtocol> getProtocols() {
        return List.of(AIProtocol.DASHSCOPE);
    }

    @Override
    public String getModelCategory() {
        return "TEXT";
    }
}
