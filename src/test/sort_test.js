// AngularJS 1.x 스타일 컨트롤러 정렬 테스트
angular.module('myApp').controller('TestController', function($scope) {

    const a_const = 'A';
    const z_const = 'Z';

    var c_var = 3;

    let a_let = 1;
    // --- 아래는 뒤섞인 상태 ---

    let b_let = 2;

    function anotherFunction() {
        console.log('another');
    }

    function doSomething() {
        console.log('doing something');
    }

    $scope.a = 'test';
    $scope.b = 'test';
    $scope.c = 'test2';

    /**
     * test
     *
     * @author MJ Yun
     * @since 2026. 05. 20.
     */
    $scope.aaa = function() {};

    /**
     * 이것은 $scope 메서드입니다.
     */
    $scope.save = function() {};

    $scope.$watch('someVar', function() {});

    $scope.$on('someEvent', function() {});

});

const globalConst = 1;

var globalVar = 3;

let globalLet = 2;

function globalFuncA() {}

// --- Top-level statements Test ---
function globalFuncB() {}

// --- ES6 Class Test ---
class MyJSClass {
    // 필드 A
    aField = 10;
    /**
     * 필드 B
     */
    bField = 20;

    constructor() {}

    methodA() {}

    // 메서드 Z
    methodZ() {}
}
