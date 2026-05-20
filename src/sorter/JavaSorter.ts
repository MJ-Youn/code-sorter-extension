import * as vscode from 'vscode';
import { ISorter } from './ISorter';
import { Logger } from '../utils/logger';

/**
 * Java 파일의 클래스 멤버를 정렬하는 클래스
 *
 * 정렬 가중치 기준:
 *   5     : static 초기화 블록
 *  11~14  : public/protected/package-private/private static final 필드
 *  21~24  : public/protected/package-private/private static 필드
 *  31~34  : public/protected/package-private/private 인스턴스 final 필드
 *  36~39  : public/protected/package-private/private 인스턴스 필드
 *  40     : 생성자
 *  51~54  : public/protected/package-private/private 메서드
 *  60     : 내부 클래스 / 인터페이스
 *  100    : 기타 (빈 선언 등)
 *
 * @author 윤명준 (MJ Yun)
 */
export class JavaSorter implements ISorter {
    private code: string;
    private document: vscode.TextDocument;

    constructor(code: string, document: vscode.TextDocument) {
        this.code = code;
        this.document = document;
    }

    public async sort(): Promise<vscode.TextEdit[]> {
        const edits: vscode.TextEdit[] = [];
        try {
            const { parse } = await import('java-parser');
            const cst = parse(this.code);

            /**
             * 모든 classBody를 수집한 뒤, offset 기준으로 정렬합니다.
             * 바깥 클래스부터 처리하고, 이미 처리된 범위 안에 있는
             * 내부 클래스 body는 건너뜁니다.
             * (내부 클래스 코드는 바깥 클래스 정렬 시 텍스트로 함께 이동됨)
             */
            const allClassBodies = this.findNodes(cst, 'classBody');
            allClassBodies.sort((a, b) => (a.location?.startOffset ?? 0) - (b.location?.startOffset ?? 0));

            const processedRanges: Array<{ start: number; end: number }> = [];

            for (const body of allClassBodies) {
                const bodyStart = body.location?.startOffset ?? 0;
                const bodyEnd = body.location?.endOffset ?? 0;

                // 이미 처리된 바깥 클래스 범위 내부의 body는 건너뜀
                const isInsideProcessed = processedRanges.some((r) => bodyStart > r.start && bodyEnd < r.end);
                if (isInsideProcessed) {
                    continue;
                }

                const declarations = body.children?.classBodyDeclaration;
                if (!declarations || declarations.length <= 1) {
                    continue;
                }

                // 1. 각 선언부의 텍스트(앞 주석 포함) 및 범위 메타데이터 추출
                const { textMap, startMap, endMap } = this.extractExtendedNodes(declarations, body);

                // 2. 가중치 기반 정렬
                const sorted = this.sortDeclarations(declarations);
                if (!this.isDifferent(declarations, sorted)) {
                    continue;
                }

                // 3. 새 텍스트 조합
                const newText = this.buildSortedText(sorted, textMap);

                // 4. 실제 교체 범위 계산 (위치순 정렬된 첫/마지막 노드 기준)
                const sortedByPos = [...declarations].sort((a, b) => this.getStartOffset(a) - this.getStartOffset(b));
                const firstOriginal = sortedByPos[0];
                const lastOriginal = sortedByPos[sortedByPos.length - 1];

                const firstExtendedStart = startMap.get(firstOriginal) ?? this.getStartOffset(firstOriginal);
                const lastExtendedEnd = endMap.get(lastOriginal) ?? this.getEndOffset(lastOriginal);

                const startPos = this.document.positionAt(firstExtendedStart);
                const endPos = this.document.positionAt(lastExtendedEnd);
                edits.push(vscode.TextEdit.replace(new vscode.Range(startPos, endPos), newText));

                // 처리된 범위 기록 (내부 클래스 중복 처리 방지)
                processedRanges.push({ start: bodyStart, end: bodyEnd });
            }
        } catch (e) {
            Logger.getInstance().error('Java 파싱 실패', e);
            throw e;
        }

        return edits;
    }

