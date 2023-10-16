export const EDIT_TASK_TEXT_AREA_MIN_HEIGHT = 22;

export const adjustTextAreaHeight = (target: HTMLTextAreaElement) => {
  const parent = target.parentElement;
  const textAreaHeight = target.scrollHeight;
  if (textAreaHeight > EDIT_TASK_TEXT_AREA_MIN_HEIGHT && parent) {
    parent.style.maxHeight = `${textAreaHeight}px`;
    target.style.height = `${textAreaHeight}px`;
    target.style.marginTop = '-1px';
  }
};
