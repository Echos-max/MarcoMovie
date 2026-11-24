
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon } from 'panelui-native';
import { marcoApi, type SpiderDetail } from '@/services/marcoApi';
import { getPlaybackHistory, type PlaybackRecord } from '@/services/playbackHistory';

const { height } = Dimensions.get('window');
const HEADER_HEIGHT = height * 0.65;

type Episode = {
    id: string;
    title: string;
    url: string;
};

type PlaySource = {
    id: string;
    name: string;
    episodes: Episode[];
};

function getParam(value: string | string[] | undefined): string {
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function toText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
    }
    return '';
}

// 解析 CatVod 剧集格式：第1集$url#第2集$url
function parseEpisodes(raw: string): Episode[] {
    if (!raw) return [];

    return raw
        .split('#')
        .map((part, index) => {
            const separator = part.indexOf('$');

            if (separator < 0) {
                return null;
            }

            const title = part.slice(0, separator).trim();
            const url = part.slice(separator + 1).trim();

            if (!url) return null;

            return {
                id: String(index),
                title: title || `第${index + 1}集`,
                url,
            };
        })
        .filter((item): item is Episode => item !== null);
}

export default function MovieDetailUI() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        id?: string | string[];
        siteKey?: string | string[];
    }>();

    const movieId = getParam(params.id);
    const siteKey = getParam(params.siteKey);

    const scrollY = useRef(new Animated.Value(0)).current;

    const [detail, setDetail] = useState<SpiderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedLine, setSelectedLine] = useState(0);

    const [resumeRecord, setResumeRecord] = useState<PlaybackRecord | null>(null);

    // 读取当前影片的本地播放记录
    useEffect(() => {
        let active = true;
        setResumeRecord(null);

        if (!movieId || !siteKey) {
            return () => { active = false; };
        }

        void getPlaybackHistory().then(records => {
            if (!active) return;

            const record = records.find(
                item => item.movieId === movieId && item.siteKey === siteKey
            );

            setResumeRecord(record ?? null);
        });

        return () => { active = false; };
    }, [movieId, siteKey]);

    const scale = scrollY.interpolate({
        inputRange: [-200, 0, 1],
        outputRange: [2, 1, 1],
        extrapolateRight: 'clamp',
    });

    const translateY = scrollY.interpolate({
        inputRange: [-200, 0, 1],
        outputRange: [-100, 0, 0],
        extrapolateRight: 'clamp',
    });

    // 获取真实影片详情
    useEffect(() => {
        let active = true;

        async function loadDetail() {
            if (!movieId || !siteKey) {
                setError('影片参数不完整，请返回影片列表重新进入。');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError('');

                const result = await marcoApi.getSpiderDetail(siteKey, [movieId]);

                if (!active) return;

                const video = result.list?.find(
                    item => String(item.vod_id) === movieId
                ) ?? result.list?.[0];

                if (!video) {
                    setError('没有获取到影片详情，可能是该影视源暂时无法提供详情。');
                    setDetail(null);
                    return;
                }

                setDetail(video);
                setSelectedLine(0);
            } catch (e) {
                if (!active) return;

                setError(
                    e instanceof Error ? e.message : '获取影片详情失败'
                );
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadDetail();

        return () => {
            active = false;
        };
    }, [movieId, siteKey]);

    // 解析播放线路和每条线路的剧集
    const playSources = useMemo<PlaySource[]>(() => {
        if (!detail) return [];

        const flags = (detail.vod_play_from ?? '').split('$$$');
        const urls = (detail.vod_play_url ?? '').split('$$$');

        return urls
            .map((raw, index) => ({
                id: String(index),
                name: flags[index]?.trim() || `线路${index + 1}`,
                episodes: parseEpisodes(raw),
            }))
            .filter(source => source.episodes.length > 0);
    }, [detail]);

    const currentSource = playSources[selectedLine] ?? playSources[0];
    const episodes = currentSource?.episodes ?? [];

    // 优先匹配上次观看线路，找不到时回退到第一条线路
    const matchedResumeSourceIndex = resumeRecord?.sourceName
        ? playSources.findIndex(source => source.name === resumeRecord.sourceName)
        : -1;
    const resumeSourceIndex = matchedResumeSourceIndex >= 0
        ? matchedResumeSourceIndex
        : 0;
    const resumeSource = playSources[resumeSourceIndex];
    const resumeEpisodeIndex = resumeRecord && resumeSource
        ? Math.min(
            Math.max(0, Math.floor(resumeRecord.episodeIndex)),
            resumeSource.episodes.length - 1
        )
        : 0;

    const handleResume = () => {
        if (!resumeRecord || !resumeSource || resumeSource.episodes.length === 0) return;

        router.push({
            pathname: '/player/[id]',
            params: {
                id: movieId,
                episodeIndex: String(resumeEpisodeIndex),
                episodeList: JSON.stringify(resumeSource.episodes),
                playSources: JSON.stringify(playSources),
                sourceIndex: String(resumeSourceIndex),
                siteKey,
                flag: resumeSource.name,
                movieTitle: detail?.vod_name || '未知影片',
                posterUrl: detail?.vod_pic || '',
                startPosition: String(Math.max(0, resumeRecord.currentTime || 0)),
            },
        });
    };

    const actor = toText(detail?.vod_actor);
    const director = toText(detail?.vod_director);
    const year = toText(detail?.vod_year);
    const area = toText(detail?.['vod_area']);
    const category = toText(detail?.['vod_class']);
    const remarks = toText(detail?.vod_remarks);

    const description = toText(detail?.vod_content)
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim();

    const actors = actor
        .split(/[,，、/]/)
        .map(name => name.trim())
        .filter(Boolean);

    const renderEpisode = ({ item, index }: {
        item: Episode;
        index: number;
    }) => (
        <Pressable
            onPress={() => {
                router.push({
                    pathname: '/player/[id]',
                    params: {
                        id: movieId,
                        episodeIndex: String(index),
                        episodeList: JSON.stringify(episodes),
                        playSources: JSON.stringify(playSources),
                        sourceIndex: String(selectedLine),
                        siteKey,
                        flag: currentSource?.name ?? '',
                        movieTitle: detail?.vod_name || '未知影片',
                        posterUrl: detail?.vod_pic || '',
                    },
                });
            }}
            style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
            })}
        >
            <View style={styles.episodeItem}>
                <Text style={styles.episodeText}>{item.title}</Text>
            </View>
        </Pressable>
    );

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={[
                    styles.floatingButton,
                    { top: insets.top + 10, left: 20, zIndex: 10 },
                ]}
                onPress={() => router.back()}
            >
                <View style={styles.iconText}>
                    <ChevronLeftIcon size={20} color="#FFF" />
                </View>
            </TouchableOpacity>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>正在获取影片详情...</Text>
                </View>
            ) : error ? (
                <View style={styles.center}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.backButtonText}>返回影片列表</Text>
                    </Pressable>
                </View>
            ) : detail ? (
                <Animated.ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                        { useNativeDriver: true }
                    )}
                    scrollEventThrottle={16}
                >
                    <Animated.View
                        style={{
                            width: '100%',
                            height: HEADER_HEIGHT,
                            transform: [{ scale }, { translateY }],
                        }}
                    >
                        <Image
                            source={
                                detail.vod_pic
                                    ? { uri: detail.vod_pic }
                                    : undefined
                            }
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={300}
                        />

                        <LinearGradient
                            colors={[
                                'transparent',
                                'rgba(30, 26, 29, 0.9)',
                                '#1e1a1d',
                            ]}
                            style={styles.gradient}
                        />
                    </Animated.View>

                    <View style={styles.contentContainer}>
                        <Text style={styles.title}>
                            {detail.vod_name || '未知影片'}
                        </Text>

                        <Text style={styles.metaText}>
                            {[year, area, category]
                                .filter(Boolean)
                                .join('  |  ') || '暂无影片信息'}
                        </Text>

                        {!!remarks && (
                            <Text style={styles.subMetaText}>
                                {remarks}
                            </Text>
                        )}

                        <Text style={styles.description}>
                            {description || '暂无影片简介'}
                        </Text>

                        {/* 播放线路 */}
                        <View style={styles.sourceSection}>
                            <Text style={styles.sectionTitle}>播放源</Text>

                            {playSources.length > 0 ? (
                                <FlatList
                                    data={playSources}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item, index }) => (
                                        <Pressable
                                            onPress={() => setSelectedLine(index)}
                                            style={[
                                                styles.sourceItem,
                                                selectedLine === index &&
                                                styles.selectedSource,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.sourceText,
                                                    selectedLine === index &&
                                                    styles.selectedSourceText,
                                                ]}
                                            >
                                                {item.name}
                                            </Text>
                                        </Pressable>
                                    )}
                                />
                            ) : (
                                <Text style={styles.emptyText}>
                                    当前影片暂无可用播放线路
                                </Text>
                            )}
                        </View>

                        {resumeRecord && resumeSource && resumeSource.episodes.length > 0 && (
                            <Pressable
                                style={styles.resumeButton}
                                onPress={handleResume}
                            >
                                <Text style={styles.resumeButtonText}>
                                    继续上次播放 · {resumeRecord.episodeTitle || '上次观看位置'}
                                </Text>
                            </Pressable>
                        )}

                        {/* 剧集列表 */}
                        <View style={styles.episodeSection}>
                            <Text style={styles.sectionTitle}>
                                选集
                                {episodes.length > 0
                                    ? `（${episodes.length}集）`
                                    : ''}
                            </Text>

                            {episodes.length > 0 ? (
                                <FlatList
                                    data={episodes}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    keyExtractor={item => item.id}
                                    contentContainerStyle={{
                                        paddingHorizontal: 5,
                                        gap: 10,
                                    }}
                                    renderItem={renderEpisode}
                                />
                            ) : (
                                <Text style={styles.emptyText}>
                                    当前线路没有可播放的剧集
                                </Text>
                            )}
                        </View>

                        {/* 演职人员 */}
                        {(director || actors.length > 0) && (
                            <View>
                                <Text style={styles.sectionTitle}>
                                    演职人员
                                </Text>

                                {!!director && (
                                    <Text style={styles.peopleText}>
                                        导演：{director}
                                    </Text>
                                )}

                                {!!actor && (
                                    <Text style={styles.peopleText}>
                                        主演：{actor}
                                    </Text>
                                )}
                            </View>
                        )}

                        <View style={{ height: 80 }} />
                    </View>
                </Animated.ScrollView>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1e1a1d',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 25,
    },
    loadingText: {
        color: '#aaa',
        fontSize: 13,
        marginTop: 12,
    },
    errorText: {
        color: '#fff',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 24,
    },
    backButton: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 20,
    },
    backButtonText: {
        color: '#222',
        fontWeight: '600',
    },
    gradient: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: 200,
    },
    floatingButton: {
        position: 'absolute',
        backgroundColor: 'rgba(0,0,0,0.4)',
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: -4,
    },
    contentContainer: {
        paddingHorizontal: 20,
        marginTop: -40,
        backgroundColor: '#1e1a1d',
    },
    title: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    metaText: {
        color: '#eee',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 5,
    },
    subMetaText: {
        color: '#aaa',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 15,
    },
    description: {
        color: '#ccc',
        fontSize: 14,
        lineHeight: 22,
        marginTop: 10,
    },
    sourceSection: {
        width: '100%',
        marginTop: 25,
    },
    resumeButton: {
        height: 48,
        marginTop: 18,
        borderRadius: 10,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    resumeButtonText: {
        color: '#222',
        fontSize: 15,
        fontWeight: 'bold',
    },
    episodeSection: {
        width: '100%',
        marginTop: 25,
        marginBottom: 10,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    sourceItem: {
        minWidth: 100,
        height: 42,
        paddingHorizontal: 15,
        borderRadius: 9,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    selectedSource: {
        backgroundColor: '#fff',
    },
    sourceText: {
        color: '#ddd',
        fontSize: 13,
    },
    selectedSourceText: {
        color: '#222',
        fontWeight: 'bold',
    },
    episodeItem: {
        width: 150,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        paddingHorizontal: 5,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    episodeText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    emptyText: {
        color: '#999',
        fontSize: 13,
        paddingVertical: 10,
    },
    peopleText: {
        color: '#ccc',
        fontSize: 13,
        lineHeight: 24,
    },
});




