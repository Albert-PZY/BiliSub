from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from typing import Sequence

from .bilibili import BilibiliClient, BilibiliError, render_qr_ascii, render_srt, save_qr_svg
from .store import SessionStore
from .web import create_web_server


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 0

    store = SessionStore(args.session_file)
    try:
        if args.command == "web":
            return handle_web(
                store,
                host=args.host,
                port=args.port,
            )

        with BilibiliClient(store=store) as client:
            if args.command == "login":
                return handle_login(client, store, timeout_seconds=args.timeout)
            if args.command == "status":
                return handle_status(client)
            if args.command == "logout":
                client.logout()
                print("已清除本地 B 站登录态。")
                return 0
            if args.command == "subtitles":
                return handle_subtitles(
                    client,
                    source_input=args.source,
                    preferred_language=args.language,
                    output_format=args.format,
                    output_path=args.output,
                )
    except BilibiliError as exc:
        print(f"错误: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("已中断。", file=sys.stderr)
        return 130

    parser.print_help()
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="bili-ai-sub",
        description="扫码登录 B 站并通过 BV 号/视频链接获取 AI 字幕。",
    )
    parser.add_argument(
        "--session-file",
        type=Path,
        default=None,
        help="自定义会话文件路径，默认保存到项目 data/session.json。",
    )
    subparsers = parser.add_subparsers(dest="command")

    login_parser = subparsers.add_parser("login", help="发起 B 站二维码登录。")
    login_parser.add_argument("--timeout", type=int, default=180, help="等待扫码完成的超时时间，默认 180 秒。")

    subparsers.add_parser("status", help="查看当前本地登录态，并在线校验一次。")
    subparsers.add_parser("logout", help="清除当前本地登录态。")

    subtitles_parser = subparsers.add_parser("subtitles", help="通过 BV 号或 B 站视频链接获取 AI 字幕。")
    subtitles_parser.add_argument("source", help="BV 号或完整视频链接。")
    subtitles_parser.add_argument(
        "--language",
        default="zh-Hans",
        help="期望字幕语言，默认 zh-Hans。",
    )
    subtitles_parser.add_argument(
        "--format",
        choices=("text", "srt", "raw-json"),
        default="text",
        help="输出格式，默认 text。",
    )
    subtitles_parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="输出文件路径；不传则直接打印到标准输出。",
    )

    web_parser = subparsers.add_parser("web", help="启动本地网页工具。")
    web_parser.add_argument("--host", default="127.0.0.1", help="监听地址，默认 127.0.0.1。")
    web_parser.add_argument("--port", type=int, default=8933, help="监听端口，默认 8933。")
    return parser


def handle_login(client: BilibiliClient, store: SessionStore, timeout_seconds: int) -> int:
    qr_session = client.start_qr_login()
    qr_svg_path = store.qr_svg_path()
    qr_svg_path.parent.mkdir(parents=True, exist_ok=True)
    save_qr_svg(qr_session.qrcode_url, str(qr_svg_path))

    print("请使用 B 站 App 扫描下方二维码并确认登录：")
    print(render_qr_ascii(qr_session.qrcode_url))
    print(f"二维码链接: {qr_session.qrcode_url}")
    print(f"二维码 SVG 已保存: {qr_svg_path}")

    deadline = time.monotonic() + max(5, timeout_seconds)
    previous_status = "pending"
    while time.monotonic() < deadline:
        poll_result = client.poll_qr_login(qr_session.qrcode_key)
        if poll_result.status == "success":
            account = poll_result.account or {"mid": "-", "uname": "-"}
            print(f"登录成功: {account['uname']} ({account['mid']})")
            return 0
        if poll_result.status == "expired":
            raise BilibiliError(poll_result.message)
        if poll_result.status != previous_status:
            print(f"当前状态: {poll_result.status} - {poll_result.message}")
            previous_status = poll_result.status
        time.sleep(max(0.5, qr_session.poll_interval_ms / 1000))

    raise BilibiliError("等待扫码超时，请重新执行 login")


def handle_status(client: BilibiliClient) -> int:
    snapshot = client.get_status(refresh=True)
    print(f"状态: {snapshot.status}")
    if snapshot.account:
        print(f"账号: {snapshot.account['uname']} ({snapshot.account['mid']})")
    if snapshot.last_validated_at:
        print(f"最近校验: {snapshot.last_validated_at}")
    if snapshot.last_error:
        print(f"错误: {snapshot.last_error}")
    print(f"Cookie 字段: {', '.join(snapshot.cookies.keys()) if snapshot.cookies else '-'}")
    return 0


def handle_subtitles(
    client: BilibiliClient,
    *,
    source_input: str,
    preferred_language: str | None,
    output_format: str,
    output_path: Path | None,
) -> int:
    resolved = client.fetch_ai_subtitle(source_input, preferred_language=preferred_language)
    if output_format == "raw-json":
        content = resolved.raw_subtitle_json
    elif output_format == "srt":
        content = render_srt(resolved.segments)
    else:
        content = resolved.text

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(content, encoding="utf-8")
        print(f"已写出到: {output_path}")
        print(f"字幕语言: {resolved.language}")
        print(f"字幕地址: {resolved.subtitle_url}")
        return 0

    sys.stdout.write(content)
    if not content.endswith("\n"):
        sys.stdout.write("\n")
    return 0


def handle_web(store: SessionStore, *, host: str, port: int) -> int:
    server = create_web_server(store=store, host=host, port=port)
    actual_host, actual_port = server.server_address
    print(f"本地页面已启动: http://{actual_host}:{actual_port}")
    print("仅绑定本机地址，按 Ctrl+C 停止。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("正在停止本地页面。")
    finally:
        server.shutdown()
        server.server_close()
    return 0
