import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Modal,
} from "react-native";
import { SearchIcon, SendArrowIcon } from "panelui-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useMemo, useState } from "react";
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
    }, [activeSite?.siteKey]);

    // 当前分类、筛选条件变化时，只请求所选站点的影视数据。
    useEffect(() => {
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
                setMovies((result.list ?? []).map((item: SpiderVideo) => ({
                    id: String(item.vod_id ?? ""),
                    name: String(item.vod_name ?? "未知影片"),
                    pic: String(item.vod_pic ?? ""),
                    remarks: String(item.vod_remarks ?? ""),
                })).filter(item => item.id));
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
    }, [activeSite?.siteKey, activeParent, extendKey]);

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
        if (!activeSite || loadingMore || loadingMovies || currentPage >= pageCount) return;
        try {
            setLoadingMore(true);
            setError("");
            const nextPage = currentPage + 1;
            const result = await marcoApi.getSpiderCategory(
                activeSite.siteKey,
                activeParent,
                nextPage,
                true,
                activeExtend,
            );
            const newMovies = (result.list ?? []).map((item: SpiderVideo) => ({
                id: String(item.vod_id ?? ""),
                name: String(item.vod_name ?? "未知影片"),
                pic: String(item.vod_pic ?? ""),
                remarks: String(item.vod_remarks ?? ""),
            })).filter(item => item.id);
            setMovies(previous => {
                const existing = new Set(previous.map(item => item.id));
                return [...previous, ...newMovies.filter(item => !existing.has(item.id))];
            });
            setCurrentPage(Number(result.page ?? nextPage));
            setPageCount(Math.max(1, Number(result.pagecount ?? pageCount)));
            setTotal(Number(result.total ?? total));
        } catch (err) {
            setError(err instanceof Error ? err.message : "加载更多影视失败");
        } finally {
            setLoadingMore(false);
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
                        <Text style={styles.logoIcon}>🤖</Text>
                        <Text style={styles.logoText} numberOfLines={1}>
                            {Array.from(new Set(sites.map(site => site.subscriptionName))).join("、") || activeSite?.subscriptionName || "选择订阅"}
                        </Text>
                        <Text style={styles.siteSelectorArrow}>⌄</Text>
                    </TouchableOpacity>
                </GlassView>

                <GlassView style={styles.headerRight}>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.iconBtn}>
                            <SendArrowIcon size={20} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={() => router.push({ pathname: "/search/[id]", params: { id: "search" } })}
                        >
                            <SearchIcon size={20} />
                        </TouchableOpacity>
                    </View>
                </GlassView>
            </View>

            {/* 站点选择弹窗：按订阅分组展示站点，订阅管理页不展示站点明细。 */}
            <Modal
                visible={sitePickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setSitePickerVisible(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setSitePickerVisible(false)}
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.48)", justifyContent: "center", padding: 24 }}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => undefined}
                        style={{ maxHeight: "78%", borderRadius: 18, padding: 18, backgroundColor: "#fff" }}
                    >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <Text style={{ color: "#171717", fontSize: 17, fontWeight: "700" }}>选择片源</Text>
                            <TouchableOpacity onPress={() => setSitePickerVisible(false)}>
                                <Text style={{ color: "#777", fontSize: 14 }}>关闭</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {Array.from(new Set(sites.map(site => site.subscriptionId))).map(subscriptionId => {
                                const groupSites = sites.filter(site => site.subscriptionId === subscriptionId);
                                const groupName = groupSites[0]?.subscriptionName ?? "订阅";
                                return (
                                    <View key={subscriptionId} style={{ marginBottom: 12 }}>
                                        <Text style={{ color: "#888", fontSize: 12, marginBottom: 6 }}>{groupName}</Text>
                                        {groupSites.map(site => {
                                            const selected = site.siteKey === activeSite?.siteKey && site.subscriptionId === activeSite?.subscriptionId;
                                            return (
                                                <TouchableOpacity
                                                    key={`${site.subscriptionId}:${site.key}`}
                                                    onPress={() => handleSitePress(site)}
                                                    style={{ minHeight: 44, paddingHorizontal: 10, borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: selected ? "#EAF2FF" : "transparent" }}
                                                >
                                                    <Text numberOfLines={1} style={{ flex: 1, color: selected ? "#1677FF" : "#222", fontSize: 14, fontWeight: selected ? "600" : "400" }}>{site.name}</Text>
                                                    {selected && <Text style={{ color: "#1677FF", marginLeft: 8 }}>✓</Text>}
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
                        <TouchableOpacity key={String(category.type_id)} style={styles.tabItem} onPress={() => handleParentPress(String(category.type_id))}>
                            <Text style={[styles.tabText, active && styles.tabTextActive]}>{category.type_name}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* 当前站点、当前一级分类返回的筛选条件 */}
            <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 }}>
                {filterGroups.map(group => (
                    <View key={group.key} style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}>
                        <Text style={{ width: 48, fontSize: 12, color: "#888" }}>{group.name}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {[{ n: "全部", v: "" }, ...(group.value ?? [])].map(option => {
                                const value = String(option.v ?? "");
                                const label = String(option.n ?? value);
                                const active = String(activeExtend[group.key] ?? "") === value;
                                return (
                                    <TouchableOpacity
                                        key={`${group.key}:${value}:${label}`}
                                        onPress={() => handleFilterPress(group.key, value)}
                                        style={{ paddingHorizontal: 10, paddingVertical: 5, marginRight: 7, borderRadius: 14, backgroundColor: active ? "#222" : "rgba(128,128,128,0.12)" }}
                                    >
                                        <Text style={{ fontSize: 12, color: active ? "#fff" : "#777" }}>{label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                ))}
            </View>

            <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                {(
                    <View style={styles.categoryInfo}>
                        <Text style={styles.categoryTitle}>{parentTabs.find(item => String(item.type_id) === activeParent)?.type_name ?? "全部"}</Text>
                        <Text style={styles.categoryCount}>共 {total} 部</Text>
                    </View>
                )}

                {loadingMovies && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={styles.loadingText}>正在加载影视...</Text>
                    </View>
                )}

                {!!error && <View style={styles.errorContainer}><Text style={styles.errorText}>{error}</Text></View>}

                {!loadingMovies && movies.length > 0 && (
                    <View style={styles.movieGrid}>
                        {movies.map(movie => (
                            <View key={`${activeSite?.siteKey}:${movie.id}`} style={styles.movieItem}>
                                <TouchableOpacity activeOpacity={0.8} onPress={() => handleMoviePress(movie)}>
                                    {movie.pic ? (
                                        <Image source={{ uri: movie.pic }} style={styles.moviePoster} contentFit="cover" transition={200} />
                                    ) : (
                                        <View style={[styles.moviePoster, styles.posterPlaceholder]}><Text style={styles.placeholderText}>暂无海报</Text></View>
                                    )}
                                </TouchableOpacity>
                                <Text style={styles.movieTitle} numberOfLines={1}>{movie.name}</Text>
                                <Text style={styles.movieRemarks} numberOfLines={1}>{movie.remarks || "暂无更新信息"}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {!loadingMovies && !error && movies.length === 0 && (
                    <View style={styles.emptyContainer}><Text style={styles.emptyText}>当前筛选条件下暂无影视数据</Text></View>
                )}

                {!loadingMovies && movies.length > 0 && currentPage < pageCount && (
                    <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore} disabled={loadingMore}>
                        {loadingMore ? <ActivityIndicator color="#007AFF" /> : <Text style={styles.loadMoreText}>加载更多</Text>}
                    </TouchableOpacity>
                )}
                {movies.length > 0 && currentPage >= pageCount && <Text style={styles.endText}>已经到底了</Text>}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    siteSelector: { width: "100%", height: "100%", paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "center" },
    siteSelectorArrow: { marginLeft: 5, fontSize: 15, color: "#777" },
    container: {
        flex: 1,
    },

    header: {
        width: "100%",
        height: "10%",
        padding: "2%",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },

    headerLeft: {
        width: "30%",
        height: "100%",
        borderRadius: 15,
    },

    headerRight: {
        width: "30%",
        height: "100%",
        borderRadius: 15,
    },

    logoContent: {
        width: "100%",
        height: "80%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },

    logoIcon: {
        fontSize: 18,
        marginRight: 15,
    },

    logoText: {
        fontSize: 16,
        fontWeight: "bold",
    },

    headerActions: {
        width: "100%",
        height: "80%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },

    iconBtn: {
        marginLeft: 15,
    },

    tabScroll: {
        flexGrow: 0,
        paddingVertical: 1,
    },

    tabContent: {
        paddingHorizontal: 10,
    },

    tabItem: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        alignItems: "center",
    },

    tabText: {
        fontSize: 15,
        color: "#666",
        marginBottom: 4,
    },

    tabTextActive: {
        color: "#000",
        fontWeight: "bold",
        fontSize: 20,
    },

    listScroll: {
        flex: 1,
    },

    listContent: {
        paddingBottom: 30,
    },

    categoryInfo: {
        paddingHorizontal: 15,
        paddingTop: 15,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    categoryTitle: {
        fontSize: 17,
        fontWeight: "bold",
    },

    categoryCount: {
        fontSize: 12,
        color: "#999",
    },

    movieGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        padding: 5,
    },

    movieItem: {
        width: "33.33%",
        padding: 5,
    },

    moviePoster: {
        width: "100%",
        aspectRatio: 2 / 3,
        borderRadius: 8,
        backgroundColor: "#333",
    },

    posterPlaceholder: {
        justifyContent: "center",
        alignItems: "center",
    },

    placeholderText: {
        color: "#aaa",
        fontSize: 12,
    },

    movieTitle: {
        fontSize: 13,
        marginTop: 6,
        fontWeight: "500",
    },

    movieRemarks: {
        fontSize: 12,
        color: "#ff9500",
        marginTop: 3,
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
