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

package com.alibaba.himarket.service.impl;

import com.alibaba.himarket.config.DorisConfig;
import com.alibaba.himarket.core.exception.BusinessException;
import com.alibaba.himarket.core.exception.ErrorCode;
import com.alibaba.himarket.dto.params.sls.GenericSlsQueryRequest;
import com.alibaba.himarket.dto.params.sls.GenericSlsQueryResponse;
import com.alibaba.himarket.dto.params.sls.SlsCommonQueryRequest;
import com.alibaba.himarket.service.LogQueryService;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Doris 日志查询服务实现
 */
@Service
@Slf4j
@ConditionalOnProperty(name = "observability.backend", havingValue = "doris")
public class DorisLogServiceImpl implements LogQueryService {

    private final JdbcTemplate dorisJdbcTemplate;

    private final DorisConfig dorisConfig;

    public DorisLogServiceImpl(
            @Qualifier("dorisJdbcTemplate") JdbcTemplate dorisJdbcTemplate,
            DorisConfig dorisConfig) {
        this.dorisJdbcTemplate = dorisJdbcTemplate;
        this.dorisConfig = dorisConfig;
    }

    private static final DateTimeFormatter DATE_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public GenericSlsQueryResponse executeQuery(GenericSlsQueryRequest request) {
        long startTime = System.currentTimeMillis();

        // 验证请求参数
        validateQueryRequest(request);

        // 构建SQL
        String finalSql = buildSqlWithFilters(request);
        finalSql = replacePlaceholders(finalSql, request);

        String scenario =
                StringUtils.hasText(request.getScenario()) ? request.getScenario() : "custom";

        try {
            // 执行查询
            List<Map<String, Object>> results = dorisJdbcTemplate.queryForList(finalSql);

            // 转换结果
            GenericSlsQueryResponse response = convertToResponse(results, request.getSql());
            response.setElapsedMillis(System.currentTimeMillis() - startTime);

            log.info(
                    "\n========== Doris Query Result ==========\n"
                            + "Scenario: {}\n"
                            + "Table: {}\n"
                            + "Time Range: {} ~ {}\n"
                            + "Result Count: {}\n"
                            + "Elapsed: {}ms\n"
                            + "Original SQL: {}\n"
                            + "Final SQL: {}\n"
                            + "=========================================",
                    scenario,
                    dorisConfig.getTableName(),
                    request.getFromTime(),
                    request.getToTime(),
                    response.getCount(),
                    response.getElapsedMillis(),
                    request.getSql(),
                    finalSql);

            return response;

        } catch (Exception e) {
            log.error(
                    "\n========== Doris Query Failed ==========\n"
                            + "Scenario: {}\n"
                            + "Table: {}\n"
                            + "Original SQL: {}\n"
                            + "Final SQL: {}\n"
                            + "Error: {}\n"
                            + "=========================================",
                    scenario,
                    dorisConfig.getTableName(),
                    request.getSql(),
                    finalSql,
                    e.getMessage(),
                    e);
            return buildErrorResponse(
                    request.getSql(), e.getMessage(), System.currentTimeMillis() - startTime);
        }
    }

    @Override
    public GenericSlsQueryResponse executeQuery(SlsCommonQueryRequest request) {
        GenericSlsQueryRequest genericRequest = new GenericSlsQueryRequest();
        genericRequest.setUserId(request.getUserId());
        genericRequest.setFromTime(request.getFromTime());
        genericRequest.setToTime(request.getToTime());
        genericRequest.setStartTime(request.getStartTime());
        genericRequest.setEndTime(request.getEndTime());
        genericRequest.setSql(request.getSql());
        genericRequest.setPageSize(request.getPageSize());
        return executeQuery(genericRequest);
    }

    @Override
    public boolean isConfigured() {
        return dorisConfig.isConfigured();
    }

    @Override
    public String getBackendType() {
        return "doris";
    }

