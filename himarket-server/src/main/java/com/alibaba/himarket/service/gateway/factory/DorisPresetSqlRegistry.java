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

package com.alibaba.himarket.service.gateway.factory;

import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Doris 预置场景SQL注册表
 * 使用标准SQL语法，与SLS的SQL模板保持场景名一致
 */
@Component
@Slf4j
@ConditionalOnProperty(name = "observability.backend", havingValue = "doris")
public class DorisPresetSqlRegistry implements PresetSqlRegistry {

    private final Map<String, SlsPresetSqlRegistry.Preset> presets = new HashMap<>();

    public DorisPresetSqlRegistry() {
        // ==================== 卡片类 ====================

        // 总请求次数
        presets.put(
                "pv",
                new SlsPresetSqlRegistry.Preset(
                        "pv",
                        SlsPresetSqlRegistry.DisplayType.CARD,
                        "SELECT COUNT(*) as pv FROM {table} WHERE {timeFilter}",
                        null,
                        null));

        // 独立调用者数量
        presets.put(
                "uv",
                new SlsPresetSqlRegistry.Preset(
                        "uv",
                        SlsPresetSqlRegistry.DisplayType.CARD,
                        "SELECT COUNT(DISTINCT x_forwarded_for) as uv FROM {table} WHERE"
                                + " {timeFilter}",
                        null,
                        null));

        // Fallback 请求数
        presets.put(
                "fallback_count",
                new SlsPresetSqlRegistry.Preset(
                        "fallback_count",
                        SlsPresetSqlRegistry.DisplayType.CARD,
                        "SELECT COUNT(*) as cnt FROM {table} WHERE {timeFilter} AND"
                                + " response_code_details = 'internal_redirect'",
                        null,
                        null));

        // 网关入流量MB
        presets.put(
                "bytes_received",
                new SlsPresetSqlRegistry.Preset(
                        "bytes_received",
                        SlsPresetSqlRegistry.DisplayType.CARD,
                        "SELECT ROUND(SUM(bytes_received) / 1024.0 / 1024.0, 3) as received FROM"
                                + " {table} WHERE {timeFilter}",
                        null,
                        null));

        // 网关出流量MB
        presets.put(
                "bytes_sent",
                new SlsPresetSqlRegistry.Preset(
                        "bytes_sent",
                        SlsPresetSqlRegistry.DisplayType.CARD,
                        "SELECT ROUND(SUM(bytes_sent) / 1024.0 / 1024.0, 3) as sent FROM {table}"
                                + " WHERE {timeFilter}",
                        null,
                        null));

        // 输入 Token 总数
        presets.put(
                "input_token_total",
                new SlsPresetSqlRegistry.Preset(
                        "input_token_total",
                        SlsPresetSqlRegistry.DisplayType.CARD,
                        "SELECT SUM(CAST(json_extract_string(ai_log, '$.input_token') AS BIGINT))"
                                + " as input_token FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.model') IS NOT NULL",
                        null,
                        null));

        // 输出 Token 总数
        presets.put(
                "output_token_total",
                new SlsPresetSqlRegistry.Preset(
                        "output_token_total",
                        SlsPresetSqlRegistry.DisplayType.CARD,
                        "SELECT SUM(CAST(json_extract_string(ai_log, '$.output_token') AS BIGINT))"
                                + " as output_token FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.model') IS NOT NULL",
                        null,
                        null));

        // Token 总数
        presets.put(
                "token_total",
                new SlsPresetSqlRegistry.Preset(
                        "token_total",
                        SlsPresetSqlRegistry.DisplayType.CARD,
                        "SELECT SUM(CAST(json_extract_string(ai_log, '$.input_token') AS BIGINT))"
                                + " + SUM(CAST(json_extract_string(ai_log, '$.output_token') AS"
                                + " BIGINT)) as token FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.model') IS NOT NULL",
                        null,
                        null));

        // ==================== 线图类 ====================

        // 流式QPS
        presets.put(
                "qps_stream",
                new SlsPresetSqlRegistry.Preset(
                        "qps_stream",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time, "
                                + "CAST(COUNT(*) AS DOUBLE) / {interval} AS stream_qps "
                                + "FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.response_type') = 'stream' "
                                + "GROUP BY time ORDER BY time",
                        "time",
                        "stream_qps"));

        // 非流式QPS
        presets.put(
                "qps_normal",
                new SlsPresetSqlRegistry.Preset(
                        "qps_normal",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time, "
                                + "CAST(COUNT(*) AS DOUBLE) / {interval} AS normal_qps "
                                + "FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.response_type') = 'normal' "
                                + "GROUP BY time ORDER BY time",
                        "time",
                        "normal_qps"));

        // 总体QPS
        presets.put(
                "qps_total",
                new SlsPresetSqlRegistry.Preset(
                        "qps_total",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time,"
                                + " CAST(COUNT(*) AS DOUBLE) / {interval} AS total_qps FROM {table}"
                                + " WHERE {timeFilter} AND json_extract_string(ai_log,"
                                + " '$.response_type') IN ('stream', 'normal')"
                                + " GROUP BY time ORDER BY time",
                        "time",
                        "total_qps"));

        // 请求成功率
        presets.put(
                "success_rate",
                new SlsPresetSqlRegistry.Preset(
                        "success_rate",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time, SUM(CASE"
                            + " WHEN response_code > 0 AND response_code < 300 THEN 1 ELSE 0 END) *"
                            + " 1.0 / COUNT(*) AS success_rate FROM {table} WHERE {timeFilter}"
                            + " GROUP BY time ORDER BY time",
                        "time",
                        "success_rate"));

        // Token/s（输入）
        presets.put(
                "token_per_sec_input",
                new SlsPresetSqlRegistry.Preset(
                        "token_per_sec_input",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time, "
                                + "SUM(CAST(json_extract_string(ai_log, '$.input_token') AS"
                                + " BIGINT)) / {interval} AS input_token "
                                + "FROM {table} WHERE {timeFilter} "
                                + "GROUP BY time ORDER BY time",
                        "time",
                        "input_token"));

        // Token/s（输出）
        presets.put(
                "token_per_sec_output",
                new SlsPresetSqlRegistry.Preset(
                        "token_per_sec_output",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time, "
                                + "SUM(CAST(json_extract_string(ai_log, '$.output_token') AS"
                                + " BIGINT)) / {interval} AS output_token "
                                + "FROM {table} WHERE {timeFilter} "
                                + "GROUP BY time ORDER BY time",
                        "time",
                        "output_token"));

        // Token/s（总）
        presets.put(
                "token_per_sec_total",
                new SlsPresetSqlRegistry.Preset(
                        "token_per_sec_total",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time,"
                            + " (SUM(CAST(json_extract_string(ai_log, '$.input_token') AS BIGINT))"
                            + " + SUM(CAST(json_extract_string(ai_log, '$.output_token') AS"
                            + " BIGINT))) / {interval} AS total_token FROM {table} WHERE"
                            + " {timeFilter} GROUP BY time ORDER BY time",
                        "time",
                        "total_token"));

        // 平均RT（整体）
        presets.put(
                "rt_avg_total",
                new SlsPresetSqlRegistry.Preset(
                        "rt_avg_total",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time,"
                            + " AVG(CAST(json_extract_string(ai_log, '$.llm_service_duration') AS"
                            + " DOUBLE)) AS total_rt FROM {table} WHERE {timeFilter} AND"
                            + " json_extract_string(ai_log, '$.llm_service_duration') IS NOT NULL"
                            + " GROUP BY time ORDER BY time",
                        "time",
                        "total_rt"));

        // 平均RT（流式）
        presets.put(
                "rt_avg_stream",
                new SlsPresetSqlRegistry.Preset(
                        "rt_avg_stream",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time,"
                                + " AVG(CAST(json_extract_string(ai_log, '$.llm_service_duration')"
                                + " AS DOUBLE)) AS stream_rt FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.llm_service_duration') IS NOT"
                                + " NULL AND json_extract_string(ai_log, '$.response_type') ="
                                + " 'stream' GROUP BY time ORDER BY time",
                        "time",
                        "stream_rt"));

        // 平均RT（非流式）
        presets.put(
                "rt_avg_normal",
                new SlsPresetSqlRegistry.Preset(
                        "rt_avg_normal",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time,"
                                + " AVG(CAST(json_extract_string(ai_log, '$.llm_service_duration')"
                                + " AS DOUBLE)) AS normal_rt FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.llm_service_duration') IS NOT"
                                + " NULL AND json_extract_string(ai_log, '$.response_type') ="
                                + " 'normal' GROUP BY time ORDER BY time",
                        "time",
                        "normal_rt"));

        // 首包RT
        presets.put(
                "rt_first_token",
                new SlsPresetSqlRegistry.Preset(
                        "rt_first_token",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time,"
                                + " AVG(CAST(json_extract_string(ai_log,"
                                + " '$.llm_first_token_duration') AS DOUBLE)) AS first_token_rt FROM"
                                + " {table} WHERE {timeFilter} AND json_extract_string(ai_log,"
                                + " '$.llm_first_token_duration') IS NOT NULL GROUP BY time ORDER BY"
                                + " time",
                        "time",
                        "first_token_rt"));

        // 缓存命中/未命中/跳过
        presets.put(
                "cache_hit",
                new SlsPresetSqlRegistry.Preset(
                        "cache_hit",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time, "
                                + "CAST(COUNT(*) AS DOUBLE) / {interval} AS hit "
                                + "FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.cache_status') = 'hit' "
                                + "GROUP BY time ORDER BY time",
                        "time",
                        "hit"));

        presets.put(
                "cache_miss",
                new SlsPresetSqlRegistry.Preset(
                        "cache_miss",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time, "
                                + "CAST(COUNT(*) AS DOUBLE) / {interval} AS miss "
                                + "FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.cache_status') = 'miss' "
                                + "GROUP BY time ORDER BY time",
                        "time",
                        "miss"));

        presets.put(
                "cache_skip",
                new SlsPresetSqlRegistry.Preset(
                        "cache_skip",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time, "
                                + "CAST(COUNT(*) AS DOUBLE) / {interval} AS skip "
                                + "FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.cache_status') = 'skip' "
                                + "GROUP BY time ORDER BY time",
                        "time",
                        "skip"));

        // 限流请求数/s
        presets.put(
                "ratelimited_per_sec",
                new SlsPresetSqlRegistry.Preset(
                        "ratelimited_per_sec",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time,"
                            + " CAST(COUNT(*) AS DOUBLE) / {interval} AS ratelimited FROM {table}"
                            + " WHERE {timeFilter} AND json_extract_string(ai_log,"
                            + " '$.token_ratelimit_status') = 'limited' GROUP BY time ORDER BY"
                            + " time",
                        "time",
                        "ratelimited"));

        // 总QPS（MCP大盘）
        presets.put(
                "qps_total_simple",
                new SlsPresetSqlRegistry.Preset(
                        "qps_total_simple",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time,"
                            + " CAST(COUNT(*) AS DOUBLE) / {interval} AS total, 'total' AS"
                            + " response_code FROM {table} WHERE {timeFilter} GROUP BY time ORDER"
                            + " BY time",
                        "time",
                        "total"));

        // 平均RT（MCP大盘）
        presets.put(
                "rt_avg",
                new SlsPresetSqlRegistry.Preset(
                        "rt_avg",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time, "
                                + "AVG(duration) AS rt_avg "
                                + "FROM {table} WHERE {timeFilter} "
                                + "GROUP BY time ORDER BY time",
                        "time",
                        "rt_avg"));

        // P99 RT
        presets.put(
                "rt_p99",
                new SlsPresetSqlRegistry.Preset(
                        "rt_p99",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time, "
                                + "PERCENTILE_APPROX(duration, 0.99) AS rt_p99 "
                                + "FROM {table} WHERE {timeFilter} "
                                + "GROUP BY time ORDER BY time",
                        "time",
                        "rt_p99"));

        // P95 RT
        presets.put(
                "rt_p95",
                new SlsPresetSqlRegistry.Preset(
                        "rt_p95",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time, "
                                + "PERCENTILE_APPROX(duration, 0.95) AS rt_p95 "
                                + "FROM {table} WHERE {timeFilter} "
                                + "GROUP BY time ORDER BY time",
                        "time",
                        "rt_p95"));

        // P90 RT
        presets.put(
                "rt_p90",
                new SlsPresetSqlRegistry.Preset(
                        "rt_p90",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time, "
                                + "PERCENTILE_APPROX(duration, 0.90) AS rt_p90 "
                                + "FROM {table} WHERE {timeFilter} "
                                + "GROUP BY time ORDER BY time",
                        "time",
                        "rt_p90"));

        // P50 RT
        presets.put(
                "rt_p50",
                new SlsPresetSqlRegistry.Preset(
                        "rt_p50",
                        SlsPresetSqlRegistry.DisplayType.LINE,
                        "SELECT DATE_FORMAT({timeField}, '%Y-%m-%d %H:%i:00') AS time, "
                                + "PERCENTILE_APPROX(duration, 0.50) AS rt_p50 "
                                + "FROM {table} WHERE {timeFilter} "
                                + "GROUP BY time ORDER BY time",
                        "time",
                        "rt_p50"));

        // ==================== 表格类 ====================

        // 模型token使用统计
        presets.put(
                "model_token_table",
                new SlsPresetSqlRegistry.Preset(
                        "model_token_table",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT json_extract_string(ai_log, '$.model') AS model, "
                                + "SUM(CAST(json_extract_string(ai_log, '$.input_token') AS"
                                + " BIGINT)) AS input_token, "
                                + "SUM(CAST(json_extract_string(ai_log, '$.output_token') AS"
                                + " BIGINT)) AS output_token, "
                                + "SUM(CAST(json_extract_string(ai_log, '$.input_token') AS"
                                + " BIGINT)) + SUM(CAST(json_extract_string(ai_log,"
                                + " '$.output_token') AS BIGINT)) AS total_token, "
                                + "COUNT(*) AS request "
                                + "FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.model') IS NOT NULL "
                                + "GROUP BY model ORDER BY total_token DESC",
                        null,
                        null));

        // 消费者token使用统计
        presets.put(
                "consumer_token_table",
                new SlsPresetSqlRegistry.Preset(
                        "consumer_token_table",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT json_extract_string(ai_log, '$.consumer') AS consumer, "
                                + "SUM(CAST(json_extract_string(ai_log, '$.input_token') AS"
                                + " BIGINT)) AS input_token, "
                                + "SUM(CAST(json_extract_string(ai_log, '$.output_token') AS"
                                + " BIGINT)) AS output_token, "
                                + "SUM(CAST(json_extract_string(ai_log, '$.input_token') AS"
                                + " BIGINT)) + SUM(CAST(json_extract_string(ai_log,"
                                + " '$.output_token') AS BIGINT)) AS total_token, "
                                + "COUNT(*) AS request "
                                + "FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.consumer') IS NOT NULL "
                                + "GROUP BY consumer ORDER BY total_token DESC",
                        null,
                        null));

        // 服务token使用统计
        presets.put(
                "service_token_table",
                new SlsPresetSqlRegistry.Preset(
                        "service_token_table",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT upstream_cluster, "
                                + "SUM(CAST(json_extract_string(ai_log, '$.input_token') AS"
                                + " BIGINT)) AS input_token, "
                                + "SUM(CAST(json_extract_string(ai_log, '$.output_token') AS"
                                + " BIGINT)) AS output_token, "
                                + "SUM(CAST(json_extract_string(ai_log, '$.input_token') AS"
                                + " BIGINT)) + SUM(CAST(json_extract_string(ai_log,"
                                + " '$.output_token') AS BIGINT)) AS total_token, "
                                + "COUNT(*) AS request "
                                + "FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.model') IS NOT NULL "
                                + "GROUP BY upstream_cluster ORDER BY total_token DESC",
                        null,
                        null));

        // 错误请求统计
        presets.put(
                "error_requests_table",
                new SlsPresetSqlRegistry.Preset(
                        "error_requests_table",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT response_code, response_code_details, response_flags, COUNT(*) AS"
                                + " cnt FROM {table} WHERE {timeFilter} AND (response_code = 0 OR"
                                + " response_code >= 400) GROUP BY response_code,"
                                + " response_code_details, response_flags ORDER BY cnt DESC",
                        null,
                        null));

        // 限流消费者统计
        presets.put(
                "ratelimited_consumer_table",
                new SlsPresetSqlRegistry.Preset(
                        "ratelimited_consumer_table",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT json_extract_string(ai_log, '$.consumer') AS consumer, COUNT(*) AS"
                            + " ratelimited_count FROM {table} WHERE {timeFilter} AND"
                            + " json_extract_string(ai_log, '$.token_ratelimit_status') = 'limited'"
                            + " GROUP BY consumer ORDER BY ratelimited_count DESC",
                        null,
                        null));

        // 风险类型统计
        presets.put(
                "risk_label_table",
                new SlsPresetSqlRegistry.Preset(
                        "risk_label_table",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT json_extract_string(ai_log, '$.safecheck_riskLabel') AS risklabel,"
                                + " COUNT(*) AS cnt FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.safecheck_status') = 'deny'"
                                + " GROUP BY risklabel ORDER BY cnt DESC",
                        null,
                        null));

        // 风险消费者统计
        presets.put(
                "risk_consumer_table",
                new SlsPresetSqlRegistry.Preset(
                        "risk_consumer_table",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT json_extract_string(ai_log, '$.consumer') AS consumer, COUNT(*) AS"
                            + " cnt FROM {table} WHERE {timeFilter} AND"
                            + " json_extract_string(ai_log, '$.safecheck_status') = 'deny' GROUP BY"
                            + " consumer ORDER BY cnt DESC",
                        null,
                        null));

        // Method分布
        presets.put(
                "method_distribution",
                new SlsPresetSqlRegistry.Preset(
                        "method_distribution",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT method, COUNT(*) AS count "
                                + "FROM {table} WHERE {timeFilter} AND method IS NOT NULL "
                                + "GROUP BY method",
                        null,
                        null));

        // 网关状态码分布
        presets.put(
                "gateway_status_distribution",
                new SlsPresetSqlRegistry.Preset(
                        "gateway_status_distribution",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT response_code AS status, COUNT(*) AS count "
                                + "FROM {table} WHERE {timeFilter} AND response_code IS NOT NULL "
                                + "GROUP BY response_code",
                        null,
                        null));

        // 后端状态码分布
        presets.put(
                "backend_status_distribution",
                new SlsPresetSqlRegistry.Preset(
                        "backend_status_distribution",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT response_code AS status, COUNT(*) AS count FROM {table} WHERE"
                            + " {timeFilter} AND response_code_details = 'via_upstream' GROUP BY"
                            + " response_code",
                        null,
                        null));

        // 请求分布
        presets.put(
                "request_distribution",
                new SlsPresetSqlRegistry.Preset(
                        "request_distribution",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT json_extract_string(ai_log, '$.mcp_tool_name') AS tool_name,"
                                + " response_code, response_flags, response_code_details, COUNT(*)"
                                + " AS cnt FROM {table} WHERE {timeFilter} GROUP BY tool_name,"
                                + " response_code, response_flags, response_code_details ORDER BY"
                                + " cnt DESC",
                        null,
                        null));

        // ==================== 过滤选项类 ====================

        // 实例列表
        presets.put(
                "filter_service_options",
                new SlsPresetSqlRegistry.Preset(
                        "filter_service_options",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT DISTINCT upstream_cluster AS service FROM {table} WHERE"
                                + " {timeFilter} AND upstream_cluster IS NOT NULL LIMIT 100",
                        null,
                        null));

        // API列表
        presets.put(
                "filter_api_options",
                new SlsPresetSqlRegistry.Preset(
                        "filter_api_options",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT DISTINCT json_extract_string(ai_log, '$.api') AS api FROM {table}"
                                + " WHERE {timeFilter} AND json_extract_string(ai_log, '$.api') IS"
                                + " NOT NULL LIMIT 100",
                        null,
                        null));

        // 模型列表
        presets.put(
                "filter_model_options",
                new SlsPresetSqlRegistry.Preset(
                        "filter_model_options",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT DISTINCT json_extract_string(ai_log, '$.model') AS model FROM"
                                + " {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.model') IS NOT NULL LIMIT 100",
                        null,
                        null));

        // 路由列表
        presets.put(
                "filter_route_options",
                new SlsPresetSqlRegistry.Preset(
                        "filter_route_options",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT DISTINCT route_name FROM {table} WHERE {timeFilter} AND route_name"
                                + " IS NOT NULL LIMIT 100",
                        null,
                        null));

        // 消费者列表
        presets.put(
                "filter_consumer_options",
                new SlsPresetSqlRegistry.Preset(
                        "filter_consumer_options",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT DISTINCT json_extract_string(ai_log, '$.consumer') AS consumer FROM"
                                + " {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.consumer') IS NOT NULL LIMIT 100",
                        null,
                        null));

        // 上游服务列表
        presets.put(
                "filter_upstream_options",
                new SlsPresetSqlRegistry.Preset(
                        "filter_upstream_options",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT DISTINCT upstream_cluster FROM {table} WHERE {timeFilter} AND"
                                + " upstream_cluster IS NOT NULL LIMIT 100",
                        null,
                        null));

        // MCP工具名称列表
        presets.put(
                "filter_mcp_tool_options",
                new SlsPresetSqlRegistry.Preset(
                        "filter_mcp_tool_options",
                        SlsPresetSqlRegistry.DisplayType.TABLE,
                        "SELECT DISTINCT json_extract_string(ai_log, '$.mcp_tool_name') AS"
                                + " mcp_tool_name FROM {table} WHERE {timeFilter} AND"
                                + " json_extract_string(ai_log, '$.mcp_tool_name') IS NOT NULL LIMIT"
                                + " 100",
                        null,
                        null));
    }

    @Override
    public SlsPresetSqlRegistry.Preset getPreset(String scenario) {
        if (scenario == null) {
            return null;
        }
        SlsPresetSqlRegistry.Preset p = presets.get(scenario);
        if (p == null) {
            log.warn("Unknown scenario: {}", scenario);
        }
        return p;
    }
}
