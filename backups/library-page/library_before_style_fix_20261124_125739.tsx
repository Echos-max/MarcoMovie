import {
    View,
    FlatList,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Modal,
} from "react-native";
import { SearchIcon } from "panelui-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { GlassView } from "expo-glass-effect";
import { useFocusEffect, useRouter } from "expo-router";
import {
    marcoApi,
    type SpiderCategory,
    type SpiderParentCategory,
    type SpiderVideo,
    type SubscriptionSite,
} from "../../services/marcoApi";
import React from "react";

const PAGE_SIZE = 20;

type SelectableSite = SubscriptionSite;

type SpiderFilterValue = { n?: string; v?: string };
type SpiderFilterGroup = {
    key: string;
    name: string;
    value: SpiderFilterValue[];
};

type MovieItem = {
    id: string;
    name: string;
    pic: string;
    remarks: string;
};

const mapSpiderVideos = (items: SpiderVideo[] | undefined): MovieItem[] => {
    const seen = new Set<string>();

    return (items ?? []).map((item: SpiderVideo) => ({
        id: String(item.vod_id ?? ""),
        name: String(item.vod_name ?? "未知影片"),
        pic: String(item.vod_pic ?? ""),
        remarks: String(item.vod_remarks ?? ""),
    })).filter(item => {
        if (!item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
};

function getSpiderFilters(result: Record<string, unknown>, categoryId: string): SpiderFilterGroup[] {
    const raw = result.filters ?? result.filter;
    if (Array.isArray(raw)) return raw as SpiderFilterGroup[];
    if (!raw || typeof raw !== "object") return [];
    const record = raw as Record<string, unknown>;
    const scoped = record[categoryId];
    if (Array.isArray(scoped)) return scoped as SpiderFilterGroup[];
    return Object.values(record).filter(value => value && typeof value === "object" && Array.isArray((value as SpiderFilterGroup).value)) as SpiderFilterGroup[];
}

export default function MovieScreen() {
    const router = useRouter();

    const [sites, setSites] = useState<SelectableSite[]>([]);
    const [activeSite, setActiveSite] = useState<SelectableSite | null>(null);
    const [sitePickerVisible, setSitePickerVisible] = useState(false);
    const [loadingTabs, setLoadingTabs] = useState(true);
    const [loadingMovies, setLoadingMovies] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const loadingMoreRef = useRef(false);
    const requestVersionRef = useRef(0);
    const [error, setError] = useState("");

    const [parentTabs, setParentTabs] = useState<SpiderCategory[]>([]);
    const [activeParent, setActiveParent] = useState("");
    const [filterGroups, setFilterGroups] = useState<SpiderFilterGroup[]>([]);
    const [activeExtend, setActiveExtend] = useState<Record<string, unknown>>({});
    const extendKey = useMemo(() => JSON.stringify(activeExtend), [activeExtend]);

    const [movies, setMovies] = useState<MovieItem[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageCount, setPageCount] = useState(1);
    const [total, setTotal] = useState(0);

    // 从已启用订阅的归属目录读取站点。订阅管理页面仍然只展示站点数量。
    useFocusEffect(useCallback(() => {
        let cancelled = false;
        const loadSites = async () => {
            try {
                setLoadingTabs(true);
                setError("");
                const siteResult = await marcoApi.getSubscriptionSites();
                if (cancelled) return;
                const nextSites = (siteResult.sites ?? []).filter(site => site.key && site.siteKey);
                setSites(nextSites);
                setActiveSite(current =>
                    nextSites.find(site =>
                        site.subscriptionId === current?.subscriptionId &&
                        site.siteKey === current?.siteKey
                    ) ?? nextSites[0] ?? null
                );
                if (nextSites.length === 0) {
                    setError("当前没有可用的已启用订阅站点，请先在订阅管理中添加并启用订阅。");
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "获取订阅站点失败");
                }
            } finally {
                if (!cancelled) setLoadingTabs(false);
            }
        };
        loadSites();
        return () => { cancelled = true; };
    }, []));

    // 切换站点后，只读取当前站点自己的一级分类。
    useEffect(() => {
        if (!activeSite) {
            setParentTabs([]);
            setActiveParent("");
            return;
        }
        let cancelled = false;
        const loadHome = async () => {
            try {
                setLoadingTabs(true);
                setError("");
                setParentTabs([]);
                setActiveParent("");
                setFilterGroups([]);
                setActiveExtend({});
                setMovies([]);
                const home = await marcoApi.getSpiderHome(activeSite.siteKey, true);
                if (cancelled) return;

                let categories: SpiderCategory[] = [];
                if (Array.isArray(home.parentClass) && home.parentClass.length > 0) {
                    categories = home.parentClass.map((item: SpiderParentCategory) => ({
                        type_id: String(item.type_id),
                        type_name: String(item.type_name),
                    }));
                } else {
                    const raw = home.class ?? [];
                    const roots = raw.filter(item => !item.type_id_1 || item.type_id_1 === "0");
                    categories = (roots.length > 0 ? roots : raw).map(item => ({
                        type_id: String(item.type_id),
                        type_name: String(item.type_name),
                    }));
                }
                setParentTabs([{ type_id: "", type_name: "全部" }, ...categories]);
                setActiveParent("");
                if (categories.length === 0) {
                    setError("当前站点没有返回可用的一级分类。");
                }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "获取站点分类失败");
            } finally {
                if (!cancelled) setLoadingTabs(false);
            }
        };
        loadHome();
        return () => { cancelled = true; };
    }, [activeSite?.subscriptionId, activeSite?.siteKey]);

    // 当前分类、筛选条件变化时，只请求所选站点的影视数据。
    useEffect(() => {
        const requestId = ++requestVersionRef.current;
        loadingMoreRef.current = false;
        setLoadingMore(false);

        if (!activeSite) return;
        let cancelled = false;
        const loadMovies = async () => {
            try {
                setLoadingMovies(true);
                setError("");
                setMovies([]);
                setCurrentPage(1);
                setPageCount(1);
                setTotal(0);
                const result = await marcoApi.getSpiderCategory(
                    activeSite.siteKey,
                    activeParent,
                    1,
                    true,
                    activeExtend,
                );
                if (cancelled) return;
                const nextFilters = getSpiderFilters(result as Record<string, unknown>, activeParent);
                if (Object.keys(activeExtend).length === 0 || filterGroups.length === 0) {
                    setFilterGroups(nextFilters);
                }
                setMovies(mapSpiderVideos(result.list));
                setCurrentPage(Number(result.page ?? 1));
                setPageCount(Math.max(1, Number(result.pagecount ?? 1)));
                setTotal(Number(result.total ?? 0));
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "获取站点影视列表失败");
            } finally {
                if (!cancelled) setLoadingMovies(false);
            }
        };
        loadMovies();
        return () => { cancelled = true; };
    }, [activeSite?.subscriptionId, activeSite?.siteKey, activeParent, extendKey]);

    const handleSitePress = (site: SelectableSite) => {
        setSitePickerVisible(false);
        if (site.siteKey !== activeSite?.siteKey || site.subscriptionId !== activeSite?.subscriptionId) {
            setActiveSite(site);
        }
    };

    const handleFilterPress = (key: string, value: string) => {
        setActiveExtend(previous => {
            const next = { ...previous };
            if (!value) delete next[key];
            else next[key] = value;
            return next;
        });
    };

    const handleParentPress = (categoryId: string) => {
        if (categoryId === activeParent) return;
        setActiveParent(categoryId);
        setActiveExtend({});
        setFilterGroups([]);
    };

    const handleLoadMore = async () => {
        if (!activeSite || loadingMoreRef.current || loadingMore || loadingMovies || currentPage >= pageCount) return;

        const requestId = requestVersionRef.current;
        const site = activeSite;
        const categoryId = activeParent;
        const extend = activeExtend;
        const nextPage = currentPage + 1;

        loadingMoreRef.current = true;
        setLoadingMore(true);

        try {
            setError("");

            const result = await marcoApi.getSpiderCategory(
                site.siteKey,
                categoryId,
                nextPage,
                true,
                extend,
            );

            if (requestId !== requestVersionRef.current) return;

            const newMovies = mapSpiderVideos(result.list);

            setMovies(previous => {
                const existing = new Set(previous.map(item => item.id));
                return [...previous, ...newMovies.filter(item => !existing.has(item.id))];
            });

            setCurrentPage(Number(result.page ?? nextPage));
            setPageCount(Math.max(1, Number(result.pagecount ?? pageCount)));
            setTotal(Number(result.total ?? total));
        } catch (err) {
            if (requestId === requestVersionRef.current) {
                setError(err instanceof Error ? err.message : "加载更多影视失败");
            }
        } finally {
            if (requestId === requestVersionRef.current) {
                loadingMoreRef.current = false;
                setLoadingMore(false);
            }
        }
    };

    const handleMoviePress = (movie: MovieItem) => {
        if (!activeSite) return;
        router.push({
            pathname: "/detail/[id]",
            params: { id: movie.id, siteKey: activeSite.siteKey },
        });
    };

    if (loadingTabs && !activeSite) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.fullScreenLoading}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>正在加载订阅站点...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <GlassView style={styles.headerLeft}>
                    <TouchableOpacity
                        style={styles.siteSelector}
                        activeOpacity={0.75}
                        onPress={() => setSitePickerVisible(true)}
                        disabled={sites.length === 0}
                    >
                        <Text style={styles.logoIcon}>🎬</Text>
                        <View style={styles.siteIdentityText}>
                            <Text style={styles.logoText} numberOfLines={1}>
                                {activeSite?.name ?? "选择片源"}
                            </Text>
                            <Text style={styles.siteSubtitle} numberOfLines={1}>
                                {activeSite?.subscriptionName ?? "点击选择订阅中的片源"}
                            </Text>
                        </View>
                        <Text style={styles.siteSelectorArrow}>⌄</Text>
                    </TouchableOpacity>
                </GlassView>

                <GlassView style={styles.headerRight}>
                    <TouchableOpacity
                        style={styles.iconBtn}
                        activeOpacity={0.7}
                        onPress={() => router.push({ pathname: "/search/[id]", params: { id: "search" } })}
                    >
                        <SearchIcon size={21} />
                    </TouchableOpacity>
                </GlassView>
            </View>
            {/* 片源选择：按订阅分组 */}
            <Modal
                visible={sitePickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setSitePickerVisible(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setSitePickerVisible(false)}
                    style={styles.modalOverlay}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => undefined}
                        style={styles.modalCard}
                    >
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>选择片源</Text>
                                <Text style={styles.modalSubtitle}>选择要浏览的影视站点</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.modalClose}
                                onPress={() => setSitePickerVisible(false)}
                            >
                                <Text style={styles.modalCloseText}>关闭</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {Array.from(new Set(sites.map(site => site.subscriptionId))).map(subscriptionId => {
                                const groupSites = sites.filter(site => site.subscriptionId === subscriptionId);
                                const groupName = groupSites[0]?.subscriptionName ?? "订阅";

                                return (
                                    <View key={subscriptionId} style={styles.modalGroup}>
                                        <Text style={styles.modalGroupTitle}>{groupName}</Text>
                                        {groupSites.map(site => {
                                            const selected =
                                                site.siteKey === activeSite?.siteKey &&
                                                site.subscriptionId === activeSite?.subscriptionId;

                                            return (
                                                <TouchableOpacity
                                                    key={`${site.subscriptionId}:${site.key}`}
                                                    activeOpacity={0.7}
                                                    onPress={() => handleSitePress(site)}
                                                    style={[
                                                        styles.modalSiteItem,
                                                        selected && styles.modalSiteItemActive,
                                                    ]}
                                                >
                                                    <Text
                                                        numberOfLines={1}
                                                        style={[
                                                            styles.modalSiteName,
                                                            selected && styles.modalSiteNameActive,
                                                        ]}
                                                    >
                                                        {site.name}
                                                    </Text>
                                                    {selected && (
                                                        <Text style={styles.modalCheck}>✓</Text>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* 当前站点的一级分类 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
                {parentTabs.map(category => {
                    const active = activeParent === String(category.type_id);
                    return (
                        <TouchableOpacity key={String(category.type_id)} style={[styles.tabItem, active && styles.tabItemActive]} onPress={() => handleParentPress(String(category.type_id))}>
                            <Text style={[styles.tabText, active && styles.tabTextActive]}>{category.type_name}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* 当前站点、当前一级分类返回的筛选条件 */}
            <View style={styles.filterContainer}>
                {filterGroups.map(group => (
                    <View key={group.key} style={styles.filterRow}>
                        <Text style={styles.filterLabel}>{group.name}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {[{ n: "全部", v: "" }, ...(group.value ?? [])].map(option => {
                                const value = String(option.v ?? "");
                                const label = String(option.n ?? value);
                                const active = String(activeExtend[group.key] ?? "") === value;
                                return (
                                    <TouchableOpacity
                                        key={`${group.key}:${value}:${label}`}
                                        onPress={() => handleFilterPress(group.key, value)}
                                        style={[styles.filterOption, active && styles.filterOptionActive]}
                                    >
                                        <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>{label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                ))}
            </View>

            <FlatList
                style={styles.listScroll}
                contentContainerStyle={styles.listContent}
                data={movies}
                numColumns={3}
                keyExtractor={(item) => `${activeSite?.subscriptionId ?? ""}:${activeSite?.siteKey ?? ""}:${item.id}`}
                showsVerticalScrollIndicator={false}
                initialNumToRender={12}
                maxToRenderPerBatch={12}
                windowSize={7}
                ListHeaderComponent={
                    <>
                        <View style={styles.categoryInfo}>
                            <Text style={styles.categoryTitle}>
                                {parentTabs.find(item => String(item.type_id) === activeParent)?.type_name ?? "全部"}
                            </Text>
                            <Text style={styles.categoryCount}>共 {total} 部</Text>
                        </View>

                        {loadingMovies && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#007AFF" />
                                <Text style={styles.loadingText}>正在加载影视...</Text>
                            </View>
                        )}

                        {!!error && (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}
                    </>
                }
                renderItem={({ item }) => (
                    <View style={styles.movieItem}>
                        <TouchableOpacity activeOpacity={0.8} onPress={() => handleMoviePress(item)}>
                            {item.pic ? (
                                <Image
                                    source={{ uri: item.pic }}
                                    style={styles.moviePoster}
                                    contentFit="cover"
                                    transition={200}
                                />
                            ) : (
                                <View style={[styles.moviePoster, styles.posterPlaceholder]}>
                                    <Text style={styles.placeholderText}>暂无海报</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <Text style={styles.movieTitle} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.movieRemarks} numberOfLines={1}>
                            {item.remarks || "暂无更新信息"}
                        </Text>
                    </View>
                )}
                ListEmptyComponent={
                    !loadingMovies && !error ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>当前筛选条件下暂无影视数据</Text>
                        </View>
                    ) : undefined
                }
                ListFooterComponent={
                    movies.length > 0 ? (
                        <>
                            {!loadingMovies && currentPage < pageCount && (
                                <TouchableOpacity
                                    style={styles.loadMoreButton}
                                    onPress={handleLoadMore}
                                    disabled={loadingMore}
                                >
                                    {loadingMore
                                        ? <ActivityIndicator color="#007AFF" />
                                        : <Text style={styles.loadMoreText}>加载更多</Text>}
                                </TouchableOpacity>
                            )}
                            {!loadingMovies && currentPage >= pageCount && (
                                <Text style={styles.endText}>已经到底了</Text>
                            )}
                        </>
                    ) : undefined
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    siteSelector: {
        width: "100%",
        minHeight: 60,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
    },
    modalCard: {
        maxHeight: "78%",
        borderRadius: 22,
        padding: 20,
        backgroundColor: "#FFFFFF",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 18,
    },
    modalTitle: {
        color: "#171A21",
        fontSize: 19,
        fontWeight: "700",
    },
    modalSubtitle: {
        color: "#9298A3",
        fontSize: 12,
        marginTop: 4,
    },
    modalClose: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 14,
        backgroundColor: "#F1F3F6",
    },
    modalCloseText: {
        color: "#626B78",
        fontSize: 12,
        fontWeight: "600",
    },
    modalGroup: {
        marginBottom: 18,
    },
    modalGroupTitle: {
        color: "#9298A3",
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    modalSiteItem: {
        minHeight: 46,
        paddingHorizontal: 12,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    modalSiteItemActive: {
        backgroundColor: "#EEF4FF",
    },
    modalSiteName: {
        flex: 1,
        color: "#343A46",
        fontSize: 14,
    },
    modalSiteNameActive: {
        color: "#2563EB",
        fontWeight: "600",
    },
    modalCheck: {
        color: "#2563EB",
        fontSize: 16,
        fontWeight: "700",
        marginLeft: 8,
    },
    filterContainer: {
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 6,
    },
    filterRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 9,
    },
    filterLabel: {
        width: 48,
        color: "#8A909B",
        fontSize: 12,
        fontWeight: "600",
    },
    filterOption: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 7,
        borderRadius: 16,
        backgroundColor: "#F0F2F5",
    },
    filterOptionActive: {
        backgroundColor: "#252A34",
    },
    filterOptionText: {
        color: "#68707D",
        fontSize: 12,
    },
    filterOptionTextActive: {
        color: "#FFFFFF",
        fontWeight: "600",
    },    container: {
        flex: 1,
        backgroundColor: "#F7F8FA",
    },

    header: {
        width: "100%",
        minHeight: 76,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    headerLeft: {
        flex: 1,
        minWidth: 0,
        minHeight: 60,
        borderRadius: 18,
        overflow: "hidden",
    },

    headerRight: {
        width: 58,
        height: 60,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },

    logoContent: {
        width: "100%",
        height: "80%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },

    logoIcon: {
        fontSize: 22,
        marginRight: 11,
    },

    siteIdentityText: {
        flex: 1,
        minWidth: 0,
        justifyContent: "center",
    },
    siteSubtitle: {
        color: "#9298A3",
        fontSize: 11,
        marginTop: 3,
    },    logoText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#202631",
    },

    headerActions: {
        width: "100%",
        height: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },

    iconBtn: {
        width: 58,
        height: 60,
        alignItems: "center",
        justifyContent: "center",
    },

    tabScroll: {
        flexGrow: 0,
        marginTop: 4,
        marginBottom: 5,
    },

    tabContent: {
        paddingHorizontal: 14,
        alignItems: "center",
    },

    tabItem: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        marginRight: 7,
        borderRadius: 18,
        alignItems: "center",
        backgroundColor: "transparent",
    },

    tabText: {
        fontSize: 13,
        color: "#737B88",
        fontWeight: "500",
    },

    tabItemActive: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 13,
    },

    listScroll: {
        flex: 1,
    },

    listContent: {
        paddingBottom: 30,
    },

    categoryInfo: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    categoryTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#202631",
    },

    categoryCount: {
        fontSize: 12,
        color: "#9298A3",
    },

    movieGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        padding: 5,
    },

    movieItem: {
        width: "33.33%",
        paddingHorizontal: 6,
        paddingBottom: 15,
    },

    moviePoster: {
        width: "100%",
        aspectRatio: 2 / 3,
        borderRadius: 12,
        backgroundColor: "#E6E9EF",
    },

    posterPlaceholder: {
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#E9ECF1",
    },

    placeholderText: {
        color: "#9298A3",
        fontSize: 12,
    },

    movieTitle: {
        fontSize: 13,
        marginTop: 8,
        fontWeight: "600",
        color: "#252B36",
    },

    movieRemarks: {
        fontSize: 11,
        color: "#8B929E",
        marginTop: 4,
    },

    loadingContainer: {
        padding: 40,
        alignItems: "center",
    },

    loadingText: {
        marginTop: 10,
        color: "#999",
    },

    errorContainer: {
        padding: 20,
        alignItems: "center",
    },

    errorText: {
        color: "#ff4d4f",
        textAlign: "center",
    },

    emptyContainer: {
        padding: 40,
        alignItems: "center",
    },

    emptyText: {
        color: "#999",
    },

    loadMoreButton: {
        marginHorizontal: 20,
        marginTop: 15,
        marginBottom: 20,
        paddingVertical: 14,
        borderRadius: 10,
        backgroundColor: "rgba(0,122,255,0.1)",
        alignItems: "center",
    },

    loadMoreText: {
        color: "#007AFF",
        fontSize: 14,
        fontWeight: "600",
    },

    endText: {
        textAlign: "center",
        color: "#999",
        fontSize: 12,
        paddingVertical: 20,
    },

    fullScreenLoading: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
});
