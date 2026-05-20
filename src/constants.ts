/**
 * mj-code-sorter 확장에서 공통으로 사용하는 상수 정의
 *
 * @author 윤명준 (MJ Yun)
 */

/**
 * 정렬 기능이 지원되는 언어 ID 목록
 *
 * 주의: package.json의 activationEvents, contributes.menus와 동기화해야 합니다.
 */
export const SUPPORTED_LANGUAGE_IDS = ['java', 'javascript', 'javascriptreact', 'typescript', 'typescriptreact'] as const;

/** 지원 언어 ID 타입 */
export type SupportedLanguageId = (typeof SUPPORTED_LANGUAGE_IDS)[number];

/**
 * 주어진 언어 ID가 지원 언어인지 확인한다
 * @param languageId - VS Code 언어 ID
 */
export function isSupportedLanguage(languageId: string): languageId is SupportedLanguageId {
    return (SUPPORTED_LANGUAGE_IDS as readonly string[]).includes(languageId);
}
