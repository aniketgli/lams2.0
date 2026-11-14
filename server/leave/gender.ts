/** The employee's gender as 'male' / 'female' / 'other', whether the profile holds "Male", "M", "female", "F"… */
export function genderKey(gender: string): 'male' | 'female' | 'other' {
  const g = gender.trim().toLowerCase();
  if (g === 'f' || g === 'female' || g === 'woman') return 'female';
  if (g === 'm' || g === 'male' || g === 'man') return 'male';
  return 'other';
}
