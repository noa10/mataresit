interface BatchQueueWheelCaptureParams {
  uploadCount: number;
  scrollContainer: HTMLElement | null;
  currentTarget: EventTarget | null;
  target: EventTarget | null;
}

export const shouldCaptureBatchQueueWheel = ({
  uploadCount,
  scrollContainer,
  currentTarget,
  target,
}: BatchQueueWheelCaptureParams): boolean => {
  if (uploadCount <= 0) return false;
  if (!scrollContainer) return false;
  if (scrollContainer.scrollHeight <= scrollContainer.clientHeight) return false;
  if (!(currentTarget instanceof Node)) return false;
  if (!(target instanceof Node)) return false;

  // Ignore wheel events from portaled UI (dialogs/popovers) outside the batch container.
  return currentTarget.contains(target);
};
