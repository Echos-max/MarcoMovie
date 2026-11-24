import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { clamp01, formatTime } from '../utils/format';

const THUMB = 14;

type Props = {
    current: number;
    duration: number;
    onSeekStart?: () => void;
    onSeeking?: (ratio: number) => void;
    onSeekEnd?: (ratio: number) => void;
};

export default function ProgressBar({ current, duration, onSeekStart, onSeeking, onSeekEnd }: Props) {
    const [trackW, setTrackW] = useState(0);
    const dragging = useRef(false);

    const ratio = duration > 0 ? clamp01(current / duration) : 0;

    const responder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => false,
                onMoveShouldSetPanResponder: (_, gesture) =>
                    Math.abs(gesture.dx) > 10 &&
                    Math.abs(gesture.dx) > Math.abs(gesture.dy),
                onPanResponderGrant: (e) => {
                    dragging.current = true;
                    onSeekStart?.();
                    onSeeking?.(clamp01(e.nativeEvent.locationX / (trackW || 1)));
                },
                onPanResponderMove: (e) => {
                    if (!dragging.current) return;
                    onSeeking?.(clamp01(e.nativeEvent.locationX / (trackW || 1)));
                },
                onPanResponderRelease: (e) => {
                    dragging.current = false;
                    onSeekEnd?.(clamp01(e.nativeEvent.locationX / (trackW || 1)));
                },
                onPanResponderTerminate: () => {
                    dragging.current = false;
                },
            }),
        [onSeekStart, onSeeking, onSeekEnd, trackW]
    );

    // 滑块位置：用实测宽度算，避免依赖 calc()
    const thumbLeft = Math.max(0, Math.min(trackW - THUMB, ratio * trackW - THUMB / 2));

    return (
        <View style={styles.wrap} {...responder.panHandlers}>
            <View style={styles.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
                <View style={[styles.played, { width: `${ratio * 100}%` }]} />
                <View style={[styles.thumb, { left: thumbLeft }]} />
            </View>
            <View style={styles.timeRow}>
                <Text style={styles.time}>{formatTime(current)}</Text>
                <Text style={styles.time}>{formatTime(duration)}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // 注意：这里不要加 paddingHorizontal，否则 locationX 和轨道宽度对不上，跳转会偏移
    wrap: { paddingVertical: 14,width:"100%",height:90 },
    track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.25)', position: 'relative' },
    played: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: '#fff' },
    thumb: { position: 'absolute', top: -5, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#fff' },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    time: { color: '#fff', fontSize: 12 },
});