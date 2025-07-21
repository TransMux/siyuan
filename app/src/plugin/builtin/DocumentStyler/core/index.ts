/**
 * 核心模块导出
 * 统一导出所有核心组件和控制器
 */

// 核心控制器
export { CrossReferenceController, type ICrossReferenceConfig } from './CrossReferenceController';

// 数据层
export * from './data';

// 业务逻辑层
export * from './business';

// 表现层
export * from './presentation';

// 状态管理层
export * from './state';

// 事件处理层
export * from './events';

// UI交互层
export * from './ui';
