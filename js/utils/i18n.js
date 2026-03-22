/**
 * Korean string constants (i18n)
 * All UI strings go here so they can be changed from one place.
 */

export const STATUS_LABELS = {
  present: '출석',
  absent:  '결석',
  late:    '지각',
  early:   '조퇴',
  none:    '미입력',
};

export const STATUS_COLORS = {
  present: 'var(--color-present)',
  absent:  'var(--color-absent)',
  late:    'var(--color-late)',
  early:   'var(--color-early)',
};

export const STATUS_LIST = ['present', 'absent', 'late', 'early'];

export const NAV_LABELS = {
  dashboard: '대시보드',
  groups:    '그룹',
  calendar:  '달력',
  statistics:'통계',
  settings:  '설정',
};

export const MESSAGES = {
  // Success
  groupCreated:    '그룹이 생성되었습니다.',
  groupUpdated:    '그룹이 수정되었습니다.',
  groupDeleted:    '그룹이 삭제되었습니다.',
  studentCreated:  '학생이 추가되었습니다.',
  studentUpdated:  '학생 정보가 수정되었습니다.',
  studentDeleted:  '학생이 삭제되었습니다.',
  attendanceSaved: '출석이 저장되었습니다.',
  exportDone:      '내보내기 완료',
  backupSaved:     '백업 파일이 저장되었습니다.',
  backupLoaded:    '백업을 불러왔습니다.',
  premiumActivated:'프리미엄이 활성화되었습니다! 🎉',

  // Errors
  loadFailed:      '데이터를 불러오는 데 실패했습니다.',
  saveFailed:      '저장에 실패했습니다.',
  nameRequired:    '이름을 입력해 주세요.',
  invalidFile:     '올바르지 않은 파일 형식입니다.',

  // Limits
  freeGroupLimit:   '무료 플랜은 그룹 1개까지 사용할 수 있습니다.\n프리미엄으로 업그레이드하면 무제한으로 사용할 수 있습니다.',
  freeStudentLimit: '무료 플랜은 그룹당 학생 20명까지 등록할 수 있습니다.\n프리미엄으로 업그레이드하면 무제한으로 사용할 수 있습니다.',
  premiumRequired:  '이 기능은 프리미엄 플랜에서만 사용할 수 있습니다.',

  // Confirms
  deleteGroupConfirm:   (name) => `"${name}" 그룹을 삭제하면 모든 학생과 출석 기록도 함께 삭제됩니다. 계속하시겠습니까?`,
  deleteStudentConfirm: (name) => `"${name}" 학생과 모든 출석 기록을 삭제하시겠습니까?`,
  clearAttendanceConfirm: '이 날의 출석 기록을 모두 초기화하시겠습니까?',

  // Empty states
  noGroups:      '그룹이 없습니다.\n새 그룹을 만들어 학생들을 관리해 보세요.',
  noStudents:    '학생이 없습니다.\n학생을 추가해 출석을 관리해 보세요.',
  noAttendance:  '출석 기록이 없습니다.',
  noStats:       '통계 데이터가 충분하지 않습니다.',
};

export const PLACEHOLDERS = {
  groupName:    '예: 3학년 2반, 피아노 교실',
  groupDesc:    '그룹에 대한 간단한 설명 (선택)',
  studentName:  '학생 이름',
  studentMemo:  '메모 (선택)',
};

export const GROUP_COLORS = [
  '#4F46E5', // indigo
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#84CC16', // lime
  '#F97316', // orange
  '#14B8A6', // teal
];

export const FREE_LIMITS = {
  groups:   1,
  students: 20,
};

export const PREMIUM_PRICE = '₩9,900';
