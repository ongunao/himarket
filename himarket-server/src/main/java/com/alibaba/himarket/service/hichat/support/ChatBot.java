package com.alibaba.himarket.service.hichat.support;

import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.message.Msg;
import io.agentscope.core.permission.PermissionMode;
import io.agentscope.core.state.AgentState;
import io.agentscope.core.state.AgentStateStore;
import io.agentscope.harness.agent.HarnessAgent;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Flux;

@Slf4j
@Data
@Builder
public class ChatBot {

    private static final String AGENT_STATE_KEY = "agent_state";
    private static final int MAX_CONTEXT_MESSAGES = 30;
    private static final long DEGRADED_TTL_MS = 2 * 60 * 1000;

    private final HarnessAgent agent;
    private final Map<String, ToolMeta> toolMetas;

    @Builder.Default private List<String> activeToolGroups = List.of();

    /**
     * Whether this ChatBot is in degraded mode (some MCP tools failed to initialize)
     */
    @Builder.Default private boolean degraded = false;

    /**
     * Timestamp when this ChatBot was created
     */
    @Builder.Default private long createTime = System.currentTimeMillis();

    public Flux<AgentEvent> chat(InvokeModelParam param) {
        AgentStateStore stateStore =
                Objects.requireNonNull(agent.getStateStore(), "ChatBot requires AgentStateStore");
        RuntimeContext runtimeContext =
                RuntimeContext.builder()
                        .userId(param.getUserId())
                        .sessionId(param.getSessionId())
                        .build();

        if (param.isRebuildMemory()) {
            stateStore.delete(param.getUserId(), param.getSessionId());
        }

        List<Msg> inputMessages = buildInputMessages(param);

        syncMcpState(param, stateStore);

        return agent.streamEvents(inputMessages, runtimeContext);
    }

    private void syncMcpState(InvokeModelParam param, AgentStateStore stateStore) {
        if (activeToolGroups == null || activeToolGroups.isEmpty()) {
            return;
        }

        List<String> groups = List.copyOf(activeToolGroups);
        // AgentScope resolves visible tools and permission mode from AgentState at call startup.
        AgentState state =
                stateStore
                        .get(
                                param.getUserId(),
                                param.getSessionId(),
                                AGENT_STATE_KEY,
                                AgentState.class)
                        .orElse(
                                AgentState.builder()
                                        .userId(param.getUserId())
                                        .sessionId(param.getSessionId())
                                        .build());

        boolean changed = false;
        if (!groups.equals(state.getToolContext().getActivatedGroups())) {
            state.getToolContext().setActivatedGroups(groups);
            changed = true;
        }
        if (state.getPermissionContext().getMode() != PermissionMode.BYPASS) {
            state.setPermissionContext(
                    state.getPermissionContext().withMode(PermissionMode.BYPASS));
            changed = true;
        }
        if (!changed) {
            return;
        }

        stateStore.save(param.getUserId(), param.getSessionId(), AGENT_STATE_KEY, state);
        log.debug(
                "Synced MCP runtime state to AgentState, sessionId={}, groupCount={},"
                        + " permissionMode={}",
                param.getSessionId(),
                groups.size(),
                PermissionMode.BYPASS);
    }

    private List<Msg> buildInputMessages(InvokeModelParam param) {
        List<Msg> historyMessages = param.getHistoryMessages();
        if (historyMessages == null || historyMessages.isEmpty()) {
            return List.of(param.getUserMessage());
        }

        int startIndex =
                historyMessages.size() > MAX_CONTEXT_MESSAGES
                        ? historyMessages.size() - MAX_CONTEXT_MESSAGES
                        : 0;

        List<Msg> inputMessages =
                new ArrayList<>(historyMessages.subList(startIndex, historyMessages.size()));
        inputMessages.add(param.getUserMessage());
        return inputMessages;
    }

    /**
     * Check if this ChatBot is still valid for use
     *
     * <p>Validation rules:
     * - Normal ChatBot: always valid (no expiration)
     * - Degraded ChatBot: valid only within 2 minutes after creation
     *
     * @return true if valid and can be reused, false if should be recreated
     */
    public boolean isValid() {
        // Degraded ChatBot: check TTL
        if (degraded) {
            long age = System.currentTimeMillis() - createTime;
            return age <= DEGRADED_TTL_MS;
        }

        // Normal ChatBot: always valid
        return true;
    }
}
