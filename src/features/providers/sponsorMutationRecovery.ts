/**
 * 表示赞助账号写入操作已经失败，但界面仍尝试过刷新数据以恢复一致性。
 *
 * 单独包装这个错误的目的，是让调用方能够区分普通请求失败和“部分变更后失败”：
 * 后者可能已经在服务端写入了一部分状态，因此界面不应继续沿用本地旧数据。
 */
export class SponsorPartialMutationError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause ?? 'Sponsor mutation failed'));
    this.name = 'SponsorPartialMutationError';
    this.cause = cause;
  }
}

/** 判断错误是否来自需要刷新界面状态的赞助账号写入操作。 */
export const isSponsorPartialMutationError = (
  error: unknown
): error is SponsorPartialMutationError => error instanceof SponsorPartialMutationError;

/**
 * 执行赞助账号写入操作；若操作失败，则尽力重新拉取服务端状态。
 *
 * 刷新失败不会覆盖原始写入错误，因为原始错误更能说明本次操作为何失败；
 * 调用方收到包装后的错误后，可以统一提示用户重新确认当前账号状态。
 */
export async function runSponsorMutationWithRecovery<T>(
  action: () => Promise<T>,
  refresh: () => Promise<unknown>
): Promise<T> {
  try {
    return await action();
  } catch (error: unknown) {
    try {
      await refresh();
    } catch {
      // 刷新只是尽力恢复界面状态，不能让刷新异常掩盖真正的写入失败原因。
    }
    throw new SponsorPartialMutationError(error);
  }
}
