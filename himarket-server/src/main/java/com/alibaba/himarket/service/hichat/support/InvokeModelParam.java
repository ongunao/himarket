package com.alibaba.himarket.service.hichat.support;

import com.alibaba.himarket.dto.result.consumer.CredentialContext;
import com.alibaba.himarket.dto.result.product.ProductResult;
import com.alibaba.himarket.support.chat.mcp.McpTransportConfig;
import io.agentscope.core.message.Msg;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvokeModelParam {

    /**
     * Chat ID
     */
    private String chatId;

    /**
     * Session ID
     */
    private String sessionId;

    /**
     * User ID
     */
    private String userId;

    /**
     * Model Product
     */
    private ProductResult product;

    /**
     * User message, contains user question and multimodal
     */
    private Msg userMessage;

    /**
     * History messages for initializing memory
     */
    private List<Msg> historyMessages;

    /**
     * If need web search
     */
    private boolean enableWebSearch;

    /**
     * If need thinking/reasoning chunks.
     */
    private boolean enableThinking;

    /**
     * If need rebuild memory from persisted chat history before this invocation.
     */
    private boolean rebuildMemory;

    /**
     * Gateway ID
     */
    private String gatewayId;

    /**
     * MCP servers with transport config
     */
    private List<McpTransportConfig> mcpConfigs;

    /**
     * Credential for invoking the Model and MCP
     */
    private CredentialContext credentialContext;
}
