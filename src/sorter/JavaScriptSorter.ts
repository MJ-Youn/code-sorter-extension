import * as vscode from 'vscode';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { ISorter } from './ISorter';
import { Logger } from '../utils/logger';

/**
 * JavaScript / TypeScript / AngularJS 파일의 멤버를 정렬하는 클래스
 *
 * 정렬 기준 (BlockStatement 내부):
 *  1. 일반 변수 선언 (const > var > let, 알파벳 순)
 *  2. 일반 함수 선언 (function foo(), 알파벳 순)
 *  3. $scope 변수 ($scope.x = 값, 알파벳 순)
 *  4. $scope 함수 ($scope.x = function(), 알파벳 순)
 *  5. $scope 특수 함수 ($scope.$on, $scope.$watch 등, 알파벳 순)
 *  6. 기타 표현식 (원래 순서 유지)
 *
 * @author 윤명준 (MJ Yun)
 */
export class JavaScriptSorter implements ISorter {
    private code: string;
    private document: vscode.TextDocument;

    constructor(code: string, document: vscode.TextDocument) {
        this.code = code;
        this.document = document;
    }

    public sort(): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        try {
            const ast = parse(this.code, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx', 'decorators-legacy'],
                errorRecovery: true,
            });

            const self = this;

            traverse(ast, {
                // ES6 클래스 바디 정렬
                ClassBody(path) {
                    const result = self.sortClassMembers(path.node.body);
                    if (result) {
                        const startPos = self.document.positionAt(self.getStart(path.node.body[0]));
                        const endPos = self.document.positionAt(self.getEnd(path.node.body[path.node.body.length - 1]));
                        edits.push(vscode.TextEdit.replace(new vscode.Range(startPos, endPos), result));
                    }
                },
                // 최상위 레벨 정렬
                Program(path) {
                    edits.push(...self.sortTopLevelBlock(path.node.body));
                },
                // 블록 내부 정렬 (AngularJS controller/factory/service 등의 function body 포함)
                BlockStatement(path) {
                    // ClassBody 내부 메서드의 body는 제외 (ClassBody 핸들러에서 처리)
                    if (t.isClassMethod(path.parent) || t.isClassPrivateMethod(path.parent)) {
                        return;
                    }
                    edits.push(...self.sortAngularBlock(path.node.body));
                },
            });
        } catch (e) {
            Logger.getInstance().error('JS/TS 파싱 실패', e);
            throw e;
        }

        return edits;
    }

    // ────────────────────────────────────────────
    // 노드 텍스트 추출 헬퍼
    // ────────────────────────────────────────────

    private getStart(node: t.Node): number {
        let start = node.start!;
        if (node.leadingComments && node.leadingComments.length > 0) {
            start = node.leadingComments[0].start!;
        }
        // 들여쓰기 포함
        while (start > 0 && (this.code[start - 1] === ' ' || this.code[start - 1] === '\t')) {
            start--;
        }
        return start;
    }

    private getEnd(node: t.Node): number {
        // trailingComments를 포함하지 않는다.
        // Babel은 두 노드 사이의 주석을 이전 노드의 trailingComments 와
        // 다음 노드의 leadingComments 양쪽에 모두 붙이기 때문에,
        // getEnd()에서 trailingComments까지 포함하면 정렬 후 주석이 중복된다.
        // 주석은 항상 leadingComments(getStart)를 통해서만 한 번 포함된다.
        return node.end!;
    }

    private getNodeText(node: t.Node): string {
        return this.code.substring(this.getStart(node), this.getEnd(node)).trimEnd();
    }

    // ────────────────────────────────────────────
    // ES6 클래스 멤버 정렬
    // ────────────────────────────────────────────

    /**
     * 클래스 멤버를 정렬한 새 텍스트를 반환한다.
     * 이미 정렬된 경우 null 반환.
     */
    private sortClassMembers(members: t.Node[]): string | null {
        if (members.length <= 1) {
            return null;
        }

        const sorted = [...members].sort((a, b) => {
            const diff = this.getClassMemberTypeWeight(a) - this.getClassMemberTypeWeight(b);
            if (diff !== 0) {
                return diff;
            }
            return this.getNodeName(a).localeCompare(this.getNodeName(b));
        });

        if (!this.isDifferent(members, sorted)) {
            return null;
        }

        let newText = '';
        for (let i = 0; i < sorted.length; i++) {
            const decl = sorted[i];
            const text = this.getNodeText(decl);
            if (i === 0) {
                newText += text;
                continue;
            }

            const isMethod = (n: t.Node) => t.isClassMethod(n) || t.isClassPrivateMethod(n);
            const prevWeight = this.getClassMemberTypeWeight(sorted[i - 1]);
            const currWeight = this.getClassMemberTypeWeight(decl);

            if (isMethod(sorted[i - 1]) || isMethod(decl)) {
                newText += '\n\n' + text;
            } else if (prevWeight === currWeight) {
                newText += '\n' + text;
            } else {
                newText += '\n\n' + text;
            }
        }

        return newText;
    }

    /** 클래스 멤버 정렬 가중치: 필드(1) > 생성자(2) > 메서드(3) > 기타(4) */
    private getClassMemberTypeWeight(node: t.Node): number {
        if (t.isClassProperty(node) || t.isClassPrivateProperty(node)) {
            return 1;
        }
        if (t.isClassMethod(node) || t.isClassPrivateMethod(node)) {
            return (node as t.ClassMethod).kind === 'constructor' ? 2 : 3;
        }
        return 4;
    }

    // ────────────────────────────────────────────
    // 최상위(Program) 레벨 정렬
    // ────────────────────────────────────────────

    private sortTopLevelBlock(nodes: t.Statement[]): vscode.TextEdit[] {
        /** 최상위 정렬 가능 구문: 변수 선언, 함수 선언, 클래스 선언 */
        const isSortable = (n: t.Statement) => t.isVariableDeclaration(n) || t.isFunctionDeclaration(n) || t.isClassDeclaration(n);

        return this.sortStatementBlock(
            nodes,
            isSortable,
            (a, b) => {
                const diff = this.getTopLevelWeight(a) - this.getTopLevelWeight(b);
                if (diff !== 0) {
                    return diff;
                }
                return this.getNodeName(a).localeCompare(this.getNodeName(b));
            },
            (sorted) => this.buildText(sorted, this.getTopLevelGroupWeight.bind(this)),
        );
    }

    /** 최상위 구문 정렬 가중치: const(1) > var(2) > let(3) > 함수(10) > 클래스(20) */
    private getTopLevelWeight(node: t.Statement): number {
        if (t.isVariableDeclaration(node)) {
            switch (node.kind) {
                case 'const':
                    return 1;
                case 'var':
                    return 2;
                case 'let':
                    return 3;
                default:
                    return 4;
            }
        }
        if (t.isFunctionDeclaration(node)) {
            return 10;
        }
        if (t.isClassDeclaration(node)) {
            return 20;
        }
        return 30;
    }

    /** 최상위 구문 그룹 가중치 (같은 그룹 여부 판별용) */
    private getTopLevelGroupWeight(node: t.Statement): number {
        if (t.isVariableDeclaration(node)) {
            switch (node.kind) {
                case 'const':
                    return 11;
                case 'var':
                    return 12;
                case 'let':
                    return 13;
                default:
                    return 14;
            }
        }
        if (t.isFunctionDeclaration(node)) {
            return 20;
        }
        if (t.isClassDeclaration(node)) {
            return 30;
        }
        return 40;
    }

    // ────────────────────────────────────────────
    // AngularJS / 일반 BlockStatement 내부 정렬
    // ────────────────────────────────────────────

    /**
     * BlockStatement 내부를 AngularJS 규칙으로 정렬한다.
     *
     * 정렬 그룹 (가중치):
     *  10~12 : 일반 변수 선언 (const:10, var:11, let:12)
     *  20    : 일반 함수 선언 (function foo() {})
     *  30    : $scope 변수 ($scope.x = 문자열/숫자/배열/객체 등)
     *  40    : $scope 메서드 ($scope.x = function() {})
     *  50    : $scope 특수 ($scope.$watch, $scope.$on 등)
     *  99    : 기타 (ExpressionStatement, IfStatement 등 → 순서 유지)
     */
    private sortAngularBlock(nodes: t.Statement[]): vscode.TextEdit[] {
        /** AngularJS 정렬 가능 구문: 변수, 함수, $scope 할당 */
        const isSortable = (n: t.Statement) => this.getAngularWeight(n) < 99;

        return this.sortStatementBlock(
            nodes,
            isSortable,
            (a, b) => {
                const diff = this.getAngularWeight(a) - this.getAngularWeight(b);
                if (diff !== 0) {
                    return diff;
                }
                return this.getNodeName(a).localeCompare(this.getNodeName(b));
            },
            (sorted) => this.buildAngularText(sorted),
        );
    }

    /**
     * AngularJS 정렬 가중치 반환
     */
    private getAngularWeight(node: t.Statement): number {
        // 일반 변수 선언
        if (t.isVariableDeclaration(node)) {
            switch (node.kind) {
                case 'const':
                    return 10;
                case 'var':
                    return 11;
                case 'let':
                    return 12;
                default:
                    return 13;
            }
        }

        // 일반 함수 선언
        if (t.isFunctionDeclaration(node)) {
            return 20;
        }

        // $scope.xxx = ... 형태의 ExpressionStatement
        if (t.isExpressionStatement(node) && t.isAssignmentExpression(node.expression)) {
            const left = node.expression.left;
            // $scope.xxx 형태인지 확인
            if (t.isMemberExpression(left) && t.isIdentifier(left.object) && left.object.name === '$scope' && t.isIdentifier(left.property)) {
                const propName = left.property.name;
                const right = node.expression.right;

                // $scope.$xxx (특수 함수: $watch, $on, $broadcast 등) - 가장 마지막
                if (propName.startsWith('$')) {
                    return 50;
                }

                // $scope.xxx = function() {} 형태
                if (t.isFunctionExpression(right) || t.isArrowFunctionExpression(right)) {
                    return 40;
                }

                // $scope.xxx = 값 (변수)
                return 30;
            }
        }

        // 기타 (정렬 불가 - 순서 유지)
        return 99;
    }

    // ────────────────────────────────────────────
    // 공통 정렬 블록 처리 헬퍼
    // ────────────────────────────────────────────

    /**
     * 연속된 "정렬 가능한" 구문 블록들을 찾아 정렬한다.
     * 정렬 불가능한 구문을 만나면 현재 블록을 처리하고 새 블록을 시작한다.
     *
     * @param nodes - 전체 구문 목록
     * @param isSortable - 해당 구문이 정렬 가능한지 판별하는 함수
     * @param compareFn - 정렬 비교 함수
     * @param buildTextFn - 정렬된 구문들을 텍스트로 조합하는 함수
     */
    private sortStatementBlock(nodes: t.Statement[], isSortable: (n: t.Statement) => boolean, compareFn: (a: t.Statement, b: t.Statement) => number, buildTextFn: (sorted: t.Statement[]) => string): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        let currentBlock: t.Statement[] = [];

        const processBlock = () => {
            if (currentBlock.length > 1) {
                const sorted = [...currentBlock].sort(compareFn);
                if (this.isDifferent(currentBlock, sorted)) {
                    const newText = buildTextFn(sorted);
                    const startPos = this.document.positionAt(this.getStart(currentBlock[0]));
                    const endPos = this.document.positionAt(this.getEnd(currentBlock[currentBlock.length - 1]));
                    edits.push(vscode.TextEdit.replace(new vscode.Range(startPos, endPos), newText));
                }
            }
            currentBlock = [];
        };

        for (const node of nodes) {
            if (isSortable(node)) {
                currentBlock.push(node);
            } else {
                processBlock();
            }
        }
        processBlock();

        return edits;
    }

    /**
     * 정렬된 구문 목록을 텍스트로 조합한다.
     * 함수/클래스는 빈 줄로 구분, 같은 그룹의 변수는 붙여서 표시.
     *
     * @param sorted - 정렬된 구문 목록
     * @param getGroupWeight - 그룹 가중치 반환 함수 (같은 그룹 판별용)
     */
    private buildText(sorted: t.Statement[], getGroupWeight: (n: t.Statement) => number): string {
        let newText = '';
        for (let i = 0; i < sorted.length; i++) {
            const text = this.getNodeText(sorted[i]);
            if (i === 0) {
                newText += text;
                continue;
            }

            const isFuncOrClass = (n: t.Statement) => t.isFunctionDeclaration(n) || t.isClassDeclaration(n);
            const prevWeight = getGroupWeight(sorted[i - 1]);
            const currWeight = getGroupWeight(sorted[i]);

            if (isFuncOrClass(sorted[i - 1]) || isFuncOrClass(sorted[i])) {
                newText += '\n\n' + text;
            } else if (prevWeight === currWeight) {
                newText += '\n' + text;
            } else {
                newText += '\n\n' + text;
            }
        }
        return newText;
    }

    /**
     * AngularJS 정렬된 구문 목록을 텍스트로 조합한다.
     * 함수/$scope 함수 계열은 빈 줄로 구분, 같은 그룹의 변수/$scope 변수는 붙여서 표시.
     */
    private buildAngularText(sorted: t.Statement[]): string {
        let newText = '';
        for (let i = 0; i < sorted.length; i++) {
            const text = this.getNodeText(sorted[i]);
            if (i === 0) {
                newText += text;
                continue;
            }

            const prevWeight = this.getAngularWeight(sorted[i - 1]);
            const currWeight = this.getAngularWeight(sorted[i]);
            // 함수 계열 가중치: 일반 함수(20), $scope 함수(40), $scope 특수(50)
            const isFuncLike = (w: number) => w === 20 || w === 40 || w === 50;

            if (prevWeight === currWeight && !isFuncLike(currWeight)) {
                // 같은 그룹 + 변수류 → 붙여서 표시
                newText += '\n' + text;
            } else {
                // 그룹이 다르거나 함수 계열 → 빈 줄로 구분
                newText += '\n\n' + text;
            }
        }
        return newText;
    }

    // ────────────────────────────────────────────
    // 공통 이름/가중치 헬퍼
    // ────────────────────────────────────────────

    /**
     * 노드의 이름을 반환한다 (알파벳 정렬에 사용).
     * 변수 선언, 함수 선언, 클래스 선언, $scope 할당 등을 처리한다.
     */
    private getNodeName(node: t.Node): string {
        // 변수 선언
        if (t.isVariableDeclaration(node) && node.declarations.length > 0) {
            const id = node.declarations[0].id;
            if (t.isIdentifier(id)) {
                return id.name;
            }
        }
        // 함수 선언
        if (t.isFunctionDeclaration(node) && node.id) {
            return node.id.name;
        }
        // 클래스 선언
        if (t.isClassDeclaration(node) && node.id) {
            return node.id.name;
        }
        // 클래스 필드/메서드
        if (t.isClassProperty(node) || t.isClassMethod(node)) {
            if (t.isIdentifier(node.key)) {
                return node.key.name;
            }
        }
        if (t.isClassPrivateProperty(node) || t.isClassPrivateMethod(node)) {
            return node.key.id.name;
        }
        // $scope.xxx = ... 할당식
        if (t.isExpressionStatement(node) && t.isAssignmentExpression(node.expression)) {
            const left = node.expression.left;
            if (t.isMemberExpression(left) && t.isIdentifier(left.property)) {
                return left.property.name;
            }
        }
        return '';
    }

    private isDifferent(arr1: t.Node[], arr2: t.Node[]): boolean {
        return arr1.some((item, i) => item !== arr2[i]);
    }
}
