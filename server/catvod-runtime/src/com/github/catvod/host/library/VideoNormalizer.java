
package com.github.catvod.host.library;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.util.ArrayList;
import java.util.List;

/**
 * 影视数据标准化器。
 *
 * 将 CMS、JSON、TvBox Spider 返回的影片 JSON
 * 转换为统一 Video 模型。
 */
public final class VideoNormalizer {

    private VideoNormalizer() {
    }

    /**
     * 标准化影片列表。
     *
     * 支持：
     * 1. 直接返回 JSON 数组
     * 2. {"list": [...]}
     * 3. {"data": [...]}
     * 4. {"result": [...]}
     * 5. {"videos": [...]}
     * 6. 上述字段嵌套 JSON 对象的情况
     */
    public static List<Video> normalizeList(
            String json,
            String sourceKey,
            String sourceName,
            String siteKey
    ) {
        List<Video> result = new ArrayList<>();

        if (json == null || json.trim().isEmpty()) {
            return result;
        }

        JsonElement root;

        try {
            root = JsonParser.parseString(json.trim());
        } catch (Exception e) {
            throw new IllegalArgumentException(
                    "影片数据不是合法 JSON",
                    e
            );
        }

        JsonArray array = findArray(root);

        if (array == null) {
            return result;
        }

        for (JsonElement element : array) {
            if (element == null || !element.isJsonObject()) {
                continue;
            }

            Video video = normalize(
                    element.getAsJsonObject(),
                    sourceKey,
                    sourceName,
                    siteKey
            );

            if (video != null) {
                result.add(video);
            }
        }

        return result;
    }

    /**
     * 标准化单条影片。
     */
    public static Video normalize(
            JsonObject source,
            String sourceKey,
            String sourceName,
            String siteKey
    ) {
        if (source == null) {
            return null;
        }

        Video video = new Video();

        // 影片基本信息
        video.id = first(source,
                "vod_id",
                "id",
                "ids"
        );

        video.name = first(source,
                "vod_name",
                "name",
                "title"
        );

        video.pic = first(source,
                "vod_pic",
                "pic",
                "cover",
                "img"
        );

        video.remarks = first(source,
                "vod_remarks",
                "remarks",
                "note",
                "vod_time"
        );

        // 来源分类信息
        video.sourceCategoryId = first(source,
                "type_id",
                "category_id"
        );

        video.sourceParentCategoryId = first(source,
                "type_id_1",
                "parent_type_id"
        );

        video.sourceCategoryName = first(source,
                "type_name",
                "category_name"
        );

        // 统一筛选字段
        // 不使用 type_name 作为影片类型，避免与站点分类混淆
        video.type = first(source,
                "vod_class",
                "genre",
                "genres",
                "tags"
        );

        video.area = first(source,
                "vod_area",
                "area",
                "region"
        );

        video.year = first(source,
                "vod_year",
                "year"
        );

        // 来源标识
        video.sourceKey = safe(sourceKey);
        video.sourceName = safe(sourceName);
        video.siteKey = safe(siteKey);

        // 分类映射交给 CategoryService 处理
        video.category1 = "";
        video.category2 = "";

        // 保留完整原始数据
        video.raw = source.deepCopy();

        // 没有影片名称的数据不进入影视库
        if (video.name.isEmpty()) {
            return null;
        }

        return video;
    }

    /**
     * 从不同 JSON 结构中提取影片数组。
     */
    private static JsonArray findArray(JsonElement root) {

        if (root == null || root.isJsonNull()) {
            return null;
        }

        if (root.isJsonArray()) {
            return root.getAsJsonArray();
        }

        if (!root.isJsonObject()) {
            return null;
        }

        JsonObject object = root.getAsJsonObject();

        String[] keys = {
                "list",
                "data",
                "result",
                "videos"
        };

        for (String key : keys) {

            JsonElement value = object.get(key);

            if (value == null || value.isJsonNull()) {
                continue;
            }

            if (value.isJsonArray()) {
                return value.getAsJsonArray();
            }

            if (value.isJsonObject()) {
                JsonArray nested = findArray(value);

                if (nested != null) {
                    return nested;
                }
            }
        }

        return null;
    }

    /**
     * 读取第一个非空字段。
     */
    private static String first(
            JsonObject object,
            String... keys
    ) {
        for (String key : keys) {

            JsonElement value = object.get(key);

            if (value == null || value.isJsonNull()) {
                continue;
            }

            try {
                String text = value.getAsString();

                if (text != null && !text.trim().isEmpty()) {
                    return text.trim();
                }

            } catch (Exception ignored) {
                // 非字符串类型暂不参与普通字段映射
            }
        }

        return "";
    }

    /**
     * 安全处理来源字段。
     */
    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
