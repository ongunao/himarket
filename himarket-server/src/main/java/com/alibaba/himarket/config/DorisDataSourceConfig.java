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

import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Doris 数据源配置
 * 仅当 observability.backend=doris 时激活
 */
@Configuration
@Slf4j
@RequiredArgsConstructor
@ConditionalOnProperty(name = "observability.backend", havingValue = "doris")
public class DorisDataSourceConfig {

    private final DorisConfig dorisConfig;

    @Bean(name = "dorisDataSource")
    public DataSource dorisDataSource() {
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(dorisConfig.getJdbcUrl());
        dataSource.setUsername(dorisConfig.getUsername());
        dataSource.setPassword(dorisConfig.getPassword());
        dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");

        // 连接池配置
        dataSource.setMaximumPoolSize(10);
        dataSource.setMinimumIdle(2);
        dataSource.setConnectionTimeout(30000);
        dataSource.setIdleTimeout(600000);
        dataSource.setMaxLifetime(1800000);

        log.info("Doris DataSource initialized with URL: {}", dorisConfig.getJdbcUrl());
        return dataSource;
    }

    @Bean(name = "dorisJdbcTemplate")
    public JdbcTemplate dorisJdbcTemplate() {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dorisDataSource());
        jdbcTemplate.setQueryTimeout(dorisConfig.getQueryTimeout());
        return jdbcTemplate;
    }
}