    /**
     * 验证查询请求参数
     */
    private void validateQueryRequest(GenericSlsQueryRequest request) {
        if (!StringUtils.hasText(request.getSql())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "SQL cannot be empty");
        }

        // 处理时间区间
        if (request.getFromTime() == null || request.getToTime() == null) {
            if (StringUtils.hasText(request.getStartTime())
                    && StringUtils.hasText(request.getEndTime())) {
                try {
                    int from = parseToEpochSeconds(request.getStartTime().trim());
                    int to = parseToEpochSeconds(request.getEndTime().trim());
                    request.setFromTime(from);
                    request.setToTime(to);
                } catch (Exception e) {
                    throw new BusinessException(
                            ErrorCode.INVALID_REQUEST,
                            "Invalid StartTime/EndTime format, expected ISO 8601 or yyyy-MM-dd"
                                    + " HH:mm:ss");
                }
            } else {
                throw new BusinessException(
                        ErrorCode.INVALID_REQUEST,
                        "FromTime/ToTime or StartTime/EndTime is required");
            }
        }

        if (request.getFromTime() >= request.getToTime()) {
            throw new BusinessException(
                    ErrorCode.INVALID_REQUEST, "FromTime must be less than ToTime");
        }
    }

    /**
     * 解析字符串时间为 Unix 秒
     */
    private int parseToEpochSeconds(String timeStr) {
        // 优先尝试 ISO 8601（UTC Z）
        try {
            if (timeStr.endsWith("Z")) {
                return (int) Instant.parse(timeStr).getEpochSecond();
            }
        } catch (Exception ignored) {
        }

        // 尝试 ISO 8601（带偏移）
        try {
            if (timeStr.contains("T")) {
                return (int) OffsetDateTime.parse(timeStr).toEpochSecond();
            }
        } catch (Exception ignored) {
        }

        // 回退到本地时间格式
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        LocalDateTime ldt = LocalDateTime.parse(timeStr, formatter);
        return (int) ldt.atZone(ZoneId.systemDefault()).toEpochSecond();
    }

    /**
     * 构建带过滤条件的SQL
     */
    private String buildSqlWithFilters(GenericSlsQueryRequest request) {
        String sql = request.getSql();
        if (!StringUtils.hasText(sql)) {
            return sql;
        }

        List<String> filters = new ArrayList<>();

        // cluster_id
        if (request.getClusterId() != null && request.getClusterId().length > 0) {
            filters.add(buildInFilter("cluster_id", request.getClusterId()));
        }

        // api => ai_api
        if (request.getApi() != null && request.getApi().length > 0) {
            filters.add(buildInFilter("ai_api", request.getApi()));
        }

        // model => ai_model
        if (request.getModel() != null && request.getModel().length > 0) {
            filters.add(buildInFilter("ai_model", request.getModel()));
        }

        // consumer
        if (request.getConsumer() != null && request.getConsumer().length > 0) {
            filters.add(buildInFilter("consumer", request.getConsumer()));
        }

        // route => route_name
        if (request.getRoute() != null && request.getRoute().length > 0) {
            filters.add(buildInFilter("route_name", request.getRoute()));
        }

        // service => upstream_cluster
        if (request.getService() != null && request.getService().length > 0) {
            filters.add(buildInFilter("upstream_cluster", request.getService()));
        }

        // 如果有额外过滤条件，添加到 SQL 中
        if (!filters.isEmpty()) {
            String additionalFilters = String.join(" AND ", filters);
            // 在 {timeFilter} 后添加额外过滤条件
            sql = sql.replace("{timeFilter}", "{timeFilter} AND " + additionalFilters);
        }

        return sql;
    }

    /**
     * 构建 IN 过滤条件
     */
    private String buildInFilter(String field, String[] values) {
        if (values == null || values.length == 0) {
            return "";
        }

        List<String> quotedValues = new ArrayList<>();
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                // 转义单引号
                String escaped = value.trim().replace("'", "''");
                quotedValues.add("'" + escaped + "'");
            }
        }

        if (quotedValues.isEmpty()) {
            return "";
        }

        if (quotedValues.size() == 1) {
            return field + " = " + quotedValues.get(0);
        }

        return field + " IN (" + String.join(", ", quotedValues) + ")";
    }

    /**
     * 替换SQL中的占位符
     */
    private String replacePlaceholders(String sql, GenericSlsQueryRequest request) {
        if (sql == null) {
            return null;
        }

        String tableName = dorisConfig.getTableName();
        String timeField = dorisConfig.getTimeField();

        // 替换表名
        sql = sql.replace("{table}", tableName);

        // 替换时间字段
        sql = sql.replace("{timeField}", timeField);

        // 替换时间范围条件
        String fromTimeStr = formatEpochToDateTime(request.getFromTime());
        String toTimeStr = formatEpochToDateTime(request.getToTime());
        String timeFilter =
                timeField + " >= '" + fromTimeStr + "' AND " + timeField + " < '" + toTimeStr + "'";
        sql = sql.replace("{timeFilter}", timeFilter);

        // 替换 interval
        int interval =
                (request.getInterval() != null && request.getInterval() > 0)
                        ? request.getInterval()
                        : 60;
        sql = sql.replace("{interval}", String.valueOf(interval));

        // 追加 limit 限制
        String lowerSql = sql.toLowerCase(Locale.ROOT);
        if (!lowerSql.contains(" limit ")) {
            int defaultLimit = 1000;
            int maxLimit = 5000;
            Integer reqLimit = request.getPageSize();
            int limit = reqLimit == null ? defaultLimit : Math.min(Math.max(reqLimit, 1), maxLimit);
            sql = sql + " LIMIT " + limit;
        }

        return sql;
    }

    /**
     * 将 Unix 时间戳转换为日期时间字符串
     */
    private String formatEpochToDateTime(Integer epochSeconds) {
        if (epochSeconds == null) {
            return "";
        }
        LocalDateTime dateTime =
                LocalDateTime.ofInstant(
                        Instant.ofEpochSecond(epochSeconds), ZoneId.systemDefault());
        return dateTime.format(DATE_TIME_FORMATTER);
    }

    /**
     * 转换查询结果为统一响应格式
     */
    private GenericSlsQueryResponse convertToResponse(
            List<Map<String, Object>> results, String sql) {

        List<Map<String, String>> logs = new ArrayList<>();
        List<Map<String, String>> aggregations = new ArrayList<>();

        for (Map<String, Object> row : results) {
            Map<String, String> stringRow = new LinkedHashMap<>();

            for (Map.Entry<String, Object> entry : row.entrySet()) {
                String key = entry.getKey();
                Object value = entry.getValue();

                if (value != null) {
                    String strValue;
                    if (value instanceof Timestamp) {
                        strValue =
                                ((Timestamp) value).toLocalDateTime().format(DATE_TIME_FORMATTER);
                    } else {
                        strValue = String.valueOf(value);
                    }

                    if (!"null".equals(strValue)) {
                        stringRow.put(key, strValue);
                    }
                }
            }

            if (!stringRow.isEmpty()) {
                // 判断是否为时序数据（包含 time 字段）
                if (stringRow.containsKey("time")
                        || stringRow.containsKey(dorisConfig.getTimeField())) {
                    logs.add(stringRow);
                } else {
                    aggregations.add(stringRow);
                }
            }
        }

        return GenericSlsQueryResponse.builder()
                .success(true)
                .processStatus("Complete")
                .count((long) results.size())
                .logs(logs.isEmpty() ? null : logs)
                .aggregations(aggregations.isEmpty() ? null : aggregations)
                .sql(sql)
                .build();
    }

    /**
     * 构建错误响应
     */
    private GenericSlsQueryResponse buildErrorResponse(
            String sql, String errorMessage, long elapsed) {
        return GenericSlsQueryResponse.builder()
                .success(false)
                .sql(sql)
                .errorMessage(errorMessage)
                .elapsedMillis(elapsed)
                .build();
    }
}
