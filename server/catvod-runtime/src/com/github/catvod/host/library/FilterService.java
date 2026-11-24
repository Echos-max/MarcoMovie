
package com.github.catvod.host.library;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 影视库筛选服务。
 *
 * 支持：
 * 1. 一级分类
 * 2. 二级分类
 * 3. 类型
 * 4. 地区
 * 5. 时间（年份）
 *
 * 筛选逻辑独立于具体影视源。
 */
public class FilterService {

    /**
     * 筛选选项。
     */
    public static class FilterOptions {

        public List<String> category1 = new ArrayList<>();

        public List<String> category2 = new ArrayList<>();

        public List<String> types = new ArrayList<>();

        public List<String> areas = new ArrayList<>();

        public List<String> years = new ArrayList<>();
    }

    /**
     * 根据影片列表生成筛选选项。
     */
    public FilterOptions buildOptions(List<Video> videos) {

        FilterOptions options = new FilterOptions();

        if (videos == null || videos.isEmpty()) {
            return options;
        }

        Set<String> category1 = new LinkedHashSet<>();
        Set<String> category2 = new LinkedHashSet<>();
        Set<String> types = new LinkedHashSet<>();
        Set<String> areas = new LinkedHashSet<>();
        Set<String> years = new LinkedHashSet<>();

        for (Video video : videos) {

            if (video == null) {
                continue;
            }

            add(category1, video.category1);
            add(category2, video.category2);

            addValues(types, video.type);
            addValues(areas, video.area);
            addValues(years, video.year);
        }

        options.category1.addAll(category1);
        options.category2.addAll(category2);
        options.types.addAll(types);
        options.areas.addAll(areas);
        options.years.addAll(years);

        // 年份按数字倒序排列，无法识别的年份放在后面
        options.years.sort((a, b) -> {
            Integer yearA = parseYear(a);
            Integer yearB = parseYear(b);

            if (yearA != null && yearB != null) {
                return yearB.compareTo(yearA);
            }

            if (yearA != null) {
                return -1;
            }

            if (yearB != null) {
                return 1;
            }

            return a.compareTo(b);
        });

        return options;
    }

    /**
     * 根据筛选条件过滤影片。
     *
     * 参数传空字符串或 null 表示不限制该条件。
     */
    public List<Video> filter(
            List<Video> videos,
            String category1,
            String category2,
            String type,
            String area,
            String year
    ) {
        List<Video> result = new ArrayList<>();

        if (videos == null || videos.isEmpty()) {
            return result;
        }

        for (Video video : videos) {

            if (video == null) {
                continue;
            }

            if (!matches(video.category1, category1)) {
                continue;
            }

            if (!matches(video.category2, category2)) {
                continue;
            }

            if (!matchesMulti(video.type, type)) {
                continue;
            }

            if (!matchesMulti(video.area, area)) {
                continue;
            }

            if (!matches(video.year, year)) {
                continue;
            }

            result.add(video);
        }

        return result;
    }

    /**
     * 单值精确匹配。
     */
    private boolean matches(String actual, String expected) {

        if (isEmpty(expected)) {
            return true;
        }

        return normalize(actual).equals(normalize(expected));
    }

    /**
     * 多值字段匹配。
     *
     * 例如：
     * 影片类型：动作,悬疑,犯罪
     * 筛选类型：悬疑
     *
     * 可以命中。
     */
    private boolean matchesMulti(String actual, String expected) {

        if (isEmpty(expected)) {
            return true;
        }

        if (isEmpty(actual)) {
            return false;
        }

        String target = normalize(expected);

        for (String value : splitValues(actual)) {

            if (normalize(value).equals(target)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 将多个类型、地区或标签拆分。
     */
    private List<String> splitValues(String value) {

        List<String> result = new ArrayList<>();

        if (isEmpty(value)) {
            return result;
        }

        String[] values = value.split("[,，/、|;；]");

        for (String item : values) {
            add(result, item);
        }

        return result;
    }

    /**
     * 收集多值字段中的筛选选项。
     */
    private void addValues(Set<String> target, String value) {

        for (String item : splitValues(value)) {
            target.add(item);
        }
    }

    /**
     * 添加非空选项。
     */
    private void add(Collection<String> target, String value) {

        if (isEmpty(value)) {
            return;
        }

        String item = value.trim();

        if (!item.isEmpty()) {
            target.add(item);
        }
    }

    /**
     * 统一字符串格式。
     */
    private String normalize(String value) {

        if (value == null) {
            return "";
        }

        return value.trim()
                .toLowerCase(Locale.ROOT);
    }

    private boolean isEmpty(String value) {
        return value == null || value.trim().isEmpty();
    }

    /**
     * 提取年份数字。
     */
    private Integer parseYear(String value) {

        if (value == null) {
            return null;
        }

        String text = value.trim();

        if (!text.matches("\\d{4}")) {
            return null;
        }

        try {
            return Integer.parseInt(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
