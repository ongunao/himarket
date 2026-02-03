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

package com.alibaba.himarket.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 可观测性配置
 * 用于切换日志查询后端
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "observability")
public class ObservabilityConfig {

    /**
     * 日志查询后端类型
     * 可选值: sls, doris
     * 默认: sls
     */
    private String backend = "sls";

    /**
     * 检查是否使用 SLS 后端
     */
    public boolean isSls() {
        return "sls".equalsIgnoreCase(backend);
    }

    /**
     * 检查是否使用 Doris 后端
     */
    public boolean isDoris() {
        return "doris".equalsIgnoreCase(backend);
    }
}
