export function firstAvailable(values, x) {
  if (values) {
    for (const v of values) {
      if (v) {
        return v;
      }
    }
  }
  return x;
}
