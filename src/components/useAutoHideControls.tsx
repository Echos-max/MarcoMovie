import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * @param timeout 自动隐藏的时间（毫秒）
 * @param enabled 是否启用倒计时（比如暂停时传 false）
 */
export default function useAutoHideControls(timeout = 30000, enabled = true) {
    const [showControls, setShowControls] = useState(true);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 清除定时器
    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // 重置定时器
    const resetTimer = useCallback(() => {
        clearTimer();
        if (enabled) {
            timerRef.current = setTimeout(() => {
                setShowControls(false);
            }, timeout);
        }
    }, [timeout, clearTimer, enabled]);

    // 切换显隐
    const toggleControls = useCallback(() => {
        setShowControls(prev => {
            const next = !prev;
            if (next) {
                // 唤出控件时，立刻重置倒计时
                resetTimer();
            } else {
                // 手动隐藏时，清掉倒计时
                clearTimer();
            }
            return next;
        });
    }, [resetTimer, clearTimer]);

    // 当 enabled 变化时（比如从播放变成暂停），重新处理定时器
    useEffect(() => {
        if (!enabled) {
            clearTimer();
        } else {
            resetTimer();
        }
        return clearTimer;
    }, [enabled, resetTimer, clearTimer]);

    return { showControls, toggleControls, resetTimer };
}