    // ────────────────────────────────────────────
    // 텍스트 조합
    // ────────────────────────────────────────────

    /**
     * 정렬된 선언부 목록을 하나의 텍스트로 조합한다.
     * - 메서드/생성자: 항상 빈 줄 1개로 구분
     * - 동일 그룹 필드: 붙여서 표시
     * - 다른 그룹: 빈 줄 1개로 구분
     */
    private buildSortedText(sorted: any[], textMap: WeakMap<object, string>): string {
        let newText = '';
        for (let i = 0; i < sorted.length; i++) {
            const decl = sorted[i];
            const text = textMap.get(decl) ?? this.getNodeText(decl);

            if (i === 0) {
                newText += text;
                continue;
            }

            const prevDecl = sorted[i - 1];
            const weightPrev = this.getMemberWeight(prevDecl);
            const weightCurr = this.getMemberWeight(decl);

            if (this.isMethodOrConstructor(prevDecl) || this.isMethodOrConstructor(decl)) {
                // 메서드/생성자는 항상 빈 줄로 구분
                newText += '\n\n' + text;
            } else if (weightPrev === weightCurr) {
                // 동일 그룹 필드는 붙여서 표시
                newText += '\n' + text;
            } else {
                // 다른 그룹은 빈 줄로 구분
                newText += '\n\n' + text;
            }
        }
        return newText;
    }

    /**
     * 해당 선언부가 메서드 또는 생성자인지 반환한다.
     */
    private isMethodOrConstructor(decl: any): boolean {
        if (!decl?.children) {
            return false;
        }
        if (decl.children.constructorDeclaration) {
            return true;
        }
        const member = decl.children.classMemberDeclaration?.[0];
        return !!(member?.children?.methodDeclaration || member?.children?.classDeclaration || member?.children?.interfaceDeclaration);
    }

    // ────────────────────────────────────────────
    // AST 탐색
    // ────────────────────────────────────────────

    /**
     * AST 노드에서 특정 이름의 노드를 모두 재귀적으로 찾는다.
     * 순환 참조를 방지하기 위해 'location'과 'image' 등 토큰 키는 건너뜁니다.
     */
    private findNodes(node: any, name: string, result: any[] = []): any[] {
        if (!node) {
            return result;
        }
        if (node.name === name) {
            result.push(node);
        }

        if (Array.isArray(node)) {
            for (const item of node) {
                this.findNodes(item, name, result);
            }
        } else if (typeof node === 'object') {
            for (const key in node) {
                // 리프 토큰 속성은 재귀 탐색 제외 (순환 참조 및 불필요한 탐색 방지)
                if (key === 'location' || key === 'image' || key === 'tokenType') {
                    continue;
                }
                this.findNodes(node[key], name, result);
            }
        }
        return result;
    }

