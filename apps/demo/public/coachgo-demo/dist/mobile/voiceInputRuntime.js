/**
 * WKWebView's Web Speech recognition can stall while its audio session is
 * repeatedly started and aborted from a settings switch. The iOS app keeps
 * explicit, button-triggered voice reporting, but does not run the passive
 * "登録" wake-listener in the background.
 */
export function shouldRunPassiveVoiceCommandRecognition(isNativeWebView) {
    return !isNativeWebView;
}
export function resolveVoiceInputRuntime(storedEnabled, isNativeWebView) {
    if (isNativeWebView)
        return { enabled: false, underDevelopment: true };
    return { enabled: storedEnabled, underDevelopment: false };
}
//# sourceMappingURL=voiceInputRuntime.js.map