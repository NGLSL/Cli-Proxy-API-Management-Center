/**
 * 插件相关 API（v7 引入）
 *
 * 对应后端两类接口：
 *  - /plugins：本地已发现/已注册的插件实例（启用、配置、删除）
 *  - /plugin-store：聚合多个 registry 源的插件市场（列表、安装）
 *
 * 由于后端返回的是 unknown，本文件集中做字段标准化（trim、类型规整），
 * 让上层组件只消费强类型数据，避免散落的 typeof/Array.isArray 检查。
 */

import { apiClient } from './client';
import { isRecord } from '@/utils/helpers';
import type {
  PluginConfigField,
  PluginConfigObject,
  PluginDeleteResult,
  PluginListEntry,
  PluginListResponse,
  PluginMetadata,
  PluginMenu,
  PluginStoreEntry,
  PluginStoreInstallResult,
  PluginStoreResponse,
  PluginStoreSource,
} from '@/types';

// ───────── 基础小工具 ─────────

const asString = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  return String(value);
};

const asBoolean = (value: unknown): boolean => value === true;

// ───────── 字段级标准化 ─────────

// 单个配置字段描述：要求 name 非空，否则视为非法条目返回 null
const normalizeConfigField = (value: unknown): PluginConfigField | null => {
  if (!isRecord(value)) return null;
  const name = asString(value.name).trim();
  if (!name) return null;
  const enumValues = Array.isArray(value.enum_values)
    ? value.enum_values.map((item) => asString(item)).filter(Boolean)
    : [];
  return {
    name,
    type: asString(value.type).trim() || 'string',
    enumValues,
    description: asString(value.description).trim(),
  };
};

const normalizeConfigFields = (value: unknown): PluginConfigField[] =>
  Array.isArray(value)
    ? value.map((item) => normalizeConfigField(item)).filter(Boolean) as PluginConfigField[]
    : [];

// 插件元数据：若所有字段都缺失则返回 null（视为无 metadata）
const normalizeMetadata = (value: unknown): PluginMetadata | null => {
  if (!isRecord(value)) return null;
  const name = asString(value.name).trim();
  const version = asString(value.version).trim();
  const author = asString(value.author).trim();
  const githubRepository = asString(value.github_repository).trim();
  const logo = asString(value.logo).trim();
  const configFields = normalizeConfigFields(value.config_fields);

  if (!name && !version && !author && !githubRepository && !logo && configFields.length === 0) {
    return null;
  }

  return {
    name,
    version,
    author,
    githubRepository,
    logo,
    configFields,
  };
};

const normalizeMenu = (value: unknown): PluginMenu | null => {
  if (!isRecord(value)) return null;
  const path = asString(value.path).trim();
  const menu = asString(value.menu).trim();
  if (!path && !menu) return null;
  return {
    path,
    menu,
    description: asString(value.description).trim(),
  };
};

const normalizeMenus = (value: unknown): PluginMenu[] =>
  Array.isArray(value)
    ? value.map((item) => normalizeMenu(item)).filter(Boolean) as PluginMenu[]
    : [];

// ───────── 顶层响应标准化 ─────────

const normalizePluginEntry = (value: unknown): PluginListEntry | null => {
  if (!isRecord(value)) return null;
  const id = asString(value.id).trim();
  if (!id) return null;

  const metadata = normalizeMetadata(value.metadata);
  const configFields = normalizeConfigFields(value.config_fields);

  return {
    id,
    path: asString(value.path).trim(),
    configured: asBoolean(value.configured),
    registered: asBoolean(value.registered),
    // 后端缺省视为 true（与官方默认行为一致）
    enabled: value.enabled !== false,
    effectiveEnabled: asBoolean(value.effective_enabled),
    supportsOAuth: asBoolean(value.supports_oauth),
    // logo 字段优先取顶层，缺省回退到 metadata.logo
    logo: asString(value.logo || metadata?.logo).trim(),
    configFields: configFields.length > 0 ? configFields : metadata?.configFields ?? [],
    menus: normalizeMenus(value.menus),
    metadata,
  };
};

const normalizePluginList = (value: unknown): PluginListResponse => {
  const source = isRecord(value) ? value : {};
  const plugins = Array.isArray(source.plugins)
    ? source.plugins.map((item) => normalizePluginEntry(item)).filter(Boolean) as PluginListEntry[]
    : [];

  return {
    pluginsEnabled: asBoolean(source.plugins_enabled),
    pluginsDir: asString(source.plugins_dir).trim() || 'plugins',
    plugins,
  };
};

const normalizePluginConfig = (value: unknown): PluginConfigObject =>
  isRecord(value) ? { ...value } : {};

const normalizeDeleteResult = (value: unknown): PluginDeleteResult => {
  const source = isRecord(value) ? value : {};
  return {
    status: asString(source.status).trim(),
    id: asString(source.id).trim(),
    path: asString(source.path).trim(),
    fileDeleted: asBoolean(source.file_deleted),
    configuredRemoved: asBoolean(source.configured_removed),
    restartRequired: asBoolean(source.restart_required),
  };
};