    /**
     * 각 선언부의 텍스트와 범위 메타데이터를 추출한다.
     *
     * - textMap: 선언부 노드 → 앞 주석이 포함된 텍스트
     * - startMap: 첫 번째 선언부 노드 → 확장된 시작 offset
     * - endMap: 마지막 선언부 노드 → 확장된 끝 offset
     *
     * WeakMap을 사용하여 객체를 키로 사용합니다 (문자열 변환 버그 방지).
     */
    private extractExtendedNodes(
        declarations: any[],
        body: any,
    ): {
        textMap: WeakMap<object, string>;
        startMap: WeakMap<object, number>;
        endMap: WeakMap<object, number>;
    } {
        const textMap = new WeakMap<object, string>();
        const startMap = new WeakMap<object, number>();
        const endMap = new WeakMap<object, number>();

        const sortedByPos = [...declarations].sort((a, b) => this.getStartOffset(a) - this.getStartOffset(b));

        for (let i = 0; i < sortedByPos.length; i++) {
            const current = sortedByPos[i];
            const startOffset = this.getStartOffset(current);
            const endOffset = this.getEndOffset(current);

            // 앞쪽 범위 확장: 이전 선언부 끝 ~ 현재 선언부 시작 사이의 주석/공백 포함
            const prevEnd = i === 0 ? (body.location?.startOffset ?? 0) : this.getEndOffset(sortedByPos[i - 1]);
            const leadingGap = this.code.substring(prevEnd + 1, startOffset);
            const firstNewline = leadingGap.indexOf('\n');
            const extendedStart = firstNewline !== -1 ? prevEnd + 1 + firstNewline + 1 : startOffset;

            // 뒤쪽 범위 확장: 현재 선언부 끝 ~ 다음 선언부 시작 사이의 첫 줄바꿈까지
            const nextStart = i === sortedByPos.length - 1 ? (body.location?.endOffset ?? this.code.length) : this.getStartOffset(sortedByPos[i + 1]);
            const trailingGap = this.code.substring(endOffset + 1, nextStart);
            const trailingNewline = trailingGap.indexOf('\n');
            const extendedEnd = trailingNewline !== -1 ? endOffset + 1 + trailingNewline : nextStart - 1;

            // 콘텐츠 정리: 앞쪽 빈 줄 제거, 뒤쪽 공백 제거
            let content = this.code.substring(extendedStart, extendedEnd);
            content = content.replace(/^([ \t]*\n)+/, '').trimEnd();

            textMap.set(current, content);
            if (i === 0) {
                startMap.set(current, extendedStart);
            }
            if (i === sortedByPos.length - 1) {
                endMap.set(current, extendedEnd);
            }
        }

        return { textMap, startMap, endMap };
    }

    /**
     * 선언부 목록을 가중치 기준으로 정렬한다.
     */
    private sortDeclarations(declarations: any[]): any[] {
        return [...declarations].sort((a, b) => {
            const diff = this.getMemberWeight(a) - this.getMemberWeight(b);
            if (diff !== 0) {
                return diff;
            }
            return this.getMemberName(a).localeCompare(this.getMemberName(b));
        });
    }

    // ────────────────────────────────────────────
    // 가중치 계산
    // ────────────────────────────────────────────

    /**
     * 멤버의 정렬 가중치를 반환한다.
     */
    private getMemberWeight(decl: any): number {
        if (decl.children?.constructorDeclaration) {
            return 40;
        }
        if (decl.children?.block) {
            return 5;
        } // static 초기화 블록
        if (decl.children?.[';']) {
            return 100;
        } // 빈 선언

        const member = decl.children?.classMemberDeclaration?.[0];
        if (!member) {
            return 100;
        }

        if (member.children?.fieldDeclaration) {
            const isStatic = this.isStatic(member);
            const isFinal = this.isFinal(member);
            const aw = this.getAccessModifierWeight(member);
            if (isStatic) {
                return isFinal ? 10 + aw : 20 + aw;
            }
            return isFinal ? 30 + aw : 35 + aw;
        }

        if (member.children?.methodDeclaration) {
            return 50 + this.getAccessModifierWeight(member);
        }

        if (member.children?.classDeclaration || member.children?.interfaceDeclaration) {
            return 60;
        }

        return 100;
    }

    private isStatic(member: any): boolean {
        return this.getModifiers(member).some((m: any) => m.children?.Static);
    }

    private isFinal(member: any): boolean {
        return this.getModifiers(member).some((m: any) => m.children?.Final);
    }

    /**
     * 접근 제한자 가중치 반환: public(1) > protected(2) > package-private(3) > private(4)
     */
    private getAccessModifierWeight(member: any): number {
        const modifiers = this.getModifiers(member);
        if (modifiers.some((m: any) => m.children?.Public)) {
            return 1;
        }
        if (modifiers.some((m: any) => m.children?.Protected)) {
            return 2;
        }
        if (modifiers.some((m: any) => m.children?.Private)) {
            return 4;
        }
        return 3; // Package-private (default)
    }

