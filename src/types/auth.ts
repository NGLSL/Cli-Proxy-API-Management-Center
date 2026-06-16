/**
 * 认证相关类型定义
 * 基于原项目 src/modules/login.js 和 src/core/connection.js
 */

// 登录凭据
export interface LoginCredentials {
  apiBase: string;
  managementKey: string;
  rememberPassword?: boolean;
}

// 认证状态
export interface AuthState {
  isAuthenticated: boolean;
  apiBase: string;
  managementKey: string;
  rememberPassword: boolean;
  serverVersion: string | null;
  serverBuildDate: string | null;
  /**
   * 后端是否支持 /plugins 接口（v7 引入）。
   * 通过连接成功后探测一次 GET /plugins 来判定，用于：
   *  - 侧边栏是否显示 "插件"/"插件商店" 入口
   *  - 路由层是否注册 /plugins、/plugin-store、/plugin-pages/*
   */
  supportsPlugin: boolean;
}

// 连接状态
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface ConnectionInfo {
  status: ConnectionStatus;
  lastCheck: Date | null;
  error: string | null;
}
