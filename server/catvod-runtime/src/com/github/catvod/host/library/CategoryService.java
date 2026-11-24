
package com.github.catvod.host.library;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 影视分类服务。
 *
 * 支持：
 * 1. TvBox parentClass 一级分类
 * 2. TvBox class 二级分类
 * 3. class 内部存在多层父子关系
 * 4. 父级 ID 不存在时保留分类
 * 5. 将影片原始分类映射为统一分类
 */
public class CategoryService {

    public static class Category {

        public String id = "";
        public String name = "";
        public String parentId = "";

        public String sourceKey = "";
        public String siteKey = "";

        public List<Category> children = new ArrayList<>();
    }

    public static class CategoryTree {

        public String sourceKey = "";
        public String sourceName = "";
        public String siteKey = "";

        public List<Category> categories = new ArrayList<>();
    }

    /**
     * 解析 Spider 的 homeContent。
     */
    public CategoryTree parse(
            String homeJson,
            String sourceKey,
            String sourceName,
            String siteKey
    ) {
        CategoryTree tree = new CategoryTree();

        tree.sourceKey = safe(sourceKey);
        tree.sourceName = safe(sourceName);
        tree.siteKey = safe(siteKey);

        if (homeJson == null || homeJson.trim().isEmpty()) {
            return tree;
        }

        JsonElement root;

        try {
            root = JsonParser.parseString(homeJson.trim());
        } catch (Exception e) {
            throw new IllegalArgumentException("分类数据不是合法 JSON", e);
        }

        if (!root.isJsonObject()) {
            return tree;
        }

        JsonObject object = root.getAsJsonObject();

        Map<String, Category> nodes = new LinkedHashMap<>();

        // 1. 优先解析 parentClass：明确的一级分类
        addCategories(
                object.get("parentClass"),
                nodes,
                tree,
                true
        );

        // 2. 解析 class：普通分类及其父子关系
        addCategories(
                object.get("class"),
                nodes,
                tree,
                false
        );

        // 3. 根据 parentId 建立分类树
        for (Category category : nodes.values()) {
            category.children.clear();
        }

        for (Category category : nodes.values()) {

            if (category.parentId.isEmpty()
                    || category.parentId.equals("0")
                    || category.parentId.equals(category.id)) {
                tree.categories.add(category);
                continue;
            }

            Category parent = nodes.get(category.parentId);

            if (parent != null && parent != category) {
                parent.children.add(category);
            } else {
                // 父级分类不存在时，保留该分类作为根节点。
                // 不伪造父分类，也不丢失原始 parentId。
                tree.categories.add(category);
            }
        }

        return tree;
    }

    /**
     * 读取一个分类数组。
     */
    private void addCategories(
            JsonElement element,
            Map<String, Category> nodes,
            CategoryTree tree,
            boolean parentClass
    ) {
        if (element == null || !element.isJsonArray()) {
            return;
        }

        JsonArray array = element.getAsJsonArray();

        for (JsonElement itemElement : array) {

            if (!itemElement.isJsonObject()) {
                continue;
            }

            JsonObject item = itemElement.getAsJsonObject();

            String id = first(item, "type_id", "id");
            String name = first(item, "type_name", "name");

            if (id.isEmpty() || name.isEmpty()) {
                continue;
            }

            String parentId = parentClass
                    ? ""
                    : first(item, "type_id_1", "parent_id", "pid");

            Category category = nodes.get(id);

            if (category == null) {
                category = new Category();
                category.id = id;
                nodes.put(id, category);
            }

            category.name = name;
            category.parentId = parentId;
            category.sourceKey = tree.sourceKey;
            category.siteKey = tree.siteKey;
        }
    }

    /**
     * 根据影片原始分类信息映射统一分类。
     */
    public void mapVideo(Video video, CategoryTree tree) {

        if (video == null || tree == null) {
            return;
        }

        Category category = find(tree, video.sourceCategoryId);

        if (category == null) {
            return;
        }

        // 从当前分类向上查找真正的根分类。
        Category root = category;
        Category parent = find(tree, root.parentId);

        int depth = 0;

        while (parent != null && depth < 20) {
            root = parent;
            parent = find(tree, root.parentId);
            depth++;
        }

        video.category1 = root.name;

        if (category == root) {
            video.category2 = "";
        } else {
            video.category2 = category.name;
        }
    }

    /**
     * 递归查找分类节点。
     */
    public Category find(
            CategoryTree tree,
            String id
    ) {
        if (tree == null || id == null || id.trim().isEmpty()) {
            return null;
        }

        for (Category category : tree.categories) {
            Category result = findRecursive(category, id.trim());

            if (result != null) {
                return result;
            }
        }

        return null;
    }

    private Category findRecursive(
            Category category,
            String id
    ) {
        if (category == null) {
            return null;
        }

        if (id.equals(category.id)) {
            return category;
        }

        for (Category child : category.children) {
            Category result = findRecursive(child, id);

            if (result != null) {
                return result;
            }
        }

        return null;
    }

    /**
     * 获取分类树 JSON。
     */
    public JsonArray toJson(CategoryTree tree) {

        JsonArray array = new JsonArray();

        if (tree == null) {
            return array;
        }

        for (Category category : tree.categories) {
            array.add(toJson(category));
        }

        return array;
    }

    private JsonObject toJson(Category category) {

        JsonObject object = new JsonObject();

        object.addProperty("id", category.id);
        object.addProperty("name", category.name);
        object.addProperty("parentId", category.parentId);

        object.addProperty("sourceKey", category.sourceKey);
        object.addProperty("siteKey", category.siteKey);

        JsonArray children = new JsonArray();

        for (Category child : category.children) {
            children.add(toJson(child));
        }

        object.add("children", children);

        return object;
    }

    private String first(
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
            }
        }

        return "";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
