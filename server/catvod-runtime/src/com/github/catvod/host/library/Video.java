
package com.github.catvod.host.library;

import com.google.gson.JsonObject;

/**
 * 影视库统一影片模型。
 *
 * 不依赖具体 Spider 类型，统一承载不同影视源的影片数据。
 */
public class Video {

    // -------------------- 影片基本信息 --------------------

    /** 影片 ID */
    public String id = "";

    /** 影片名称 */
    public String name = "";

    /** 封面地址 */
    public String pic = "";

    /** 更新状态 */
    public String remarks = "";

    // -------------------- 统一分类 --------------------

    /** 统一一级分类 */
    public String category1 = "";

    /** 统一二级分类 */
    public String category2 = "";

    // -------------------- 原始分类信息 --------------------

    /** 来源原始二级分类 ID */
    public String sourceCategoryId = "";

    /** 来源原始一级分类 ID */
    public String sourceParentCategoryId = "";

    /** 来源原始分类名称 */
    public String sourceCategoryName = "";

    // -------------------- 筛选信息 --------------------

    /** 影片类型，例如动作、喜剧、悬疑 */
    public String type = "";

    /** 地区 */
    public String area = "";

    /** 年份 */
    public String year = "";

    // -------------------- 来源信息 --------------------

    /** 源池来源标识 */
    public String sourceKey = "";

    /** 来源名称 */
    public String sourceName = "";

    /** Spider 站点标识 */
    public String siteKey = "";

    // -------------------- 原始数据 --------------------

    /** 保留原始影片 JSON，方便后续详情和扩展字段处理 */
    public JsonObject raw = new JsonObject();
}
