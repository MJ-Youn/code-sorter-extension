import * as vscode from 'vscode';

/**
 * VS Code Output Channel 기반 로거 유틸
 *
 * console.log와 outputChannel.appendLine을 통합하여 일관된 로그 출력을 제공합니다.
 * View > Output > "MJ Code Sorter" 패널에서 로그 확인 가능합니다.
 *
 * @author 윤명준 (MJ Yun)
 */
export class Logger {
    private static instance: Logger | null = null;
    private channel: vscode.OutputChannel;

    private constructor(channelName: string) {
        this.channel = vscode.window.createOutputChannel(channelName);
    }

    /**
     * Logger 인스턴스를 초기화한다. activate() 함수에서 한 번만 호출해야 합니다.
     */
    public static initialize(channelName: string): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(channelName);
        }
        return Logger.instance;
    }

    /**
     * 현재 Logger 인스턴스를 반환한다.
     * initialize()가 먼저 호출되어야 합니다.
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            throw new Error('[Logger] initialize()를 먼저 호출해야 합니다.');
        }
        return Logger.instance;
    }

    /** 일반 정보 로그 */
    public info(message: string): void {
        const log = `[정보] ${message}`;
        this.channel.appendLine(log);
        console.log(log);
    }

    /** 경고 로그 */
    public warn(message: string): void {
        const log = `[경고] ${message}`;
        this.channel.appendLine(log);
        console.warn(log);
    }

    /**
     * 에러 로그 - Output 패널을 자동으로 열어 사용자가 즉시 확인할 수 있게 합니다.
     * @param message - 에러 메시지
     * @param error - 에러 객체 (선택, 스택 트레이스 출력에 사용)
     */
    public error(message: string, error?: unknown): void {
        this.channel.appendLine(`[오류] ${message}`);
        if (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            const errStack = error instanceof Error ? (error.stack ?? '(스택 없음)') : '';
            this.channel.appendLine(`  메시지: ${errMsg}`);
            if (errStack) {
                this.channel.appendLine(`  스택:\n${errStack}`);
            }
        }
        this.channel.show(true); // Output 패널 자동 열기
        console.error(`[MJ Code Sorter 오류] ${message}`, error);
    }

    /** Output 채널 Disposable 반환 (context.subscriptions에 등록용) */
    public getDisposable(): vscode.Disposable {
        return this.channel;
    }

    /** Logger 인스턴스 초기화 (테스트용) */
    public static reset(): void {
        Logger.instance = null;
    }
}
