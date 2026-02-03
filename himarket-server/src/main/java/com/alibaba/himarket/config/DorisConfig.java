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
 * Doris 日志后端配置
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "doris")
public class DorisConfig {

    /**
     * JDBC 连接URL
     * 例如: jdbc:mysql://127.0.0.1:9030/log_db
     */
    private String jdbcUrl;

    /**
     * 数据库用户名
     */
    private String username;

    /**
     * 数据库密码
     */
    private String password;

    /**
     * 数据库名称
     */
    private String database;

    /**
     * 日志表名
     */
    private String tableName = "gateway_access_log";

    /**
     * 时间字段名
     */
    private String timeField = "log_time";

    /**
     * 查询超时时间（秒）
     */
    private int queryTimeout = 30;

    /**
     * 检查 Doris 配置是否有效
     *
     * @return true表示配置有效, false表示配置无效
     */
    public boolean isConfigured() {
        return jdbcUrl != null && !jdbcUrl.trim().isEmpty();
    }
}
