let counter = 0;

/**
 * 產生節點 id。前綴是為了在除錯時一眼看出是什麼東西。
 * 用遞增計數而非隨機值，測試才能得到可預期的結果。
 */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}`;
}

/** 測試用：把計數歸零，讓每個測項的 id 從頭開始。 */
export function resetIds(): void {
  counter = 0;
}
