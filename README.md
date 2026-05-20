# 📝 MJ Code Sorter

[![Open VSX](https://img.shields.io/badge/Open%20VSX-mj--code--sorter-blue)](https://open-vsx.org/extension/mj-youn/mj-code-sorter)
_(💡 현재 Open VSX Registry를 통해 배포되고 있습니다. 위 뱃지를 클릭하면 마켓플레이스 페이지로 이동합니다.)_

**MJ Code Sorter**는 Java, JavaScript, TypeScript 파일의 클래스 멤버, 변수, 함수 등을 지정된 규칙에 따라 자동으로 정렬해 주는 VS Code 확장 프로그램입니다.
특히 기존 코드베이스(AngularJS 등)와 최신 모던 프론트엔드/백엔드 코드를 모두 깔끔하게 유지할 수 있도록 도와줍니다.

---

## ✨ 주요 기능 (Features)

- **다국어 지원**: `Java`, `JavaScript`, `TypeScript`, `React (JSX/TSX)` 코드를 완벽 지원합니다.
- **Java 클래스 멤버 정렬**:
    - static 블록 `>` static final 필드 `>` static 필드 `>` 인스턴스 final 필드 `>` 인스턴스 필드 `>` 생성자 `>` 메서드 `>` 내부 클래스 순으로 정렬.
    - 접근 제어자(`public` > `protected` > `package-private` > `private`)에 따른 세부 정렬.
- **JavaScript / TypeScript 정렬**:
    - 최상위(Top-level) 변수 및 함수: `const` > `var` > `let` > 함수 선언 > 클래스 선언 순 정렬.
    - ES6 클래스 멤버: 필드 > 생성자 > 메서드 순 정렬.
- **AngularJS 특별 지원**:
    - 구형 AngularJS 1.x 컨트롤러/팩토리 패턴(`$scope` 할당 구문)을 지능적으로 인식하여 정렬합니다.
    - 일반 변수 `>` 일반 함수 `>` `$scope.변수` `>` `$scope.메서드` `>` `$scope.$watch` / `$on` 등 특수 함수 순으로 정렬.
- **저장 시 자동 정렬 (Sort on Save)**: 파일을 저장할 때마다 자동으로 코드를 정렬하는 기능을 제공합니다.

---

## 🚀 사용 방법 (Usage)

1. 정렬하고자 하는 `Java`, `JS`, `TS` 파일을 엽니다.
2. 에디터에서 우클릭 후 **[Source Action...]** 메뉴를 클릭합니다.
3. **[Sort Members (MJ)]** 를 선택하면 코드가 즉시 정렬됩니다!
4. _(또는)_ `F1` 키를 눌러 Command Palette를 열고 `Sort Members (MJ)`를 검색하여 실행할 수도 있습니다.

---

## ⚙️ 설정 (Settings)

VS Code 설정(`settings.json` 또는 설정 UI)에서 다음 항목들을 입맛에 맞게 변경할 수 있습니다:

| 설정 항목                 | 타입      | 기본값  | 설명                                                                                                                  |
| ------------------------- | --------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `mjCodeSorter.sortOnSave` | `boolean` | `false` | 파일 저장(`Cmd+S` / `Ctrl+S`) 시 자동으로 코드를 정렬합니다.                                                          |
| `mjCodeSorter.autoFormat` | `boolean` | `true`  | 정렬 완료 후, VS Code에 설정된 기본 포맷터(Formatter)를 호출하여 문서의 들여쓰기와 줄바꿈을 자동으로 예쁘게 맞춥니다. |

---

## 📜 라이선스 (License)

이 확장 프로그램은 [MIT License](./LICENSE) 조건 하에 배포됩니다.

---

**Author**: 윤명준 (MJ Yun)
