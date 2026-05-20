import * as vscode from 'vscode';

/**
 * 모든 언어 정렬기가 구현해야 할 공통 인터페이스
 *
 * 향후 새 언어(예: Python, Kotlin) 지원 시 이 인터페이스를 구현하면 됩니다.
 *
 * @author 윤명준 (MJ Yun)
 */
export interface ISorter {
    /**
     * 현재 문서의 멤버를 정렬하는 TextEdit 목록을 반환한다.
     * @returns 정렬 변경 사항 목록. 이미 정렬된 경우 빈 배열.
     */
    sort(): Promise<vscode.TextEdit[]> | vscode.TextEdit[];
}
