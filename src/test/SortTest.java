package io.github.mjyoun.build_test.controller;

public class SortTest {

    // --- Methods (Scrambled) ---
    private void privateMethodB() {
        System.out.println("Private B");
    }

    /**
     * 이것은 publicMethodA의 Javadoc 입니다.
     */
    public void publicMethodA() {
        System.out.println("Public A");
    }

    // Default 메서드에 대한 한 줄 주석
    void defaultMethod() {
        System.out.println("Default");
    }

    protected void protectedMethod() {
        System.out.println("Protected");
    }

    public void publicMethodB() {
        System.out.println("Public B");
    }

    private void privateMethodA() {
        System.out.println("Private A");
    }

    // --- Instance Fields (Scrambled) ---
    // private 필드 B에 대한 설명입니다.
    private String privateFieldB = "Private B";
    
    /**
     * 공용 필드 A에 대한 Javadoc 입니다.
     */
    public int publicFieldA = 1;
    // 이 필드는 패키지 프라이빗입니다.
    String defaultField = "Default";
    protected double protectedField = 2.0;
    public int publicFieldB = 2; /* 같은 줄 후행 주석 테스트 1 */
    private String privateFieldA = "Private A"; // 같은 줄 후행 주석 테스트 2
    // --- Static Fields (Scrambled) ---
    private static final String PRIVATE_STATIC_FINAL_A = "Private Static Final A";
    // 공용 static 변수 B
    public static int publicStaticB = 20;
    protected static final double PROTECTED_STATIC_FINAL = 3.14;
    static String defaultStatic = "Default Static";
    private static String privateStaticB = "Private Static B";
    /**
     * 상수로 사용되는 PUBLIC_STATIC_FINAL_B 입니다.
     * 절대 변경하지 마세요.
     */
    public static final int PUBLIC_STATIC_FINAL_B = 200;
    protected static double protectedStatic = 1.5;
    public static final int PUBLIC_STATIC_FINAL_A = 100;
    static final String DEFAULT_STATIC_FINAL = "Default Static Final";
    public static int publicStaticA = 10;
    private static String privateStaticA = "Private Static A";
    private static final String PRIVATE_STATIC_FINAL_B = "Private Static Final B";

    // --- Constructors (Scrambled) ---
    public SortTest(int a, String b) {
        this.publicFieldA = a;
        this.defaultField = b;
    }

    public SortTest() {
        // Default constructor 내부에 있는 주석 (이것은 블록 내부에 있으므로 안전합니다)
    }

    /**
     * 안녕하세요.
     * 
     * @param a publicFieldA에 주입할 값
     * 
     * @author MJ Yun
     * @since 2026. 05. 20.
     */
    public SortTest(int a) {
        this.publicFieldA = a;
    }

}
