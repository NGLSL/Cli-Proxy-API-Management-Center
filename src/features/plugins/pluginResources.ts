/**
 * 插件资源公共工具（v7 引入）
 *
 * 这里集中处理与"插件资源"（plugin menus / 侧边栏入口）相关的纯函数与全局事件，
 * 让 PluginsPage、PluginStorePage、PluginResourcePage、MainLayout 共享同一份逻辑：
 *  - 资源刷新事件总线（用于安装/启用/删除后通知侧边栏重建）
 *  - 资产 URL（logo/iframe path）拼接 apiBase
 *  - 路由构造（/plugin-pages/:pluginId/:menuIndex）
 *  - "可信源"判定：仅 router-for-me org 下的仓库视为官方，其它一律视为三方
 *  - 安装确认 token：从 repository slug 推导，让用户重输以防误装
 */
import type { PluginListEntry, PluginMenu, PluginStoreEntry } from '@/types';
import { normalizeApiBase } from '@/utils/connection';

// 全局事件名：插件列表变更时派发，MainLayout/PluginResourcePage 监听后重渲染
export const PLUGIN_RESOURCES_REFRESH_EVENT = 'plugin-resources-refresh';

// 通知所有监听者（主要是 MainLayout 侧边栏）重建插件资源条目
export const notifyPluginResourcesChanged = () => {
  window.dispatchEvent(new Event(PLUGIN_RESOURCES_REFRESH_EVENT));
};

// 单个资源条目：一个插件菜单对应一个侧边栏入口
export interface PluginResourceEntry {
  pluginID: string;
  pluginTitle: string;
  pluginLogo: string;
  menuIndex: number;
  menu: PluginMenu;
  label: string;
  description: string;
  route: string;
}

// 优先用 metadata.name（人类可读），缺省回退到 plugin id
export const getPluginTitle = (plugin: PluginListEntry) =>
  plugin.metadata?.name.trim() || plugin.id;

// 构造资源页路由：menuIndex 用于区分同一插件的多个菜单
export const buildPluginResourceRoute = (pluginID: string, menuIndex: number) =>
  `/plugin-pages/${encodeURIComponent(pluginID)}/${menuIndex}`;

// 把后端返回的相对路径（/plugins/xxx/logo）拼成完整 URL
// 已是绝对地址/data:/blob: 时直接返回
export const resolvePluginAssetURL = (value: string, apiBase: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  if (!trimmed.startsWith('/')) return trimmed;
  const base = normalizeApiBase(apiBase);
  return base ? `${base}${trimmed}` : trimmed;
};

// Registry 通常给 "owner/repo"，这里转成完整 https URL
export const buildRepositoryURL = (repository: string) => {
  const trimmed = repository.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://github.com/${trimmed.replace(/^\/+/, '')}`;
};

// 官方 org 前缀（完整匹配，防止 look-alike 域名绕过）
export const OFFICIAL_PLUGIN_REPO_PREFIX = 'https://github.com/router-for-me/';
export const DEFAULT_PLUGIN_STORE_SOURCE_ID = 'official';
const DEFAULT_PLUGIN_STORE_SOURCE_NAME = 'official';

// 把 "owner/repo" 或 https URL 规整为 "owner/repo"
export const getPluginRepositorySlug = (repository: string): string => {
  const trimmed = repository.trim();
  if (!trimmed) return '';
  const withoutHost = /^https?:\/\/[^/]+\/(.+)$/i.exec(trimmed)?.[1] ?? trimmed;
  const [owner = '', repo = ''] = withoutHost.replace(/^\/+/, '').split('/');
  if (!owner) return '';
  return repo ? `${owner}/${repo.replace(/\.git$/i, '')}` : owner;
};

// 仅当规整后的 URL 严格落在 router-for-me org 下才算官方
export const isOfficialRepository = (repository: string): boolean =>
  buildRepositoryURL(repository)
    .toLowerCase()
    .startsWith(OFFICIAL_PLUGIN_REPO_PREFIX);

// 插件视为官方 iff 代码仓库在 router-for-me org 下
export const isOfficialPlugin = (entry: PluginStoreEntry): boolean =>
  isOfficialRepository(entry.repository);

// 是否是默认（内置）插件源；用于安装确认弹窗决定展示文案
export const isDefaultPluginStoreSource = (
  entry: Pick<PluginStoreEntry, 'sourceId' | 'sourceName'>
): boolean =>
  entry.sourceId.trim().toLowerCase() === DEFAULT_PLUGIN_STORE_SOURCE_ID ||
  entry.sourceName.trim().toLowerCase() === DEFAULT_PLUGIN_STORE_SOURCE_NAME;

// 安装确认 token：优先用 repo slug（更直观），缺省用插件 id
export const getPluginConfirmToken = (entry: PluginStoreEntry): string =>
  getPluginRepositorySlug(entry.repository) || entry.id;

// 把所有 effective=true 的插件的菜单展开成扁平的侧边栏条目列表
export const collectPluginResourceEntries = (
  plugins: PluginListEntry[]
): PluginResourceEntry[] =>
  plugins.flatMap((plugin) => {
    if (!plugin.effectiveEnabled) return [];

    const pluginTitle = getPluginTitle(plugin);
    const pluginLogo = plugin.logo || plugin.metadata?.logo || '';

    return plugin.menus
      .map((menu, menuIndex): PluginResourceEntry | null => {
        const path = menu.path.trim();
        if (!path) return null;

        const menuLabel = menu.menu.trim();
        return {
          pluginID: plugin.id,
          pluginTitle,
          pluginLogo,
          menuIndex,
          menu: { ...menu, path },
          label: menuLabel || pluginTitle,
          description: menu.description.trim() || pluginTitle,
          route: buildPluginResourceRoute(plugin.id, menuIndex),
        };
      })
      .filter((entry): entry is PluginResourceEntry => Boolean(entry));
  });
