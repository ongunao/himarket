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

package com.alibaba.himarket.service;

import com.alibaba.himarket.dto.params.sls.GenericSlsQueryRequest;
import com.alibaba.himarket.dto.params.sls.GenericSlsQueryResponse;
import com.alibaba.himarket.dto.params.sls.SlsCommonQueryRequest;

/**
 * 通用日志查询服务接口
 * 支持多种日志后端实现（SLS、Doris等）
 */
public interface LogQueryService {

    /**
     * 执行通用SQL查询
     *
     * @param request 查询请求
     * @return 查询结果
     */
    GenericSlsQueryResponse executeQuery(GenericSlsQueryRequest request);

    /**
     * 执行通用SQL查询
     *
     * @param request 查询请求
     * @return 查询结果
     */
    GenericSlsQueryResponse executeQuery(SlsCommonQueryRequest request);

    /**
     * 检查日志后端是否已配置
     *
     * @return true表示配置有效, false表示配置无效
     */
    boolean isConfigured();

    /**
     * 获取后端类型标识
     *
     * @return 后端类型，如 "sls" 或 "doris"
     */
    String getBackendType();
}
