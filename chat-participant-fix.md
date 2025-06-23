// 修复方案1: 在 SRS Chat Participant 中传递 toolInvocationToken

// 修改 processRequestCore 方法的签名，接受 request 对象
private async processRequestCore(
    prompt: string,
    model: vscode.LanguageModelChat | undefined,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    request?: vscode.ChatRequest  // 新增：传递完整的 request 对象
): Promise<void> {
    // ... 原有代码 ...

    // 4. 🚀 关键修复：传递 request 对象到引擎
    if (isAwaitingUser) {
        // 传递 request 到 handleUserResponse
        await agentEngine.handleUserResponse(prompt, request);
    } else {
        // 传递 request 到 executeTask
        await agentEngine.executeTask(prompt, request);
    }
}

// 修改 handleChatRequest 方法的调用
private async handleChatRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
): Promise<void> {
    try {
        if (request.prompt.startsWith('/')) {
            await this.handleSlashCommand(request, context, stream, token);
        } else {
            // 🚀 传递完整的 request 对象
            await this.processRequestCore(request.prompt, request.model, stream, token, request);
        }
    } catch (error) {
        // ... 错误处理 ...
    }
}
