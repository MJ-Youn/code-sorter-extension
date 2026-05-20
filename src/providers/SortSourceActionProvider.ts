import * as vscode from 'vscode';
import { JavaScriptSorter } from '../sorter/JavaScriptSorter';
import { JavaSorter } from '../sorter/JavaSorter';
import { ISorter } from '../sorter/ISorter';
import { isSupportedLanguage } from '../constants';

/**
 * VS Code Source Action Provider
 * 에디터 우클릭 메뉴 및 CodeAction 목록에 "Sort Members (MJ)" 항목을 노출합니다.
 *
 * @author 윤명준 (MJ Yun)
 */
export class SortSourceActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [vscode.CodeActionKind.Source];

    public provideCodeActions(_document: vscode.TextDocument, _range: vscode.Range | vscode.Selection, _context: vscode.CodeActionContext, _token: vscode.CancellationToken): vscode.CodeAction[] {
        const action = new vscode.CodeAction('Sort Members (MJ)', vscode.CodeActionKind.Source);
        action.command = {
            command: 'mjCodeSorter.sortMembers',
            title: 'Sort Members (MJ)',
        };
        return [action];
    }

    /**
     * 주어진 문서에 적용할 정렬 TextEdit 목록을 반환한다.
     * 지원하지 않는 언어인 경우 빈 배열을 반환한다.
     *
     * @param document - 정렬 대상 VS Code 문서
     */
    public async getSortTextEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        const { languageId } = document;

        if (!isSupportedLanguage(languageId)) {
            return [];
        }

        const code = document.getText();
        const sorter = this.createSorter(languageId, code, document);

        return sorter ? sorter.sort() : [];
    }

    /**
     * 언어 ID에 맞는 Sorter 인스턴스를 생성한다.
     * 새 언어 지원 시 이 메서드에만 추가하면 됩니다.
     */
    private createSorter(languageId: string, code: string, document: vscode.TextDocument): ISorter | null {
        switch (languageId) {
            case 'java':
                return new JavaSorter(code, document);
            case 'javascript':
            case 'javascriptreact':
            case 'typescript':
            case 'typescriptreact':
                return new JavaScriptSorter(code, document);
            default:
                return null;
        }
    }
}
