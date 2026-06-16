/**
 * 全局滚动锁（v7 引入，Sheet 组件使用）
 *
 * 与本地 Modal 内部维护的 scrollLock 逻辑等价，但抽出来作为单独模块：
 *  - 同时锁定 body 与 .content 容器的滚动位置
 *  - 通过计数器支持多个 Sheet/抽屉叠加
 *  - 解锁时恢复滚动位置，避免页面跳动
 *
 * 注意：本模块与 Modal.tsx 内部的私有 scrollLock 是两份独立计数器，
 * 互不影响。这样可以让 Sheet 不引入对 Modal 的修改。
 */

const MODAL_LOCK_CLASS = 'modal-open';

let activeLockCount = 0;

const snapshot = {
  scrollY: 0,
  contentScrollTop: 0,
  contentEl: null as HTMLElement | null,
  bodyPosition: '',
  bodyTop: '',
  bodyLeft: '',
  bodyRight: '',
  bodyWidth: '',
  bodyOverflow: '',
  htmlOverflow: '',
};

const resolveContentScrollContainer = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  const contentEl = document.querySelector('.content');
  return contentEl instanceof HTMLElement ? contentEl : null;
};

export function lockScroll(): void {
  if (typeof document === 'undefined') return;
  if (activeLockCount === 0) {
    const body = document.body;
    const html = document.documentElement;
    const contentEl = resolveContentScrollContainer();

    snapshot.scrollY = window.scrollY || window.pageYOffset || html.scrollTop || 0;
    snapshot.contentEl = contentEl;
    snapshot.contentScrollTop = contentEl?.scrollTop ?? 0;
    snapshot.bodyPosition = body.style.position;
    snapshot.bodyTop = body.style.top;
    snapshot.bodyLeft = body.style.left;
    snapshot.bodyRight = body.style.right;
    snapshot.bodyWidth = body.style.width;
    snapshot.bodyOverflow = body.style.overflow;
    snapshot.htmlOverflow = html.style.overflow;

    body.classList.add(MODAL_LOCK_CLASS);
    html.classList.add(MODAL_LOCK_CLASS);

    body.style.position = 'fixed';
    body.style.top = `-${snapshot.scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
  }
  activeLockCount += 1;
}

export function unlockScroll(): void {
  if (typeof document === 'undefined') return;
  activeLockCount = Math.max(0, activeLockCount - 1);
  if (activeLockCount === 0) {
    const body = document.body;
    const html = document.documentElement;
    const scrollY = snapshot.scrollY;
    const contentScrollTop = snapshot.contentScrollTop;
    const contentEl = snapshot.contentEl;

    body.classList.remove(MODAL_LOCK_CLASS);
    html.classList.remove(MODAL_LOCK_CLASS);

    body.style.position = snapshot.bodyPosition;
    body.style.top = snapshot.bodyTop;
    body.style.left = snapshot.bodyLeft;
    body.style.right = snapshot.bodyRight;
    body.style.width = snapshot.bodyWidth;
    body.style.overflow = snapshot.bodyOverflow;
    html.style.overflow = snapshot.htmlOverflow;

    if (contentEl) {
      contentEl.scrollTo({ top: contentScrollTop, left: 0, behavior: 'auto' });
    }
    window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });

    snapshot.scrollY = 0;
    snapshot.contentScrollTop = 0;
    snapshot.contentEl = null;
  }
}

// 焦点陷井用：可聚焦元素选择器
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
