import * as vscode from 'vscode';
import { SortSourceActionProvider } from './providers/SortSourceActionProvider';
import { SUPPORTED_LANGUAGE_IDS, isSupportedLanguage } from './constants';
import { Logger } from './utils/logger';

/**
 * VS Code 확장 진입점
 *
 * @author 윤명준 (MJ Yun)
 */

/** 확장이 활성화될 때 호출됩니다 */
export function activate(context: vscode.ExtensionContext): void {
    // 로거 초기화 - View > Output > "MJ Code Sorter" 에서 로그 확인 가능
    const logger = Logger.initialize('MJ Code Sorter');
    context.subscriptions.push(logger.getDisposable());

    logger.info('mj-code-sorter 확장이 활성화되었습니다.');

    const sortActionProvider = new SortSourceActionProvider();

    // 지원 언어에 대해 Source Action Provider 등록
    const documentSelectors: vscode.DocumentSelector = SUPPORTED_LANGUAGE_IDS.map((language) => ({
        scheme: 'file',
        language,
    }));

    context.subscriptions.push(vscode.languages.registerCodeActionsProvider(documentSelectors, sortActionProvider, { providedCodeActionKinds: [vscode.CodeActionKind.Source] }));

    // 정렬 커맨드 등록
    context.subscriptions.push(
        vscode.commands.registerCommand('mjCodeSorter.sortMembers', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('활성화된 편집기를 찾을 수 없습니다.');
                return;
            }

            const { document } = editor;
            try {
                const sortedTextEdits = await sortActionProvider.getSortTextEdits(document);

                if (sortedTextEdits.length > 0) {
                    const workspaceEdit = new vscode.WorkspaceEdit();
                    workspaceEdit.set(document.uri, sortedTextEdits);

                    const success = await vscode.workspace.applyEdit(workspaceEdit);
                    if (success) {
                        vscode.window.showInformationMessage('정렬이 완료되었습니다.');
                        await runAutoFormatIfEnabled();
                    } else {
                        vscode.window.showErrorMessage('정렬 적용에 실패했습니다.');
                    }
                } else {
                    vscode.window.showInformationMessage('정렬할 멤버가 없거나 이미 정렬되어 있습니다.');
                }
            } catch (error) {
                logger.error('정렬 중 에러 발생', error);
                const errMsg = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`정렬 오류: ${errMsg} (자세한 내용은 Output > MJ Code Sorter 확인)`);
            }
        }),
    );

    // 저장 시 자동 정렬 이벤트 등록
    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument((event) => {
            const config = vscode.workspace.getConfiguration('mjCodeSorter');
            const sortOnSave = config.get<boolean>('sortOnSave', false);

            if (!sortOnSave) {
                return;
            }
            if (!isSupportedLanguage(event.document.languageId)) {
                return;
            }

            const editsPromise = sortActionProvider.getSortTextEdits(event.document).catch((err) => {
                logger.error('저장 시 자동 정렬 에러', err);
                return []; // 에러 시 빈 배열 반환하여 저장은 계속 진행
            });

            event.waitUntil(editsPromise);
        }),
    );
}

/** 확장이 비활성화될 때 호출됩니다 */
export function deactivate(): void {
    // Logger.getDisposable()이 context.subscriptions에 등록되어 있으므로
    // VS Code가 자동으로 dispose 합니다.
}

// ────────────────────────────────────────────
// 내부 헬퍼
// ────────────────────────────────────────────

/** autoFormat 설정이 활성화된 경우 문서 자동 포맷을 실행한다 */
async function runAutoFormatIfEnabled(): Promise<void> {
    const config = vscode.workspace.getConfiguration('mjCodeSorter');
    if (config.get<boolean>('autoFormat', true)) {
        await vscode.commands.executeCommand('editor.action.formatDocument');
    }
}
