# Doris Log Backend Support Design

## Overview

Add Doris as an alternative log query backend for HiMarket's observability feature. Currently only Alibaba Cloud SLS is supported. This design enables switching between SLS and Doris via configuration.

## Background

- Current state: Only SLS (Alibaba Cloud Log Service) is supported
- User requirement: Support self-hosted Doris as log backend
- Data pipeline: filebeat -> logstash -> kafka -> doris (already in place)

## Design Goals

1. Support Doris as log query backend
2. Switch between SLS and Doris via configuration
3. No frontend changes required (scenario names remain consistent)
4. Keep table schema flexible (user-defined)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   SlsController                      │
│              (unchanged, scenario query entry)       │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              LogQueryService (new interface)         │
│   - executeQuery(GenericSlsQueryRequest)            │
│   - checkConnection()                               │
└─────────────────────┬───────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│ SlsLogServiceImpl│    │DorisLogServiceImpl│
│   (existing)     │    │    (new)          │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│SlsPresetRegistry │    │DorisPresetRegistry│
│  (existing SQL)  │    │  (new SQL)        │
└──────────────────┘    └──────────────────┘
```

## Component Design

### 1. Common Interface

```java
// LogQueryService.java
public interface LogQueryService {

    GenericSlsQueryResponse executeQuery(GenericSlsQueryRequest request);

    GenericSlsQueryResponse executeQuery(SlsCommonQueryRequest request);

    boolean isConfigured();

    String getBackendType(); // "sls" or "doris"
}
```

### 2. Configuration Classes

```java
// DorisConfig.java
@Configuration
@ConfigurationProperties(prefix = "doris")
public class DorisConfig {
    private String jdbcUrl;      // jdbc:mysql://fe-host:9030/db
    private String username;
    private String password;
    private String database;
    private String tableName;    // log table name
    private String timeField;    // time field, default "log_time"
}

// ObservabilityConfig.java
@Configuration
@ConfigurationProperties(prefix = "observability")
public class ObservabilityConfig {
    private String backend = "sls";  // sls | doris
}
```

### 3. Conditional Injection

```java
@Service
@ConditionalOnProperty(name = "observability.backend", havingValue = "sls", matchIfMissing = true)
public class SlsLogServiceImpl implements LogQueryService { ... }

@Service
@ConditionalOnProperty(name = "observability.backend", havingValue = "doris")
public class DorisLogServiceImpl implements LogQueryService { ... }
```

### 4. Doris Service Implementation

```java
@Service
@ConditionalOnProperty(name = "observability.backend", havingValue = "doris")
public class DorisLogServiceImpl implements LogQueryService {

    private final JdbcTemplate jdbcTemplate;
    private final DorisConfig dorisConfig;
    private final DorisPresetSqlRegistry presetRegistry;

    @Override
    public GenericSlsQueryResponse executeQuery(GenericSlsQueryRequest request) {
        // 1. Get preset SQL or use custom SQL
        String sql = StringUtils.hasText(request.getSql())
            ? request.getSql()
            : presetRegistry.getSql(request.getScenario());

        // 2. Build full query (add time range and filters)
        String fullSql = buildQueryWithFilters(sql, request);

        // 3. Execute query
        List<Map<String, Object>> results = jdbcTemplate.queryForList(fullSql);

        // 4. Convert to unified response format
        return convertToResponse(results, request);
    }
}
```

### 5. Doris SQL Registry

```java
@Component
public class DorisPresetSqlRegistry {

    private final Map<String, PresetSql> presets = new HashMap<>();

    @PostConstruct
    public void init() {
        // Card metrics
        register("pv", "SELECT COUNT(*) as pv FROM {table} WHERE {timeFilter}", CARD);
        register("uv", "SELECT COUNT(DISTINCT consumer) as uv FROM {table} WHERE {timeFilter}", CARD);

        // Time series metrics
        register("qps_total", """
            SELECT
                date_trunc('minute', {timeField}) as time,
                COUNT(*) / 60.0 as qps
            FROM {table}
            WHERE {timeFilter}
            GROUP BY 1 ORDER BY 1
            """, LINE, "time", "qps");

        register("success_rate", """
            SELECT
                date_trunc('minute', {timeField}) as time,
                SUM(CASE WHEN status < 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as rate
            FROM {table}
            WHERE {timeFilter}
            GROUP BY 1 ORDER BY 1
            """, LINE, "time", "rate");

        // Table metrics
        register("error_requests_table", """
            SELECT request_id, route_name, status, duration, error_message
            FROM {table}
            WHERE {timeFilter} AND status >= 400
            ORDER BY {timeField} DESC LIMIT 100
            """, TABLE);
    }
}
```

### Placeholder Reference

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{table}` | Log table name | `gateway_access_log` |
| `{timeField}` | Time field | `log_time` |
| `{timeFilter}` | Time range condition | `log_time BETWEEN '2024-01-01' AND '2024-01-02'` |
| `{interval}` | Aggregation interval | `minute` / `hour` |

## Key Differences

| Item | SLS | Doris |
|------|-----|-------|
| Time field | `__time__` | Configurable, e.g. `log_time` |
| Time format | Unix timestamp (seconds) | DateTime or timestamp |
| Connection | SDK Client | JDBC Template |
| Pagination | SDK parameter | LIMIT/OFFSET |

## File Changes

### New Files

```
himarket-server/src/main/java/com/alibaba/himarket/
├── config/
│   ├── DorisConfig.java              # Doris connection config
│   └── ObservabilityConfig.java      # Backend switch config
├── service/
│   ├── LogQueryService.java          # Common interface
│   └── impl/
│       └── DorisLogServiceImpl.java  # Doris implementation
└── service/gateway/factory/
    └── DorisPresetSqlRegistry.java   # Doris SQL templates
```

### Modified Files

```
himarket-server/src/main/java/com/alibaba/himarket/
├── service/
│   └── SlsLogService.java            # Extend LogQueryService
├── service/impl/
│   └── SlsLogServiceImpl.java        # Add @ConditionalOnProperty
└── controller/
    └── SlsController.java            # Inject LogQueryService instead of SlsLogService
```

### Configuration Example

```yaml
# application.yml
observability:
  backend: doris  # sls | doris

doris:
  jdbc-url: jdbc:mysql://127.0.0.1:9030/log_db
  username: root
  password:
  database: log_db
  table-name: gateway_access_log
  time-field: log_time
```

## Out of Scope

- Doris table DDL (user-defined)
- Logstash filter configuration (user already has)
- Data migration

## Testing Strategy

1. **Unit tests**: SQL building logic in DorisLogServiceImpl
2. **Integration tests**: Requires Doris environment, mark as `@Disabled` or place in IT directory
3. **Manual verification**: Frontend dashboard works after switching config

## PR Information

**Title**: `feat(observability): add Doris log backend support`

| Category | Count | Description |
|----------|-------|-------------|
| New files | 5 | Config, interface, implementation, SQL registry |
| Modified files | 3 | Interface abstraction, conditional injection, Controller adaptation |
| Frontend changes | 0 | Scenario names consistent, no changes needed |
