
import { useEvent } from 'expo';
import * as Network from 'expo-network';
import { useVideoPlayer, VideoView } from 'expo-video';
import { PauseIcon, PlayIcon } from 'panelui-native';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import ProgressBar from './ProgressBar';
import useAutoHideControls from './useAutoHideControls';

type Props = {
    url: string;
    title?: string;
    episodeLabel: string;
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    onBack: () => void;
    onPlaybackError: (message: string) => void;
    onProgress: (currentTime: number, duration: number, force?: boolean) => void;
    initialPosition?: number;
    episodes: { title: string }[];
    currentEpisodeIndex: number;
    onSelectEpisode: (index: number) => void;
};

export default function PlayerCore({
                                       url,
                                       title,
                                       episodeLabel,
                                       hasPrev,
                                       hasNext,
                                       onPrev,
                                       onNext,
                                       onBack,
                                       onPlaybackError,
                                       onProgress,
                                       initialPosition = 0,
                                       episodes,
                                       currentEpisodeIndex,
                                       onSelectEpisode,
                                   }: Props) {
    // 播放器实例
    const player = useVideoPlayer(url, (p) => {
        p.loop = false;
        p.pause();
    });

    const { isPlaying } = useEvent(player, 'playingChange', {
        isPlaying: player.playing,
    });

    // 监听播放器加载状态和错误
    const { status, error } = useEvent(
        player,
        'statusChange',
        { status: player.status }
    );
    /**
     * 检测到播放器错误时通知父页面。
     *
     *
     *
     * 每个播放器实例只通知一次，避免重复切换线路。
     *
     *
     *
     * 保留原有错误检测和日志功能。
     */
    const hasError = status === 'error' || error != null;
    const initialPositionAppliedRef = useRef(false);

    // 视频准备完成后，先恢复上次进度，再开始播放
    useEffect(() => {
        if (status !== 'readyToPlay' || hasError || initialPositionAppliedRef.current) return;

        const savedPosition = Math.max(0, initialPosition);
        const videoDuration = player.duration ?? 0;
        const targetPosition = videoDuration > 0
            ? Math.min(savedPosition, Math.max(0, videoDuration - 1))
            : savedPosition;

        player.currentTime = targetPosition;
        setCurrent(targetPosition);
        if (videoDuration > 0) setDuration(videoDuration);

        initialPositionAppliedRef.current = true;
        player.play();
    }, [player, status, hasError, initialPosition]);
    const errorNotifiedRef = useRef(false);
    const playbackStatusRef = useRef(status);
    const playbackErrorCallbackRef = useRef(onPlaybackError);
    const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    playbackStatusRef.current = status;
    playbackErrorCallbackRef.current = onPlaybackError;

    // 首次加载超过 30 秒仍未准备好时，通知父页面尝试备用线路
    useEffect(() => {
        const timeout = setTimeout(() => {
            const currentStatus = playbackStatusRef.current;

            if (
                currentStatus === 'readyToPlay' ||
                currentStatus === 'error' ||
                errorNotifiedRef.current
            ) {
                return;
            }

            errorNotifiedRef.current = true;

            console.warn('[播放器加载超时，尝试备用线路]', {
                url,
                status: currentStatus,
            });

            playbackErrorCallbackRef.current(
                '视频加载超时，当前线路不可用'
            );
        }, 30000);

        loadTimeoutRef.current = timeout;

        return () => {
            clearTimeout(timeout);

            if (loadTimeoutRef.current === timeout) {
                loadTimeoutRef.current = null;
            }
        };
    }, [player]);

    // 播放器准备完成后立即清除加载计时器
    useEffect(() => {
        if (status === 'readyToPlay' && loadTimeoutRef.current !== null) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
        }
    }, [status]);

    useEffect(() => {
        if (hasError && !errorNotifiedRef.current) {
            errorNotifiedRef.current = true;

            console.log('[自动切换诊断] PlayerCore 已触发错误回调');

            onPlaybackError(
                error?.message || '视频源无法访问或视频加载失败'
            );
        }
    }, [hasError, error, onPlaybackError]);
    useEffect(() => {
        console.log('[播放器状态变化]', {
            status,
            error: error?.message ?? null,
            hasError,
        });
    }, [status, error, hasError]);
    useEffect(() => {
        if (hasError) {
            console.warn('[播放器加载失败]', {
                url,
                error: error?.message ?? '未知播放错误',
            });
        }
    }, [hasError, error, url]);

    // 进度条状态
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isBuffering, setIsBuffering] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showPlaybackRateMenu, setShowPlaybackRateMenu] = useState(false);
    const [showEpisodePanel, setShowEpisodePanel] = useState(false);

    // 切换集数时恢复默认倍速
    useEffect(() => {
        player.playbackRate = 1;
        setPlaybackRate(1);
        setShowPlaybackRateMenu(false);
    }, [url, player]);
    const [gestureHint, setGestureHint] = useState('');
    const lastTapAtRef = useRef(0);
    const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const gestureStartRef = useRef<number | null>(null);
    const gestureHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (singleTapTimerRef.current) {
                clearTimeout(singleTapTimerRef.current);
            }

            if (gestureHintTimerRef.current) {
                clearTimeout(gestureHintTimerRef.current);
            }

        };
    }, []);
    const seekingRef = useRef(false);
    const lastPlaybackTimeRef = useRef(0);
    const lastPlaybackProgressAtRef = useRef(Date.now());

    // 监听网络状态，仅在明确断网时显示提示
    useEffect(() => {
        let active = true;

        const updateNetworkState = (state: Network.NetworkState) => {
            if (active) {
                setIsOffline(state.isConnected === false);
            }
        };

        Network.getNetworkStateAsync()
            .then(updateNetworkState)
            .catch(() => {
                if (active) setIsOffline(false);
            });

        const subscription = Network.addNetworkStateListener(updateNetworkState);

        return () => {
            active = false;
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        const id = setInterval(() => {
            if (seekingRef.current || hasError) return;

            const t = player.currentTime ?? 0;
            const d = player.duration ?? 0;

            setCurrent(t);

            if (d > 0) {
                setDuration(d);
            }
        }, 250);

        return () => clearInterval(id);
    }, [player, hasError]);

    // 检测播放过程中时间是否停滞，避免暂停状态误判为缓冲
    useEffect(() => {
        const id = setInterval(() => {
            const now = Date.now();
            const currentTime = player.currentTime ?? 0;

            if (!isPlaying || status !== 'readyToPlay' || hasError) {
                lastPlaybackTimeRef.current = currentTime;
                lastPlaybackProgressAtRef.current = now;
                setIsBuffering(false);
                return;
            }

            if (currentTime > lastPlaybackTimeRef.current + 0.05) {
                lastPlaybackTimeRef.current = currentTime;
                lastPlaybackProgressAtRef.current = now;
                setIsBuffering(false);
                return;
            }

            if (now - lastPlaybackProgressAtRef.current >= 1500) {
                setIsBuffering(true);
            }
        }, 500);

        return () => clearInterval(id);
    }, [player, isPlaying, status, hasError]);

    // 定期向父页面报告播放进度，卸载时补报最后进度
    useEffect(() => {
        const id = setInterval(() => {
            if (hasError) return;
            if (status !== 'readyToPlay') return;

            onProgress(
                player.currentTime ?? 0,
                player.duration ?? 0
            );
        }, 1000);

        return () => {
            clearInterval(id);
            if (status === 'readyToPlay') {
                onProgress(
                    player.currentTime ?? 0,
                    player.duration ?? 0,
                    true
                );
            }
        };
    }, [player, hasError, status, onProgress]);


    // 控件自动隐藏
    const {
        showControls,
        toggleControls,
        resetTimer,
    } = useAutoHideControls(30000, isPlaying);

    // 进度条操作
    const onSeekStart = () => {
        seekingRef.current = true;
        resetTimer();
    };

    const onSeeking = (ratio: number) => {
        setCurrent(ratio * (duration || 0));
    };

    const onSeekEnd = (ratio: number) => {
        const t = ratio * (duration || 0);

        player.currentTime = t;
        seekingRef.current = false;
        setCurrent(t);

        resetTimer();
    };

    // 播放暂停
    const handlePlayPause = () => {
        isPlaying ? player.pause() : player.play();
        resetTimer();
    };

    // 切换播放倍速
    const handlePlaybackRateChange = (rate: number) => {
        player.playbackRate = rate;
        setPlaybackRate(rate);
        setShowPlaybackRateMenu(false);
        resetTimer();
    };

    // 快退或快进指定秒数
    const handleSeekBy = (seconds: number) => {
        const currentTime = player.currentTime ?? current;
        const videoDuration = player.duration ?? duration;
        const targetTime = Math.max(
            0,
            videoDuration > 0
                ? Math.min(videoDuration, currentTime + seconds)
                : currentTime + seconds
        );

        player.currentTime = targetTime;
        setCurrent(targetTime);
        resetTimer();
    };

    const handleGestureTap = () => {
        const now = Date.now();

        if (now - lastTapAtRef.current < 280) {
            lastTapAtRef.current = 0;

            if (singleTapTimerRef.current) {
                clearTimeout(singleTapTimerRef.current);
                singleTapTimerRef.current = null;
            }

            handlePlayPause();
            return;
        }

        lastTapAtRef.current = now;

        singleTapTimerRef.current = setTimeout(() => {
            toggleControls();
            singleTapTimerRef.current = null;
            lastTapAtRef.current = 0;
        }, 280);
    };

    const showGestureHint = (message: string) => {
        setGestureHint(message);

        if (gestureHintTimerRef.current) {
            clearTimeout(gestureHintTimerRef.current);
        }

        gestureHintTimerRef.current = setTimeout(() => {
            setGestureHint('');
            gestureHintTimerRef.current = null;
        }, 900);
    };

    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
            Math.abs(gesture.dx) > 10 &&
            Math.abs(gesture.dx) > Math.abs(gesture.dy),

        onPanResponderGrant: () => {
            gestureStartRef.current = player.currentTime ?? 0;
        },

        onPanResponderMove: (_, gesture) => {
            const startTime = gestureStartRef.current;
            if (startTime === null) return;
            if (Math.abs(gesture.dx) <= Math.abs(gesture.dy)) return;

            const videoDuration = player.duration ?? duration;
            const target = Math.max(
                0,
                videoDuration > 0
                    ? Math.min(videoDuration, startTime + gesture.dx / 10)
                    : startTime + gesture.dx / 10
            );

            player.currentTime = target;
            setCurrent(target);
            showGestureHint(`${gesture.dx > 0 ? '快进' : '快退'} ${Math.abs(Math.round(gesture.dx / 10))} 秒`);
        },

        onPanResponderRelease: () => {
            gestureStartRef.current = null;
            resetTimer();
        },

        onPanResponderTerminate: () => {
            gestureStartRef.current = null;
            resetTimer();
        },
    });

    return (
        <View style={styles.container}>
            <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                nativeControls={false}
            />

            {/* 手势层 */}
            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={handleGestureTap}
                {...panResponder.panHandlers}
            />

            {/* 控件层 */}
            <View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        opacity: showControls ? 1 : 0,
                        backgroundColor: hasError
                            ? 'rgba(0,0,0,0.72)'
                            : 'rgba(0,0,0,0.3)',
                    },
                ]}
                pointerEvents={showControls ? 'box-none' : 'none'}
            >
                {/* 返回按钮和当前集数 */}
                <View style={styles.headerBar}>
                    <Pressable
                        style={styles.backBtn}
                        onPress={onBack}
                    >
                        <Text style={styles.backText}>← 返回</Text>
                    </Pressable>
                    <Text style={styles.episodeLabel} numberOfLines={1}>
                        {episodeLabel}
                    </Text>
                    <Pressable
                        style={styles.episodeButton}
                        onPress={() => {
                            setShowEpisodePanel(true);
                            resetTimer();
                        }}
                    >
                        <Text style={styles.rateButtonText}>选集</Text>
                    </Pressable>
                    <Pressable
                        style={styles.rateButton}
                        onPress={() => setShowPlaybackRateMenu((visible) => !visible)}
                    >
                        <Text style={styles.rateButtonText}>
                            {playbackRate.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}x
                        </Text>
                    </Pressable>
                </View>

                {showEpisodePanel && (
                    <>
                        <Pressable
                            style={styles.episodePanelBackdrop}
                            onPress={() => setShowEpisodePanel(false)}
                        />
                        <View style={styles.episodePanel}>
                            <View style={styles.episodePanelHeader}>
                                <Text style={styles.episodePanelTitle}>
                                    选集（{episodes.length}集）
                                </Text>
                                <Pressable onPress={() => setShowEpisodePanel(false)}>
                                    <Text style={styles.episodePanelClose}>×</Text>
                                </Pressable>
                            </View>

                            <ScrollView
                                style={styles.episodeList}
                                contentContainerStyle={styles.episodeListContent}
                                showsVerticalScrollIndicator
                            >
                                {episodes.map((episode, episodeIndex) => (
                                    <Pressable
                                        key={`${episodeIndex}-${episode.title}`}
                                        style={[
                                            styles.episodeItem,
                                            currentEpisodeIndex === episodeIndex &&
                                                styles.episodeItemActive,
                                        ]}
                                        onPress={() => {
                                            onSelectEpisode(episodeIndex);
                                            setShowEpisodePanel(false);
                                            resetTimer();
                                        }}
                                    >
                                        <Text
                                            numberOfLines={1}
                                            style={[
                                                styles.episodeItemText,
                                                currentEpisodeIndex === episodeIndex &&
                                                    styles.episodeItemTextActive,
                                            ]}
                                        >
                                            {episode.title || `第${episodeIndex + 1}集`}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    </>
                )}

                {showPlaybackRateMenu && (
                    <View style={styles.rateMenu}>
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                            <Pressable
                                key={rate}
                                style={[
                                    styles.rateOption,
                                    playbackRate === rate && styles.rateOptionActive,
                                ]}
                                onPress={() => handlePlaybackRateChange(rate)}
                            >
                                <Text
                                    style={[
                                        styles.rateOptionText,
                                        playbackRate === rate && styles.rateOptionTextActive,
                                    ]}
                                >
                                    {rate.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}x
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}

                {/* 中间播放区域 */}
                <View style={styles.centerWrap}>
                    {hasError ? (
                        <View style={styles.errorPanel}>
                            <Text style={styles.errorTitle}>
                                当前线路播放失败
                            </Text>

                            <Text style={styles.errorMessage}>
                                {error?.message ||
                                    '视频源无法访问或视频加载失败'}
                            </Text>

                            <Text style={styles.errorHint}>
                                请返回详情页，尝试切换其他播放线路
                            </Text>

                            <TouchableOpacity
                                style={styles.backToDetailBtn}
                                onPress={onBack}
                            >
                                <Text style={styles.backToDetailText}>
                                    返回详情页
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : status === 'loading' ? (
                        <View style={styles.loadingPanel}>
                            <ActivityIndicator size="large" color="#fff" />
                            <Text style={styles.loadingText}>正在加载视频...</Text>
                        </View>
                    ) : isBuffering ? (
                        <View style={styles.loadingPanel}>
                            <ActivityIndicator size="large" color="#fff" />
                            <Text style={styles.loadingText}>视频缓冲中...</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.playBtn}
                            onPress={handlePlayPause}
                        >
                            {isPlaying ? (
                                <PauseIcon size={32} color="#fff" />
                            ) : (
                                <PlayIcon size={32} color="#fff" />
                            )}
                        </TouchableOpacity>
                    )}

                </View>

                {/* 底部上下集和进度条 */}
                <View style={styles.bottomBar}>
                    <View style={styles.epRow}>
                        <Pressable
                            style={styles.skipBtn}
                            onPress={() => handleSeekBy(-10)}
                        >
                            <Text style={styles.skipText}>↶ 10秒</Text>
                        </Pressable>

                        <View style={styles.epNavContainer}>
                            <View style={styles.epNav}>
                                <Pressable
                                    onPress={() => {
                                        onPrev();
                                        resetTimer();
                                    }}
                                    disabled={!hasPrev}
                                    style={!hasPrev ? styles.disabledBtn : null}
                                >
                                    <Text style={styles.navText}>◀</Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => {
                                        onNext();
                                        resetTimer();
                                    }}
                                    disabled={!hasNext}
                                    style={!hasNext ? styles.disabledBtn : null}
                                >
                                    <Text style={styles.navText}>▶</Text>
                                </Pressable>
                            </View>
                        </View>
                    <Pressable
                        style={styles.skipBtn}
                        onPress={() => handleSeekBy(10)}
                    >
                        <Text style={styles.skipText}>10秒 ↷</Text>
                    </Pressable>
                    </View>

                    <View style={styles.epBot}>
                        <ProgressBar
                            current={current}
                            duration={duration}
                            onSeekStart={onSeekStart}
                            onSeeking={onSeeking}
                            onSeekEnd={onSeekEnd}
                        />
                    </View>
                </View>
            </View>

            {gestureHint ? (
                <View pointerEvents="none" style={styles.gestureHintContainer}>
                    <Text style={styles.gestureHintText}>{gestureHint}</Text>
                </View>
            ) : null}
            {isOffline && (
                <View pointerEvents="none" style={styles.offlineNotice}>
                    <Text style={styles.offlineText}>
                        当前网络不可用，请检查 Wi-Fi 或移动数据
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    gestureHintContainer: {
        position: 'absolute',
        top: '50%',
        alignSelf: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.78)',
        zIndex: 30,
    },
    gestureHintText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
    },    offlineNotice: {
        position: 'absolute',
        top: 92,
        left: 20,
        right: 20,
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.82)',
        zIndex: 20,
    },
    offlineText: {
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
    },
    headerBar: {
        position: 'absolute',
        top: 40,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 8,
    },
    episodeLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        overflow: 'hidden',
        flexShrink: 1,
    },    backText: {
        color: '#fff',
        fontSize: 16,
    },
    rateButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rateButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    episodeButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    episodePanelBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
        zIndex: 149,
    },
    episodePanel: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 320,
        maxWidth: '82%',
        paddingTop: 70,
        paddingHorizontal: 16,
        paddingBottom: 24,
        backgroundColor: 'rgba(18,18,18,0.97)',
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(255,255,255,0.12)',
        zIndex: 150,
    },
    episodePanelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    episodePanelTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    episodePanelClose: {
        color: '#fff',
        fontSize: 30,
        paddingHorizontal: 8,
    },
    episodeList: {
        flex: 1,
    },
    episodeListContent: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingBottom: 20,
    },
    episodeItem: {
        width: '31%',
        minHeight: 42,
        marginBottom: 10,
        paddingHorizontal: 4,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.10)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    episodeItemActive: {
        backgroundColor: 'rgba(24,144,255,0.28)',
        borderWidth: 1,
        borderColor: '#1890ff',
    },
    episodeItemText: {
        color: '#ddd',
        fontSize: 13,
    },
    episodeItemTextActive: {
        color: '#40a9ff',
        fontWeight: '700',
    },
    rateMenu: {
        position: 'absolute',
        top: 84,
        right: 20,
        zIndex: 120,
        minWidth: 110,
        padding: 6,
        borderRadius: 10,
        backgroundColor: 'rgba(20,20,20,0.95)',
    },
    rateOption: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 6,
        alignItems: 'center',
    },
    rateOptionActive: {
        backgroundColor: 'rgba(24,144,255,0.3)',
    },
    rateOptionText: {
        color: '#fff',
        fontSize: 15,
    },
    rateOptionTextActive: {
        color: '#40a9ff',
        fontWeight: '700',
    },
    centerWrap: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingPanel: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        color: '#fff',
        fontSize: 14,
    },
    playBtn: {
        padding: 12,
        borderRadius: 30,
    },
    errorPanel: {
        width: '80%',
        maxWidth: 520,
        alignItems: 'center',
        padding: 24,
        borderRadius: 16,
        backgroundColor: 'rgba(25,25,25,0.95)',
    },
    errorTitle: {
        color: '#ff6464',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    errorMessage: {
        color: '#ddd',
        fontSize: 14,
        textAlign: 'center',
    },
    errorHint: {
        color: '#aaa',
        fontSize: 14,
        marginTop: 12,
        textAlign: 'center',
    },
    backToDetailBtn: {
        marginTop: 22,
        paddingHorizontal: 26,
        paddingVertical: 12,
        backgroundColor: '#1890ff',
        borderRadius: 8,
    },
    backToDetailText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    bottomBar: {
        width: '92%',
        height: 154,
        zIndex: 99,
        position: 'absolute',
        left: '4%',
        right: '4%',
        bottom: '3%',
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.22)',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    epRow: {
        width: '100%',
        height: 44,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    skipBtn: {
        minWidth: 76,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    epNavContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    epNav: {
        width: 80,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    navText: {
        color: '#fff',
        fontSize: 20,
    },
    epBot: {
        width: '100%',
        height: 90,
        alignItems: 'center',
    },
    disabledBtn: {
        opacity: 0.3,
    },
});