const normalizeStoreEntry = (value: unknown): PluginStoreEntry | null => {
  if (!isRecord(value)) return null;
  const id = asString(value.id).trim();
  if (!id) return null;
  const sourceId = asString(value.source_id).trim();
  // storeId 缺省时由 sourceId/id 组合而成，方便上层作为 React key
  const storeId = asString(value.store_id).trim() || (sourceId ? `${sourceId}/${id}` : id);

  const tags = Array.isArray(value.tags)
    ? value.tags.map((item) => asString(item).trim()).filter(Boolean)
    : [];

  return {
    storeId,
    sourceId,
    sourceName: asString(value.source_name).trim(),
    sourceUrl: asString(value.source_url).trim(),
    id,
    name: asString(value.name).trim(),
    description: asString(value.description).trim(),
    author: asString(value.author).trim(),
    version: asString(value.version).trim(),
    repository: asString(value.repository).trim(),
    logo: asString(value.logo).trim(),
    homepage: asString(value.homepage).trim(),
    license: asString(value.license).trim(),
    tags,
    installed: asBoolean(value.installed),
    installedVersion: asString(value.installed_version).trim(),
    path: asString(value.path).trim(),
    configured: asBoolean(value.configured),
    registered: asBoolean(value.registered),
    enabled: asBoolean(value.enabled),
    effectiveEnabled: asBoolean(value.effective_enabled),
    updateAvailable: asBoolean(value.update_available),
  };
};

const normalizeStoreSource = (value: unknown): PluginStoreSource | null => {
  if (!isRecord(value)) return null;
  const id = asString(value.id).trim();
  const url = asString(value.url).trim();
  if (!id && !url) return null;
  return {
    id,
    name: asString(value.name).trim(),
    url,
  };
};

const normalizeStoreList = (value: unknown): PluginStoreResponse => {
  const source = isRecord(value) ? value : {};
  const plugins = Array.isArray(source.plugins)
    ? source.plugins.map((item) => normalizeStoreEntry(item)).filter(Boolean) as PluginStoreEntry[]
    : [];
  const sources = Array.isArray(source.sources)
    ? source.sources.map((item) => normalizeStoreSource(item)).filter(Boolean) as PluginStoreSource[]
    : [];

  return {
    pluginsEnabled: asBoolean(source.plugins_enabled),
    pluginsDir: asString(source.plugins_dir).trim() || 'plugins',
    sources,
    plugins,
  };
};

const normalizeInstallResult = (value: unknown): PluginStoreInstallResult => {
  const source = isRecord(value) ? value : {};
  return {
    status: asString(source.status).trim(),
    sourceId: asString(source.source_id).trim(),
    sourceName: asString(source.source_name).trim(),
    sourceUrl: asString(source.source_url).trim(),
    id: asString(source.id).trim(),
    version: asString(source.version).trim(),
    path: asString(source.path).trim(),
    pluginsEnabled: asBoolean(source.plugins_enabled),
    restartRequired: asBoolean(source.restart_required),
  };
};

// ───────── 对外 API 对象 ─────────

export const pluginsApi = {
  // GET /plugins：列出本地所有插件实例及全局开关
  async list(): Promise<PluginListResponse> {
    const data = await apiClient.get('/plugins');
    return normalizePluginList(data);
  },

  // PATCH /plugins/:id/enabled：切换单个插件启用状态
  updateEnabled: (id: string, enabled: boolean) =>
    apiClient.patch(`/plugins/${encodeURIComponent(id)}/enabled`, { enabled }),

  // DELETE /plugins/:id：删除插件文件并清理 config
  async deletePlugin(id: string): Promise<PluginDeleteResult> {
    const data = await apiClient.delete(`/plugins/${encodeURIComponent(id)}`);
    return normalizeDeleteResult(data);
  },

  // GET /plugins/:id/config：读取当前实例配置
  async getConfig(id: string): Promise<PluginConfigObject> {
    const data = await apiClient.get(`/plugins/${encodeURIComponent(id)}/config`);
    return normalizePluginConfig(data);
  },

  // PUT /plugins/:id/config：整包覆盖配置
  putConfig: (id: string, config: PluginConfigObject) =>
    apiClient.put(`/plugins/${encodeURIComponent(id)}/config`, config),

  // PATCH /plugins/:id/config：局部合并配置
  patchConfig: (id: string, patch: PluginConfigObject) =>
    apiClient.patch(`/plugins/${encodeURIComponent(id)}/config`, patch),
};

export const pluginStoreApi = {
  // GET /plugin-store：聚合所有 registry 源返回的插件清单
  async list(): Promise<PluginStoreResponse> {
    const data = await apiClient.get('/plugin-store');
    return normalizeStoreList(data);
  },

  // POST /plugin-store/:id/install?source=<sourceId>：下载并安装到 plugins 目录
  async install(id: string, sourceId?: string): Promise<PluginStoreInstallResult> {
    const path = `/plugin-store/${encodeURIComponent(id)}/install`;
    const query = sourceId ? `?${new URLSearchParams({ source: sourceId }).toString()}` : '';
    const data = await apiClient.post(`${path}${query}`);
    return normalizeInstallResult(data);
  },
};