    /**
     * 멤버의 수정자(modifier) 목록을 반환한다.
     * 생성자나 static 블록에는 수정자가 없을 수 있으므로 빈 배열을 반환한다.
     */
    private getModifiers(member: any): any[] {
        // 필드/메서드/클래스 선언에서 수정자 추출
        const decl = member.children?.fieldDeclaration?.[0] ?? member.children?.methodDeclaration?.[0] ?? member.children?.classDeclaration?.[0];

        if (decl?.children) {
            for (const key in decl.children) {
                if (key.endsWith('Modifier')) {
                    return decl.children[key];
                }
            }
        }
        return [];
    }

    // ────────────────────────────────────────────
    // 이름 추출
    // ────────────────────────────────────────────

    private getMemberName(decl: any): string {
        // 생성자
        if (decl.children?.constructorDeclaration) {
            return decl.children.constructorDeclaration[0]?.children?.Identifier?.[0]?.image ?? '';
        }

        const member = decl.children?.classMemberDeclaration?.[0];
        if (!member) {
            return '';
        }

        const subDecl = member.children?.fieldDeclaration?.[0] ?? member.children?.methodDeclaration?.[0] ?? member.children?.classDeclaration?.[0];

        if (!subDecl?.children) {
            return '';
        }

        // 필드: variableDeclaratorList → variableDeclarator → variableDeclaratorId
        if (subDecl.children.variableDeclaratorList) {
            const varId = subDecl.children.variableDeclaratorList[0]?.children?.variableDeclarator?.[0]?.children?.variableDeclaratorId?.[0];
            return varId?.children?.Identifier?.[0]?.image ?? '';
        }
        // 메서드: methodHeader → methodDeclarator
        if (subDecl.children.methodHeader) {
            const declarator = subDecl.children.methodHeader[0]?.children?.methodDeclarator?.[0];
            return declarator?.children?.Identifier?.[0]?.image ?? '';
        }
        // 내부 클래스: typeIdentifier
        if (subDecl.children.typeIdentifier) {
            return subDecl.children.typeIdentifier[0]?.children?.Identifier?.[0]?.image ?? '';
        }

        return '';
    }

    // ────────────────────────────────────────────
    // 오프셋 계산
    // ────────────────────────────────────────────

    /**
     * 노드의 시작 offset을 반환한다 (재귀적으로 첫 토큰 탐색).
     */
    private getStartOffset(node: any): number {
        if (node?.location?.startOffset !== undefined) {
            return node.location.startOffset;
        }

        let current = node;
        while (current && typeof current === 'object') {
            if (current.startOffset !== undefined) {
                return current.startOffset;
            }
            if (current.children) {
                const keys = Object.keys(current.children);
                if (keys.length === 0) {
                    break;
                }
                current = current.children[keys[0]];
                if (Array.isArray(current)) {
                    current = current[0];
                }
            } else if (Array.isArray(current) && current.length > 0) {
                current = current[0];
            } else {
                break;
            }
        }
        return current?.startOffset ?? 0;
    }

    /**
     * 노드의 끝 offset을 반환한다 (재귀적으로 마지막 토큰 탐색).
     */
    private getEndOffset(node: any): number {
        if (node?.location?.endOffset !== undefined) {
            return node.location.endOffset;
        }

        let current = node;
        while (current && typeof current === 'object') {
            if (current.endOffset !== undefined) {
                return current.endOffset;
            }
            if (current.children) {
                const keys = Object.keys(current.children);
                if (keys.length === 0) {
                    break;
                }
                const lastKey = keys[keys.length - 1];
                const arr = current.children[lastKey];
                current = Array.isArray(arr) ? arr[arr.length - 1] : arr;
            } else if (Array.isArray(current) && current.length > 0) {
                current = current[current.length - 1];
            } else {
                break;
            }
        }
        return current?.endOffset ?? 0;
    }

    private getNodeText(node: any): string {
        return this.code.substring(this.getStartOffset(node), this.getEndOffset(node) + 1);
    }

    private isDifferent(arr1: any[], arr2: any[]): boolean {
        return arr1.some((item, i) => item !== arr2[i]);
    }
}
