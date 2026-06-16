/**
 * 插件相关类型定义（v7 引入）
 * 与后端 /plugins、/plugin-store 接口字段一一对应
 */

// 单个配置字段的值类型；后端可能扩展类型，使用 string 兜底
export type PluginConfigFieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'enum'
  | 'array'
  | 'object';

// 后端返回的配置字段描述（name/type/enum_values/description）
export interface PluginConfigField {
  name: string;
  type: PluginConfigFieldType | string;
  enumValues: string[];
  description: string;
}

// 插件实例配置对象：字段名 -> 任意值（具体形状由 configFields 决定）
export type PluginConfigObject = Record<string, unknown>;

// 插件元信息（来源于 plugin.json 之类的清单文件）
export interface PluginMetadata {
  name: string;
  version: string;
  author: string;
  githubRepository: string;
  logo: string;
  configFields: PluginConfigField[];
}

// 插件暴露的菜单/页面挂载点（path 是后端服务路径，menu 是侧边栏标题）
export interface PluginMenu {
  path: string;
  menu: string;
  description: string;
}

// /plugins 列表中单个插件条目
export interface PluginListEntry {
  id: string;
  path: string;
  configured: boolean;
  registered: boolean;
  enabled: boolean;
  // 当全局 plugins.enabled=true 且 enabled=true 时才为 true（后端计算）
  effectiveEnabled: boolean;
  supportsOAuth: boolean;
  logo: string;
  configFields: PluginConfigField[];
  menus: PluginMenu[];
  metadata: PluginMetadata | null;
}

// /plugins 顶层响应
export interface PluginListResponse {
  pluginsEnabled: boolean;
  pluginsDir: string;
  plugins: PluginListEntry[];
}

// DELETE /plugins/:id 的返回结果，描述删除影响与是否需要重启
export interface PluginDeleteResult {
  status: string;
  id: string;
  path: string;
  fileDeleted: boolean;
  configuredRemoved: boolean;
  restartRequired: boolean;
}

// 商店条目：把多个 source 聚合后的统一描述
export interface PluginStoreEntry {
  storeId: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  repository: string;
  logo: string;
  homepage: string;
  license: string;
  tags: string[];
  installed: boolean;
  installedVersion: string;
  path: string;
  configured: boolean;
  registered: boolean;
  enabled: boolean;
  effectiveEnabled: boolean;
  updateAvailable: boolean;
}

// 单个商店源（registry URL）
export interface PluginStoreSource {
  id: string;
  name: string;
  url: string;
}

// /plugin-store 顶层响应
export interface PluginStoreResponse {
  pluginsEnabled: boolean;
  pluginsDir: string;
  sources: PluginStoreSource[];
  plugins: PluginStoreEntry[];
}

// POST /plugin-store/:id/install 的返回结果
export interface PluginStoreInstallResult {
  status: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  id: string;
  version: string;
  path: string;
  pluginsEnabled: boolean;
  restartRequired: boolean;
}
